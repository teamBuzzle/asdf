import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import type { WorkspaceInfo } from "@/ipc/bindings";
import { fail, type IpcResult, ok } from "./result";

// What the checkout is on, read the way git itself stores it: a ref name, or
// a bare commit when detached. No git binary needed, so it works before the
// user has one on PATH.
function branchOf(root: string): string | null {
	try {
		const head = readFileSync(path.join(root, ".git", "HEAD"), "utf8").trim();
		return head.startsWith("ref: refs/heads/")
			? head.slice("ref: refs/heads/".length)
			: head.slice(0, 7);
	} catch {
		return null;
	}
}

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
			branch: branchOf(resolved),
		});
	} catch (thrown) {
		return fail({
			kind: "io",
			message: thrown instanceof Error ? thrown.message : String(thrown),
		});
	}
}
