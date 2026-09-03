// The contract between `electron/main` and the renderer. Both sides import this
// file, so there is nothing to keep in sync by hand.

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

/** What the main process knows about a pending release. */
export type UpdateInfo = {
	version: string;
	/** The version running right now, so the dialog can show both. */
	currentVersion: string;
	/** Release notes, as shown in the update dialog. */
	body: string | null;
};

/** Progress of an update download, as the renderer's `Update` facade sees it. */
export type DownloadProgress = {
	transferred: number;
	total: number | null;
};

/** Emitted for every chunk a session prints. */
export const TERMINAL_OUTPUT_EVENT = "terminal://output";

/** Emitted once with the session id when its shell has ended. */
export const TERMINAL_EXIT_EVENT = "terminal://exit";

/** Emitted while an update downloads. */
export const UPDATER_PROGRESS_EVENT = "updater://progress";

/**
 * Emitted when the window is about to close. The renderer runs whatever it has
 * to do on the way out and then acknowledges, which is what actually closes it.
 */
export const WINDOW_CLOSE_REQUESTED_EVENT = "window://close-requested";
