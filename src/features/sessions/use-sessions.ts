import { useCallback, useMemo, useState } from "react";
import { mockGroups, mockProjects, mockSessions } from "./mock";
import type {
	Group,
	GroupNode,
	Pane,
	Project,
	ReviewState,
	Session,
	SessionStatus,
} from "./types";

// Sorting is what replaces a separate board screen: whatever wants a person
// floats up, so "what needs me" is answered by the list already on screen.
const rank: Record<SessionStatus, number> = {
	waiting: 0,
	failed: 1,
	done: 2,
	running: 3,
	idle: 4,
};

function needsAttention(session: Session): boolean {
	if (session.status === "waiting" || session.status === "failed") return true;
	return (
		session.status === "done" &&
		session.files.some((file) => file.review === "new")
	);
}

function urgency(sessions: Session[]): number {
	return sessions.length === 0
		? Number.MAX_SAFE_INTEGER
		: Math.min(...sessions.map((session) => rank[session.status]));
}

/** group → project → session, each level sorted by how much it wants a person. */
function buildTree(
	sessions: Session[],
	projects: Project[],
	groups: Group[],
): GroupNode[] {
	const projectNodes = projects.map((project) => {
		const own = sessions
			.filter((session) => session.projectId === project.id)
			.sort(
				(a, b) =>
					rank[a.status] - rank[b.status] || a.title.localeCompare(b.title),
			);
		return { project, sessions: own, needsAttention: own.some(needsAttention) };
	});

	return groups
		.map((group) => ({
			group,
			projects: projectNodes
				.filter((node) => node.project.groupId === group.id)
				.sort(
					(a, b) =>
						urgency(a.sessions) - urgency(b.sessions) ||
						a.project.name.localeCompare(b.project.name),
				),
		}))
		.filter((node) => node.projects.length > 0)
		.map((node) => ({
			...node,
			needsAttention: node.projects.some((child) => child.needsAttention),
		}))
		.sort(
			(a, b) =>
				urgency(a.projects.flatMap((node) => node.sessions)) -
					urgency(b.projects.flatMap((node) => node.sessions)) ||
				a.group.name.localeCompare(b.group.name),
		);
}

export type NewProjectInput = {
	name: string;
	groupName: string;
};

export type NewSessionInput = {
	projectId: string;
	title: string;
	agent: string;
};

/** A project is a window; its tabs live with it and nowhere else. */
type Window = { panes: Pane[]; activeId: string };

