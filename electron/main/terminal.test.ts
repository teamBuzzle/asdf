import { afterEach, describe, expect, it } from "vitest";
import { Registry } from "./terminal";

/**
 * Every registry a test opens, so a failed assertion cannot leave a shell — and
 * on Windows a console host — running after the run finishes.
 */
const open: Registry[] = [];

function registry(): Registry {
	const created = new Registry();
	open.push(created);
	return created;
}

afterEach(() => {
	for (const one of open.splice(0)) one.closeAll();
});

/**
 * Resolves once the session has printed `marker` `times` over, or rejects on the
 * deadline.
 *
 * A pty echoes what is typed into it, so a command and its output both carry the
 * marker. Waiting for the second occurrence is what distinguishes "the shell ran
 * it" from "the shell heard it".
 */
function waits(marker: string, times = 1) {
	let seen = "";
	let settle: ((value: string) => void) | null = null;
	const reached = new Promise<string>((resolve, reject) => {
		settle = resolve;
		setTimeout(
			() =>
				reject(
					new Error(`saw ${marker} fewer than ${times} times in: ${seen}`),
				),
			15000,
		).unref();
	});
	return {
		reached,
		onOutput(_id: number, chunk: string) {
			seen += chunk;
			if (seen.split(marker).length - 1 >= times) settle?.(seen);
		},
	};
}

function id(result: ReturnType<Registry["open"]>): number {
	if (!result.ok) throw new Error(result.error.message);
	return result.value;
}

describe("Registry", () => {
	it("rejects an unknown session", () => {
		const result = registry().write(999, "x");
		expect(result).toMatchObject({
			ok: false,
			error: { kind: "noSuchTerminal", message: "999" },
		});
	});

	it("runs a command and returns its output", async () => {
		const sessions = registry();
		const watch = waits("asdf-pty-ok", 2);
		const session = id(
			sessions.open(null, 80, 24, {
				onOutput: watch.onOutput,
				onExit: () => {},
			}),
		);

		// Written after the shell has had a moment to start reading, since input
		// sent into a pty before its client attaches is not guaranteed to survive.
		await new Promise((resolve) => setTimeout(resolve, 1500));
		expect(sessions.write(session, "echo asdf-pty-ok\r").ok).toBe(true);

		await expect(watch.reached).resolves.toContain("asdf-pty-ok");
	});

	/**
	 * Guards the chunk boundary: Hangul is three bytes per syllable, so a read
	 * splits one sooner or later and a broken decoder shows replacement
	 * characters.
	 */
	it("round-trips Hangul", async () => {
		const sessions = registry();
		const watch = waits("안녕하세요-테스트", 2);
		const session = id(
			sessions.open(null, 80, 24, {
				onOutput: watch.onOutput,
				onExit: () => {},
			}),
		);

		await new Promise((resolve) => setTimeout(resolve, 1500));
		sessions.write(session, "echo 안녕하세요-테스트\r");

		const output = await watch.reached;
		expect(output).not.toContain("�");
	});

	it("reports the shell exiting", async () => {
		const sessions = registry();
		let exited: number | null = null;
		const ended = new Promise<void>((resolve, reject) => {
			setTimeout(
				() => reject(new Error("exit was never reported")),
				15000,
			).unref();
			const session = id(
				sessions.open(null, 80, 24, {
					onOutput: () => {},
					onExit: (which) => {
						exited = which;
						resolve();
					},
				}),
			);
			setTimeout(() => sessions.write(session, "exit\r"), 1500);
		});

		await ended;
		expect(exited).toBe(0);
	});

	it("stays silent when the caller closes the session", async () => {
		const sessions = registry();
		let reported = false;
		const session = id(
			sessions.open(null, 80, 24, {
				onOutput: () => {},
				onExit: () => {
					reported = true;
				},
			}),
		);

		await new Promise((resolve) => setTimeout(resolve, 1500));
		expect(sessions.close(session).ok).toBe(true);

		// Long enough for the pty to have exited and any callback to have run.
		await new Promise((resolve) => setTimeout(resolve, 2000));
		expect(reported).toBe(false);
		expect(sessions.write(session, "x")).toMatchObject({
			ok: false,
			error: { kind: "noSuchTerminal" },
		});
	});
});
