import { useCallback, useEffect, useRef, useState } from "react";
import { ipc } from "@/ipc/client";
import type { Issue, PullRequest, RepoSnapshot, ReviewState } from "./types";

// ponytail: polling, 3 s. A watcher would be instant and is what an editor
// does; add chokidar when the delay is felt.
const POLL_MS = 3000;

/** What git and gh say about the folder the shell is in, kept fresh. */
export function useRepo(cwd: string | null) {
	const [snapshot, setSnapshot] = useState<RepoSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [issues, setIssues] = useState<Issue[]>([]);
	const [pulls, setPulls] = useState<PullRequest[]>([]);
	const [github, setGithub] = useState<string | null>(null);
	// Review marks are the reader's, not git's, so they live here keyed by
	// repository and file and survive a refresh.
	const [reviews, setReviews] = useState<Record<string, ReviewState>>({});
	const root = snapshot?.root ?? null;
	const seen = useRef<string | null>(null);

	const refreshGit = useCallback(async () => {
		if (!cwd) return;
		const result = await ipc.repoSnapshot(cwd);
		if (result.ok) {
			setSnapshot(result.value);
			setError(null);
		} else setError(result.error.message);
	}, [cwd]);

	// GitHub is a network away and changes slowly, so it is read when the
	// repository changes and when asked, not on the git cadence.
	const refreshGithub = useCallback(async () => {
		if (!root) return;
		const [issued, pulled] = await Promise.all([
			ipc.repoIssues(root),
			ipc.repoPulls(root),
		]);
		setIssues(issued.ok ? issued.value : []);
		setPulls(pulled.ok ? pulled.value : []);
		setGithub(
			issued.ok
				? pulled.ok
					? null
					: pulled.error.message
				: issued.error.message,
		);
	}, [root]);

	useEffect(() => {
		if (!cwd) {
			setSnapshot(null);
			return;
		}
		void refreshGit();
		const timer = setInterval(() => void refreshGit(), POLL_MS);
		return () => clearInterval(timer);
	}, [cwd, refreshGit]);

	useEffect(() => {
		if (root === seen.current) return;
		seen.current = root;
		if (!root) {
			setIssues([]);
			setPulls([]);
			setGithub(null);
			return;
		}
		void refreshGithub();
	}, [root, refreshGithub]);

	const review = useCallback(
		async (file: string, state: ReviewState) => {
			if (!root) return;
			if (state === "reverted") {
				const result = await ipc.repoRevert(root, file);
				if (!result.ok) {
					setError(result.error.message);
					return;
				}
				void refreshGit();
			}
			setReviews((previous) => ({ ...previous, [`${root}:${file}`]: state }));
		},
		[root, refreshGit],
	);

	const commit = useCallback(
		async (message: string) => {
			if (!root) return false;
			const result = await ipc.repoCommit(root, message);
			if (!result.ok) {
				setError(result.error.message);
				return false;
			}
			void refreshGit();
			return true;
		},
		[root, refreshGit],
	);

	const reviewOf = (file: string): ReviewState =>
		reviews[`${root}:${file}`] ?? "new";

	return {
		snapshot,
		error,
		issues,
		pulls,
		github,
		reviewOf,
		review,
		commit,
		refreshGithub,
	};
}
