import { contextBridge, ipcRenderer } from "electron";

/**
 * The whole surface the renderer gets. Commands go one way and return a result;
 * events come back on named channels. Nothing else from Electron is exposed —
 * `src/ipc` is the only module that may touch even this much.
 */
const bridge = {
	invoke: (command: string, args?: Record<string, unknown>): Promise<unknown> =>
		ipcRenderer.invoke(command, args ?? {}),

	on: (channel: string, handler: (payload: unknown) => void): (() => void) => {
		const listener = (_event: unknown, payload: unknown) => handler(payload);
		ipcRenderer.on(channel, listener);
		return () => ipcRenderer.removeListener(channel, listener);
	},
};

contextBridge.exposeInMainWorld("asdf", bridge);

export type Bridge = typeof bridge;
