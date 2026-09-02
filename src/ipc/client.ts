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
};
