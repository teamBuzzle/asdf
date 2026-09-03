import { statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type IPty, spawn } from "node-pty";
import type { AppError } from "@/ipc/bindings";
import { fail, type IpcResult, ok } from "./result";

/**
 * The shell to spawn for a new session.
 *
 * Unix honours `$SHELL`, which is what the user actually chose in their account
 * settings. Windows has no such variable, so it prefers PowerShell 7 when it is
 * installed and otherwise falls back to the Windows PowerShell that ships with
 * the OS.
 */
function defaultShell(): string {
	if (process.platform !== "win32") return process.env.SHELL || "/bin/sh";
	return which("pwsh.exe") ? "pwsh.exe" : "powershell.exe";
}

function which(program: string): boolean {
	const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
	return dirs.some((dir) => {
		try {
			return statSync(path.join(dir, program)).isFile();
		} catch {
			return false;
		}
	});
}

type Listeners = {
	onOutput: (id: number, chunk: string) => void;
	onExit: (id: number) => void;
};

/**
 * Every live pty, addressed by the id the frontend holds.
 *
 * node-pty reports the shell ending through its own `onExit`, so unlike the pty
 * layer this replaces there is no reader thread to watch for EOF, and no
 * platform where that signal fails to arrive.
 */
export class Registry {
	private readonly sessions = new Map<number, IPty>();
	private nextId = 0;

	open(
		cwd: string | null,
		cols: number,
		rows: number,
		{ onOutput, onExit }: Listeners,
	): IpcResult<number> {
		const id = this.nextId++;
		try {
			const pty = spawn(defaultShell(), [], {
				cols,
				rows,
				cwd: cwd ?? os.homedir(),
				// Programs check TERM to decide what escape sequences they may emit.
				// Without it many fall back to a dumb terminal with no colour.
				env: { ...process.env, TERM: "xterm-256color" },
			});

			pty.onData((chunk) => onOutput(id, chunk));
			pty.onExit(() => {
				// Whoever removes the entry owns the notification, so a session closed
				// through `close` stays silent.
				if (this.sessions.delete(id)) onExit(id);
			});

			this.sessions.set(id, pty);
			return ok(id);
		} catch (thrown) {
			return fail(terminalError(thrown));
		}
	}

	write(id: number, data: string): IpcResult<null> {
		const pty = this.sessions.get(id);
		if (!pty) return fail(noSuchTerminal(id));
		try {
			pty.write(data);
			return ok(null);
		} catch (thrown) {
			return fail(terminalError(thrown));
		}
	}

	resize(id: number, cols: number, rows: number): IpcResult<null> {
		const pty = this.sessions.get(id);
		if (!pty) return fail(noSuchTerminal(id));
		try {
			pty.resize(cols, rows);
			return ok(null);
		} catch (thrown) {
			return fail(terminalError(thrown));
		}
	}

	/** The shell's process id, for asking the OS where it is. */
	pid(id: number): number | null {
		return this.sessions.get(id)?.pid ?? null;
	}

	close(id: number): IpcResult<null> {
		const pty = this.sessions.get(id);
		if (pty) {
			this.sessions.delete(id);
			try {
				pty.kill();
			} catch {
				// Already gone; the caller asked for it closed either way.
			}
		}
		return ok(null);
	}

	/** Ends every session, so quitting cannot leave a shell behind. */
	closeAll(): void {
		for (const id of [...this.sessions.keys()]) this.close(id);
	}
}

function noSuchTerminal(id: number): AppError {
	return { kind: "noSuchTerminal", message: String(id) };
}

function terminalError(thrown: unknown): AppError {
	return {
		kind: "terminal",
		message: thrown instanceof Error ? thrown.message : String(thrown),
	};
}
