export type SessionStatus = "waiting" | "failed" | "done" | "running" | "idle";

export type ReviewState = "new" | "reviewed" | "reverted";

type FileKind = "added" | "modified" | "deleted";

/** One side-by-side row. A missing side is a blank gutter, not an empty line. */
export type DiffRow = {
	/** Position in the hunk. A diff row has no other stable identity. */
	id: string;
	kind: "same" | "add" | "del" | "change";
	before?: { n: number; text: string };
	after?: { n: number; text: string };
};

export type ChangedFile = {
	path: string;
	kind: FileKind;
	added: number;
	removed: number;
	review: ReviewState;
	rows: DiffRow[];
};

/** Colour in the tree comes from git, the same way an editor does it. */
export type FileStatus = "clean" | "modified" | "added" | "deleted";

export type FileNode =
	| { kind: "dir"; name: string; path: string; children: FileNode[] }
	| { kind: "file"; name: string; path: string; status: FileStatus };

export type Session = {
	id: string;
	title: string;
	/** The project this session runs against. A project holds many sessions. */
	projectId: string;
	branch: string;
	/** Commits this worktree is ahead of and behind the project branch. */
	ahead: number;
	behind: number;
	agent: string;
	status: SessionStatus;
	/** One line naming what the session is stuck on, shown without opening it. */
	blockedOn?: string;
	files: ChangedFile[];
	tree: FileNode[];
	/** Source of files with no diff, so the tree can open anything. */
	sources: Record<string, string[]>;
};

export type Group = {
	id: string;
	name: string;
};

export type Issue = {
	number: number;
	title: string;
	state: "open" | "closed";
	labels: string[];
	author: string;
	body: string;
};

export type PullRequest = {
	number: number;
	title: string;
	state: "open" | "draft" | "merged";
	branch: string;
	ci: "pass" | "fail" | "pending";
	reviewer?: string;
	body: string;
};

/** A repository. The same one can appear in two groups as two projects. */
export type Project = {
	id: string;
	name: string;
	groupId: string;
	/** The branch the local checkout is on, not a session worktree. */
	branch: string;
	/** GitHub belongs to the repository, so it hangs off the project. */
	issues: Issue[];
	pulls: PullRequest[];
};

/** The sidebar is group → project → session, collapsible at both levels. */
type ProjectNode = {
	project: Project;
	sessions: Session[];
	/** True when anything under it is waiting on a person. */
	needsAttention: boolean;
};

export type GroupNode = {
	group: Group;
	projects: ProjectNode[];
	needsAttention: boolean;
};

/** A tab. Sessions and files belong to a session; issues and pull requests
 *  belong to the project, so they carry no session. */
export type Pane =
	| { kind: "session"; id: string; sessionId: string }
	| { kind: "file"; id: string; sessionId: string; path: string }
	| { kind: "issue"; id: string; number: number }
	| { kind: "pull"; id: string; number: number };
