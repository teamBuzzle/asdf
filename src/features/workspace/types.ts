import type { WorkspaceInfo } from "@/ipc/bindings";

export type OpenState =
	| { status: "idle" }
	| { status: "opening" }
	| { status: "opened"; workspace: WorkspaceInfo }
	| { status: "failed"; reason: string };
