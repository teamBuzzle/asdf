import { produce } from "immer";
import { useCallback, useState } from "react";
import { z } from "zod";
import type { WorkspaceInfo } from "@/ipc/bindings";
import { ipc } from "@/ipc/client";
import type { OpenState } from "./types";

const pathInput = z.string().trim().min(1, "Enter a path").max(4096);

export function useWorkspaces() {
	const [state, setState] = useState<OpenState>({ status: "idle" });
	const [recent, setRecent] = useState<WorkspaceInfo[]>([]);

	const open = useCallback(async (raw: string) => {
		const parsed = pathInput.safeParse(raw);
		if (!parsed.success) {
			setState({ status: "failed", reason: parsed.error.issues[0].message });
			return null;
		}

		setState({ status: "opening" });
		const result = await ipc.openWorkspace(parsed.data);
		if (!result.ok) {
			setState({ status: "failed", reason: result.error.message });
			return null;
		}

		setState({ status: "opened", workspace: result.value });
		setRecent(
			produce((list: WorkspaceInfo[]) => {
				const existing = list.findIndex(
					(item) => item.path === result.value.path,
				);
				if (existing !== -1) list.splice(existing, 1);
				list.unshift(result.value);
				if (list.length > 5) list.pop();
			}),
		);
		return result.value;
	}, []);

	return { state, recent, open };
}
