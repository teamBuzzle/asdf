import type { AppError } from "@/ipc/bindings";

/**
 * What every command handler returns. The renderer's `ipc.call` passes it
 * straight through, so a failure is a value on both sides rather than a
 * rejection that has to be re-parsed.
 */
export type IpcResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: AppError };

export function ok<T>(value: T): IpcResult<T> {
	return { ok: true, value };
}

export function fail<T>(error: AppError): IpcResult<T> {
	return { ok: false, error };
}
