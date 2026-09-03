// Everything the app uses from the desktop shell. Features import from here so
// the preload bridge stays confined to this layer — see
// .claude/rules/architecture.md.
import {
	type DownloadProgress,
	UPDATER_PROGRESS_EVENT,
	type UpdateInfo,
	WINDOW_CLOSE_REQUESTED_EVENT,
} from "./bindings";
import { bridge } from "./bridge";
import { call } from "./client";

export type UnlistenFn = () => void;

/** Mirrors the shape the updater feature consumes for a download in flight. */
type DownloadEvent =
	| { event: "Started"; data: { contentLength: number | null } }
	| { event: "Progress"; data: { chunkLength: number } }
	| { event: "Finished" };

/**
 * A release the app can move to. `download` and `install` are separate so a
 * ready update can wait for the moment the user picks, including on quit.
 */
export type Update = {
	version: string;
	currentVersion: string;
	body: string | null;
	download(onEvent: (event: DownloadEvent) => void): Promise<void>;
	install(): Promise<void>;
};

function unwrap<T>(
	result: { ok: true; value: T } | { ok: false; error: { message: string } },
): T {
	if (result.ok) return result.value;
	throw new Error(result.error.message);
}

function listen<T>(
	channel: string,
	handler: (event: { payload: T }) => void,
): Promise<UnlistenFn> {
	return Promise.resolve(
		bridge.on(channel, (payload) => handler({ payload: payload as T })),
	);
}

function toUpdate(info: UpdateInfo): Update {
	return {
		version: info.version,
		currentVersion: info.currentVersion,
		body: info.body,

		async download(onEvent) {
			// electron-updater reports a running total; the caller counts deltas, so
			// translate one into the other rather than change the caller.
			let seen = 0;
			let started = false;
			const off = bridge.on(UPDATER_PROGRESS_EVENT, (payload) => {
				const { transferred, total } = payload as DownloadProgress;
				if (!started) {
					started = true;
					onEvent({ event: "Started", data: { contentLength: total } });
				}
				const chunkLength = Math.max(0, transferred - seen);
				seen = transferred;
				onEvent({ event: "Progress", data: { chunkLength } });
			});
			try {
				unwrap(await call<null>("updater://download"));
				onEvent({ event: "Finished" });
			} finally {
				off();
			}
		},

		async install() {
			unwrap(await call<null>("updater://install"));
		},
	};
}

/** Handlers to run before the window is allowed to close. */
const closeHandlers = new Set<() => Promise<void> | void>();

// Registered once, for the lifetime of the renderer: the main process holds the
// window open until this acknowledges, so the acknowledgement cannot depend on
// any particular feature having mounted.
bridge.on(WINDOW_CLOSE_REQUESTED_EVENT, () => {
	void (async () => {
		for (const handler of closeHandlers) {
			try {
				await handler();
			} catch {
				// One feature failing on the way out must not strand the window.
			}
		}
		await call<null>("window://close-ack");
	})();
});

export const platform = {
	checkForUpdate: async (): Promise<Update | null> => {
		const info = unwrap(await call<UpdateInfo | null>("updater://check"));
		return info ? toUpdate(info) : null;
	},

	relaunch: async (): Promise<void> => {
		unwrap(await call<null>("app://relaunch"));
	},

	openExternal: async (url: string): Promise<void> => {
		unwrap(await call<null>("shell://open-external", { url }));
	},

	/** The renderer draws its own window controls; these are what they do. */
	window: {
		minimize: () => void call<null>("window://minimize"),
		maximize: () => void call<null>("window://maximize"),
		close: () => void call<null>("window://close"),
	},

	/**
	 * macOS draws its own traffic lights over the title bar, so the renderer
	 * leaves room for them and draws no controls of its own there.
	 */
	isMac: navigator.userAgent.includes("Macintosh"),

	onWindowClose: (handler: () => Promise<void> | void): Promise<UnlistenFn> => {
		closeHandlers.add(handler);
		return Promise.resolve(() => closeHandlers.delete(handler));
	},

	listen,
};
