import { invoke } from "@tauri-apps/api/core";
import type { AppError, WorkspaceInfo } from "./bindings";

export type IpcResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: AppError };

function toAppError(thrown: unknown): AppError {
	if (typeof thrown === "object" && thrown !== null && "kind" in thrown) {
		return thrown as AppError;
	}
	return { kind: "io", message: String(thrown) };
}

async function call<T>(
	command: string,
	args?: Record<string, unknown>,
): Promise<IpcResult<T>> {
	try {
		return { ok: true, value: await invoke<T>(command, args) };
	} catch (thrown) {
		return { ok: false, error: toAppError(thrown) };
	}
}

export const ipc = {
	openWorkspace: (path: string) =>
		call<WorkspaceInfo>("open_workspace", { path }),
	openTerminal: (cwd: string | null, cols: number, rows: number) =>
		call<number>("open_terminal", { cwd, cols, rows }),
	writeTerminal: (id: number, data: string) =>
		call<void>("write_terminal", { id, data }),
	resizeTerminal: (id: number, cols: number, rows: number) =>
		call<void>("resize_terminal", { id, cols, rows }),
	closeTerminal: (id: number) => call<void>("close_terminal", { id }),
};