export function useSessions() {
	const [sessions, setSessions] = useState<Session[]>(mockSessions);
	const [projects, setProjects] = useState<Project[]>(mockProjects);
	const [groups, setGroups] = useState<Group[]>(mockGroups);
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
	const [activeProjectId, setActiveProjectId] = useState("p1");
	const [windows, setWindows] = useState<Record<string, Window>>({
		p1: {
			panes: [{ kind: "session", id: "session:s1", sessionId: "s1" }],
			activeId: "session:s1",
		},
	});

	const tree = useMemo(
		() => buildTree(sessions, projects, groups),
		[sessions, projects, groups],
	);

	const window = windows[activeProjectId];
	const panes = window?.panes ?? [];
	const activeId = window?.activeId ?? "";

	// The explorer follows the open tab of the project you are in. Issue and
	// pull request tabs carry no session, so it keeps the last one that did.
	const withSession = panes.filter(
		(pane) => pane.kind === "session" || pane.kind === "file",
	);
	const activeSessionId =
		withSession.find((pane) => pane.id === activeId)?.sessionId ??
		withSession[withSession.length - 1]?.sessionId;
	const activeSession = sessions.find(
		(session) => session.id === activeSessionId,
	);
	const activeProject = projects.find(
		(project) => project.id === activeProjectId,
	);
	const projectSessions = useMemo(
		() => sessions.filter((session) => session.projectId === activeProjectId),
		[sessions, activeProjectId],
	);

	const openIn = useCallback((projectId: string, pane: Pane) => {
		setActiveProjectId(projectId);
		setWindows((previous) => {
			const current = previous[projectId] ?? { panes: [], activeId: "" };
			const panes = current.panes.some((item) => item.id === pane.id)
				? current.panes
				: [...current.panes, pane];
			return { ...previous, [projectId]: { panes, activeId: pane.id } };
		});
	}, []);

	const openSession = useCallback(
		(sessionId: string) => {
			const session = sessions.find((item) => item.id === sessionId);
			if (!session) return;
			openIn(session.projectId, {
				kind: "session",
				id: `session:${sessionId}`,
				sessionId,
			});
		},
		[sessions, openIn],
	);

	const openFile = useCallback(
		(sessionId: string, path: string) => {
			const session = sessions.find((item) => item.id === sessionId);
			if (!session) return;
			openIn(session.projectId, {
				kind: "file",
				id: `file:${sessionId}:${path}`,
				sessionId,
				path,
			});
		},
		[sessions, openIn],
	);

	// Issues and pull requests belong to the project, so they open in its window
	// without a session behind them.
	const openIssue = useCallback(
		(number: number) => {
			openIn(activeProjectId, {
				kind: "issue",
				id: `issue:${activeProjectId}:${number}`,
				number,
			});
		},
		[activeProjectId, openIn],
	);

	const openPull = useCallback(
		(number: number) => {
			openIn(activeProjectId, {
				kind: "pull",
				id: `pull:${activeProjectId}:${number}`,
				number,
			});
		},
		[activeProjectId, openIn],
	);

	const focusPane = useCallback(
		(id: string) => {
			setWindows((previous) => {
				const current = previous[activeProjectId];
				if (!current) return previous;
				return {
					...previous,
					[activeProjectId]: { ...current, activeId: id },
				};
			});
		},
		[activeProjectId],
	);

	const closePane = useCallback(
		(id: string) => {
			setWindows((previous) => {
				const current = previous[activeProjectId];
				if (!current) return previous;
				const panes = current.panes.filter((pane) => pane.id !== id);
				const activeId =
					current.activeId === id
						? (panes[panes.length - 1]?.id ?? "")
						: current.activeId;
				return { ...previous, [activeProjectId]: { panes, activeId } };
			});
		},
		[activeProjectId],
	);

	const toggleNode = useCallback((key: string) => {
		setCollapsed((previous) => {
			const next = new Set(previous);
			if (!next.delete(key)) next.add(key);
			return next;
		});
	}, []);

	const review = useCallback(
		(sessionId: string, path: string, state: ReviewState) => {
			setSessions((previous) =>
				previous.map((session) =>
					session.id === sessionId
						? {
								...session,
								files: session.files.map((file) =>
									file.path === path ? { ...file, review: state } : file,
								),
							}
						: session,
				),
			);
		},
		[],
	);

	// A project is made first; sessions are made inside one. The same repository
	// under another group is a different project, which is why this matches both.
	const createProject = useCallback(
		(input: NewProjectInput) => {
			const groupName = input.groupName.trim() || "미분류";
			const name = input.name.trim();

			const group = groups.find((item) => item.name === groupName);
			const groupId = group?.id ?? `g${Date.now()}`;
			if (!group)
				setGroups((previous) => [
					...previous,
					{ id: groupId, name: groupName },
				]);

			const project = projects.find(
				(item) => item.name === name && item.groupId === groupId,
			);
			if (project) {
				setActiveProjectId(project.id);
				return;
			}

			const id = `p${Date.now()}`;
			setProjects((previous) => [
				...previous,
				// Real branches come from git; a fresh checkout is on its default.
				{ id, name, groupId, branch: "main", issues: [], pulls: [] },
			]);
			setActiveProjectId(id);
		},
		[groups, projects],
	);

	const createSession = useCallback(
		(input: NewSessionInput) => {
			const id = `s${Date.now()}`;
			setSessions((previous) => [
				{
					id,
					title: input.title.trim(),
					projectId: input.projectId,
					branch: slugify(input.title),
					ahead: 0,
					behind: 0,
					agent: input.agent,
					status: "idle",
					files: [],
					tree: [],
					sources: {},
				},
				...previous,
			]);
			openIn(input.projectId, {
				kind: "session",
				id: `session:${id}`,
				sessionId: id,
			});
		},
		[openIn],
	);

	return {
		sessions,
		groups,
		projects,
		tree,
		collapsed,
		toggleNode,
		panes,
		activeId,
		activeProjectId,
		selectProject: setActiveProjectId,
		focusPane,
		activeSession,
		activeProject,
		projectSessions,
		openSession,
		openFile,
		openIssue,
		openPull,
		closePane,
		review,
		createProject,
		createSession,
	};
}

// Branch names come from the one thing the dialog asks for, so nobody types one.
function slugify(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);
	return `feature/${slug || "session"}`;
}
