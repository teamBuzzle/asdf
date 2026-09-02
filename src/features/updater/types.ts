import type { Update } from "@/ipc/platform";

/** Why an update attempt failed. `signature` is deliberately separate: it is the
 * one class that must never offer a retry, because retrying a failed signature
 * check is exactly what a tampered download needs you to do. */
export type UpdateFailure = "offline" | "download" | "install" | "signature";

export type UpdateState =
	| { status: "idle" }
	| { status: "checking" }
	| { status: "upToDate" }
	| { status: "available"; update: Update; dismissed: boolean }
	| {
			status: "downloading";
			update: Update;
			received: number;
			total: number | null;
	  }
	| { status: "ready"; update: Update; deferred: boolean }
	| { status: "error"; failure: UpdateFailure; version: string | null };

/** Automatic checks stay silent unless there is something to act on. A failed
 * background check on a plane is not news. */
export function isVisible(state: UpdateState): boolean {
	switch (state.status) {
		case "available":
		case "downloading":
		case "ready":
			return true;
		case "error":
			return state.failure !== "offline";
		default:
			return false;
	}
}
