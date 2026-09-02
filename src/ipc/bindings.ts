// Contract with `src-tauri/src/commands`. Keep in sync by hand for now.
// ponytail: hand-written contract; generate with tauri-specta once the
// command count makes drift likely (see .claude/rules/architecture.md).

export type WorkspaceInfo = {
	path: string;
	name: string;
	isGitRepo: boolean;
};

export type AppError =
	| { kind: "notFound"; message: string }
	| { kind: "notADirectory"; message: string }
	| { kind: "io"; message: string }
	| { kind: "terminal"; message: string }
	| { kind: "noSuchTerminal"; message: string };

export type TerminalOutput = {
	id: number;
	chunk: string;
};

/** Emitted by the Rust reader thread for every chunk a session prints. */
export const TERMINAL_OUTPUT_EVENT = "terminal://output";

/** Emitted once with the session id when its shell has ended. */
export const TERMINAL_EXIT_EVENT = "terminal://exit";

/** Text an IME has committed natively, bypassing WebKit's broken composition. */
export const IME_COMMIT_EVENT = "ime://commit";

/** Text an IME is still composing. Replaces the previous preedit; "" clears it. */
export const IME_PREEDIT_EVENT = "ime://preedit";
