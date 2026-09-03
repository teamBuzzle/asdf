import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import type { WorkspaceInfo } from "@/ipc/bindings";
import { fail, type IpcResult, ok } from "./result";

export function open(raw: string): IpcResult<WorkspaceInfo> {
	if (!existsSync(raw)) return fail({ kind: "notFound", message: raw });
	if (!statSync(raw).isDirectory())
		return fail({ kind: "notADirectory", message: raw });

	try {
		const resolved = realpathSync(raw);
		return ok({
			path: resolved,
			name: path.basename(resolved),
			isGitRepo: existsSync(path.join(resolved, ".git")),
		});
	} catch (thrown) {
		return fail({
			kind: "io",
			message: thrown instanceof Error ? thrown.message : String(thrown),
		});
	}
}
