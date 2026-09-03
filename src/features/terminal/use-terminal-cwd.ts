import { useEffect, useState } from "react";
import { ipc } from "@/ipc/client";

// ponytail: polling, 1.5 s. Shell integration (OSC 7) would be exact and
// instant; add it when a shell that emits it is common among users.
const POLL_MS = 1500;

/** Where the shell behind a terminal is, re-asked often enough to follow a
 *  `cd`. Null until the first answer, and for terminals that have none. */
export function useTerminalCwd(ptyId: number | null): string | null {
	const [cwd, setCwd] = useState<string | null>(null);

	useEffect(() => {
		if (ptyId === null) {
			setCwd(null);
			return;
		}
		let alive = true;
		const ask = async () => {
			const result = await ipc.terminalCwd(ptyId);
			if (alive && result.ok && result.value) setCwd(result.value);
		};
		void ask();
		const timer = setInterval(() => void ask(), POLL_MS);
		return () => {
			alive = false;
			clearInterval(timer);
		};
	}, [ptyId]);

	return cwd;
}
