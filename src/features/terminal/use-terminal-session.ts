import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import {
	IME_COMMIT_EVENT,
	IME_PREEDIT_EVENT,
	TERMINAL_EXIT_EVENT,
	TERMINAL_OUTPUT_EVENT,
	type TerminalOutput,
} from "@/ipc/bindings";
import { ipc } from "@/ipc/client";
import { platform } from "@/ipc/platform";

/** Composing text, placed at the terminal cursor. `null` when idle. */
export type Preedit = {
	text: string;
	left: number;
	top: number;
	height: number;
};

export type SessionStatus =
	| { status: "starting" }
	| { status: "running"; id: number }
	| { status: "exited" }
	| { status: "failed"; reason: string };

/**
 * Where the terminal cursor is, in pixels within the host element. Uses the
 * public cols/rows and rendered screen size, not xterm's private render service,
 * so an upgrade cannot silently move the preedit.
 */
function cursorBox(term: Terminal, host: HTMLElement): Omit<Preedit, "text"> {
	const screen = host.querySelector(".xterm-screen") as HTMLElement | null;
	const width = (screen?.clientWidth ?? host.clientWidth) / term.cols;
	const height = (screen?.clientHeight ?? host.clientHeight) / term.rows;
	const buffer = term.buffer.active;
	return { left: buffer.cursorX * width, top: buffer.cursorY * height, height };
}

/**
 * Owns the emulator instance and the pty behind it.
 *
 * The Terminal lives in a ref rather than in state on purpose: it is a
 * long-lived object with its own DOM, and putting it through React's render
 * cycle is how you end up destroying a running shell on an unrelated re-render.
 */
export function useTerminalSession(
	host: React.RefObject<HTMLDivElement | null>,
) {
	const [session, setSession] = useState<SessionStatus>({ status: "starting" });
	const [preedit, setPreedit] = useState<Preedit | null>(null);
	const terminal = useRef<Terminal | null>(null);

	useEffect(() => {
		const element = host.current;
		if (!element) return;

		let disposed = false;
		let sessionId: number | null = null;
		const cleanups: Array<() => void> = [];

		const term = new Terminal({
			cursorBlink: true,
			// A literal stack, not var(--font-mono): xterm measures glyphs on a
			// canvas, where a CSS custom property does not resolve and every cell
			// ends up the wrong width.
			fontFamily:
				"ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
			fontSize: 13,
			allowProposedApi: true,
		});
		const fit = new FitAddon();
		term.loadAddon(fit);
		term.open(element);
		fit.fit();
		terminal.current = term;

		void (async () => {
			const opened = await ipc.openTerminal(null, term.cols, term.rows);
			if (disposed) return;
			if (!opened.ok) {
				setSession({ status: "failed", reason: opened.error.message });
				return;
			}
			const id = opened.value;
			sessionId = id;
			setSession({ status: "running", id });

			const unlisten = await platform.listen<TerminalOutput>(
				TERMINAL_OUTPUT_EVENT,
				(event) => {
					if (event.payload.id === id) term.write(event.payload.chunk);
				},
			);
			cleanups.push(unlisten);

			const unlistenExit = await platform.listen<number>(
				TERMINAL_EXIT_EVENT,
				(event) => {
					if (event.payload === id) {
						sessionId = null;
						setSession({ status: "exited" });
					}
				},
			);
			cleanups.push(unlistenExit);

			const typed = term.onData((data) => {
				void ipc.writeTerminal(id, data);
			});
			cleanups.push(() => typed.dispose());

			// On macOS the native layer owns CJK input, because WebKit does not
			// deliver usable composition events. Committed text arrives here
			// already assembled; the preedit is drawn by the caller.
			const unlistenCommit = await platform.listen<string>(
				IME_COMMIT_EVENT,
				(event) => {
					if (event.payload) void ipc.writeTerminal(id, event.payload);
				},
			);
			cleanups.push(unlistenCommit);

			const unlistenPreedit = await platform.listen<string>(
				IME_PREEDIT_EVENT,
				(event) => {
					setPreedit(
						event.payload
							? { ...cursorBox(term, element), text: event.payload }
							: null,
					);
				},
			);
			cleanups.push(unlistenPreedit);

			// The shell echoes a committed syllable asynchronously, so the anchor
			// taken when composition began is stale by the time the next begins.
			const moved = term.onCursorMove(() => {
				setPreedit((current) =>
					current ? { ...cursorBox(term, element), text: current.text } : null,
				);
			});
			cleanups.push(() => moved.dispose());

			// The pty has to be told the new grid or full-screen programs like vim
			// draw to the wrong dimensions.
			const observer = new ResizeObserver(() => {
				fit.fit();
				void ipc.resizeTerminal(id, term.cols, term.rows);
			});
			observer.observe(element);
			cleanups.push(() => observer.disconnect());

			term.focus();
		})();

		return () => {
			disposed = true;
			for (const cleanup of cleanups) cleanup();
			if (sessionId !== null) void ipc.closeTerminal(sessionId);
			terminal.current?.dispose();
			terminal.current = null;
		};
	}, [host]);

	return { session, preedit };
}
