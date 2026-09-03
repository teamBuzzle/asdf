import { useCallback, useEffect, useRef, useState } from "react";
import { platform, type Update } from "@/ipc/platform";
import type { UpdateFailure, UpdateState } from "./types";

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

// A failed integrity check means this version is not worth retrying, however it
// is worded: Tauri called it a signature, electron-updater calls it a checksum.
function classify(thrown: unknown): UpdateFailure {
	return /signature|verif|checksum|sha\d/i.test(String(thrown))
		? "signature"
		: "offline";
}

export function useUpdater() {
	const [state, setState] = useState<UpdateState>({ status: "idle" });
	const [open, setOpen] = useState(false);
	// A version that failed signature verification is not retried for the rest of
	// the session, however many times the poll comes back around.
	const blocked = useRef<Set<string>>(new Set());
	const deferred = useRef<Update | null>(null);

	const runCheck = useCallback(async (userInitiated: boolean) => {
		setState({ status: "checking" });
		try {
			const update = await platform.checkForUpdate();
			if (!update || blocked.current.has(update.version)) {
				setState({ status: "upToDate" });
				return;
			}
			setState({ status: "available", update, dismissed: !userInitiated });
			if (userInitiated) setOpen(true);
		} catch (thrown) {
			setState({ status: "error", failure: classify(thrown), version: null });
			if (userInitiated) setOpen(true);
		}
	}, []);

	const download = useCallback(
		async (state: Extract<UpdateState, { status: "available" }>) => {
			const { update } = state;
			setState({ status: "downloading", update, received: 0, total: null });
			let received = 0;
			try {
				await update.download((event) => {
					if (event.event === "Started") {
						setState({
							status: "downloading",
							update,
							received: 0,
							total: event.data.contentLength ?? null,
						});
					} else if (event.event === "Progress") {
						received += event.data.chunkLength;
						setState((prev) =>
							prev.status === "downloading" ? { ...prev, received } : prev,
						);
					}
				});
				setState({ status: "ready", update, deferred: false });
			} catch (thrown) {
				const failure = classify(thrown);
				if (failure === "signature") blocked.current.add(update.version);
				setState({
					status: "error",
					failure: failure === "signature" ? "signature" : "download",
					version: update.version,
				});
				setOpen(true);
			}
		},
		[],
	);

	const installNow = useCallback(
		async (state: Extract<UpdateState, { status: "ready" }>) => {
			try {
				await state.update.install();
				await platform.relaunch();
			} catch (thrown) {
				if (classify(thrown) === "signature")
					blocked.current.add(state.update.version);
				setState({
					status: "error",
					failure: "install",
					version: state.update.version,
				});
				setOpen(true);
			}
		},
		[],
	);

	const installOnQuit = useCallback(
		(state: Extract<UpdateState, { status: "ready" }>) => {
			deferred.current = state.update;
			setState({ status: "ready", update: state.update, deferred: true });
			setOpen(false);
		},
		[],
	);

	// Deferred installs happen on the way out, which is the whole point: the user
	// picked the moment, not a countdown.
	useEffect(() => {
		const unlisten = platform.onWindowClose(async () => {
			if (deferred.current)
				await deferred.current.install().catch(() => undefined);
		});
		return () => {
			unlisten.then((off) => off()).catch(() => undefined);
		};
	}, []);

	useEffect(() => {
		void runCheck(false);
		const timer = setInterval(() => void runCheck(false), POLL_INTERVAL_MS);
		return () => clearInterval(timer);
	}, [runCheck]);

	return {
		state,
		open,
		setOpen,
		runCheck,
		download,
		installNow,
		installOnQuit,
	};
}
