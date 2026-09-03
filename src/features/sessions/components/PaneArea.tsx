import {
	Check,
	Circle,
	CircleDot,
	FileCode2,
	GitBranch,
	GitPullRequest,
	type LucideIcon,
	Pause,
	Play,
	Plus,
	TerminalSquare,
	Undo2,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
	Pane,
	Project,
	ReviewState,
	Session,
	SessionStatus,
} from "../types";
import { DiffView, SourceView } from "./CodeView";

const statusIcon: Record<SessionStatus, LucideIcon> = {
	waiting: Pause,
	failed: X,
	done: Check,
	running: Play,
	idle: Circle,
};

const statusTone: Record<SessionStatus, string> = {
	waiting: "text-amber-600 dark:text-amber-500",
	failed: "text-destructive",
	done: "text-emerald-600 dark:text-emerald-500",
	running: "text-sky-600 dark:text-sky-500",
	idle: "text-muted-foreground/60",
};

const tabIcon: Record<Pane["kind"], LucideIcon> = {
	session: TerminalSquare,
	file: FileCode2,
	issue: CircleDot,
	pull: GitPullRequest,
};

function tabLabel(pane: Pane, sessions: Session[]): string {
	switch (pane.kind) {
		case "session":
			return sessions.find((item) => item.id === pane.sessionId)?.title ?? "";
		case "file":
			return pane.path.split("/").pop() ?? pane.path;
		default:
			return `#${pane.number}`;
	}
}

type Props = {
	panes: Pane[];
	sessions: Session[];
	project?: Project;
	/** Sessions of the project whose window is open, for the empty state. */
	projectSessions: Session[];
	activeId: string;
	onFocus: (id: string) => void;
	onClose: (id: string) => void;
	onOpenSession: (sessionId: string) => void;
	onNewSession: () => void;
	/** Owned by the terminal work. Rendered for the open session tab. */
	renderAgent: (session: Session) => ReactNode;
	onReview: (sessionId: string, path: string, state: ReviewState) => void;
};

export function PaneArea({
	panes,
	sessions,
	project,
	projectSessions,
	activeId,
	onFocus,
	onClose,
	onOpenSession,
	onNewSession,
	renderAgent,
	onReview,
}: Props) {
	const { t } = useTranslation();
	const active = panes.find((pane) => pane.id === activeId) ?? panes[0];
	const sessionId =
		active && (active.kind === "session" || active.kind === "file")
			? active.sessionId
			: undefined;
	const session = sessions.find((item) => item.id === sessionId);

	return (
		<div className="flex min-w-0 flex-1 flex-col">
			{/* One strip of tabs, browser-style: a tab is a session, a file, an issue
			    or a pull request, and the + at the end starts another. It stays on
			    screen with no tabs so the + is always reachable. */}
			<div className="flex shrink-0 items-end gap-px overflow-x-auto border-b bg-muted/40 px-1 pt-1">
				{panes.map((pane) => (
					<Tab
						key={pane.id}
						pane={pane}
						label={tabLabel(pane, sessions)}
						active={pane.id === active?.id}
						onFocus={() => onFocus(pane.id)}
						onClose={() => onClose(pane.id)}
					/>
				))}

				<Button
					size="icon"
					variant="ghost"
					aria-label={t("session.newSession")}
					onClick={onNewSession}
					className="mb-1 ml-1 size-6 shrink-0"
				>
					<Plus className="size-3.5" />
				</Button>
			</div>

			{!active ? (
				<NewTabPage sessions={projectSessions} onOpenSession={onOpenSession} />
			) : active.kind === "issue" ? (
				<IssueBody project={project} number={active.number} />
			) : active.kind === "pull" ? (
				<PullBody project={project} number={active.number} />
			) : !session ? (
				<NewTabPage sessions={projectSessions} onOpenSession={onOpenSession} />
			) : active.kind === "session" ? (
				<SessionBody session={session}>{renderAgent(session)}</SessionBody>
			) : (
				<FileBody session={session} path={active.path} onReview={onReview} />
			)}
		</div>
	);
}

// A window with no tabs shows what it could open, the way a browser's new tab
// page does. Without it a project's sessions would have nowhere to be reached.
function NewTabPage({
	sessions,
	onOpenSession,
}: {
	sessions: Session[];
	onOpenSession: (sessionId: string) => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 p-8">
			<p className="text-muted-foreground text-sm">{t("session.pane.empty")}</p>
			<ul className="flex w-full max-w-md flex-col gap-1">
				{sessions.map((session) => {
					const Icon = statusIcon[session.status];
					return (
						<li key={session.id}>
							<button
								type="button"
								onClick={() => onOpenSession(session.id)}
								className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left hover:bg-accent/60"
							>
								<Icon
									aria-label={t(`session.status.${session.status}`)}
									className={cn(
										"size-3.5 shrink-0",
										statusTone[session.status],
									)}
								/>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm">
										{session.title}
									</span>
									<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
										<GitBranch className="size-3 shrink-0" />
										<span className="truncate font-mono">{session.branch}</span>
									</span>
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function Tab({
	pane,
	label,
	active,
	onFocus,
	onClose,
}: {
	pane: Pane;
	label: string;
	active: boolean;
	onFocus: () => void;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const Icon = tabIcon[pane.kind];

	return (
		<span
			className={cn(
				"flex max-w-52 shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-2.5 py-1.5",
				active
					? "border-border bg-background"
					: "border-transparent text-muted-foreground hover:bg-background/50",
			)}
		>
			<button
				type="button"
				onClick={onFocus}
				className="flex min-w-0 items-center gap-1.5 text-xs"
			>
				<Icon className="size-3.5 shrink-0" />
				<span className="truncate">{label}</span>
			</button>
			<Button
				size="icon"
				variant="ghost"
				aria-label={t("session.pane.close")}
				onClick={onClose}
				className="-mr-1 size-5 shrink-0"
			>
				<X className="size-3" />
			</Button>
		</span>
	);
}

function SessionBody({
	session,
	children,
}: {
	session: Session;
	children: ReactNode;
}) {
	const { t } = useTranslation();

	return (
		<>
			{/* No toolbar: the tab names the session and the status bar carries the
			    branch, so a third row would only repeat them. */}
			<div className="min-h-0 flex-1 overflow-auto">{children}</div>

			{session.blockedOn && session.status === "waiting" && (
				<div className="flex shrink-0 items-center gap-2 border-amber-500/30 border-t bg-amber-500/10 px-3 py-1.5">
					<span className="min-w-0 flex-1 truncate font-mono text-[11px]">
						{session.blockedOn}
					</span>
					<Button size="sm" variant="secondary" className="h-6 text-[11px]">
						{t("session.approve.allow")}
					</Button>
					<Button size="sm" variant="ghost" className="h-6 text-[11px]">
						{t("session.approve.deny")}
					</Button>
				</div>
			)}
		</>
	);
}

function FileBody({
	session,
	path,
	onReview,
}: {
	session: Session;
	path: string;
	onReview: (sessionId: string, path: string, state: ReviewState) => void;
}) {
	const { t } = useTranslation();
	const changed = session.files.find((file) => file.path === path);
	// A file that was only added has no "before" worth showing, so it opens as
	// itself. Its content is the after side of its own diff.
	const source =
		session.sources[path] ??
		changed?.rows.flatMap((row) => (row.after ? [row.after.text] : []));

	return (
		<>
			{changed?.kind === "modified" && (
				<div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
					<span className="shrink-0 text-[11px] tabular-nums">
						<span className="text-emerald-600">+{changed.added}</span>{" "}
						<span className="text-destructive">-{changed.removed}</span>
					</span>
					<span className="ml-auto flex shrink-0 gap-1">
						<Button
							size="sm"
							variant="ghost"
							className="h-7 gap-1 text-xs"
							onClick={() => onReview(session.id, path, "reviewed")}
						>
							<Check className="size-3.5" />
							{t("session.changes.approve")}
						</Button>
						{/* Reverting is meant to feed the agent, not merely undo. */}
						<Button
							size="sm"
							variant="ghost"
							className="h-7 gap-1 text-xs"
							onClick={() => onReview(session.id, path, "reverted")}
						>
							<Undo2 className="size-3.5" />
							{t("session.changes.revert")}
						</Button>
					</span>
				</div>
			)}

			<div className="min-h-0 flex-1 overflow-auto">
				{changed?.kind === "modified" ? (
					<DiffView rows={changed.rows} />
				) : source ? (
					<SourceView lines={source} />
				) : (
					<p className="p-6 text-muted-foreground text-sm">
						{t("session.files.noPreview")}
					</p>
				)}
			</div>
		</>
	);
}

// An issue or a pull request is a page you open and read, which is why it lands
// in a tab rather than in the narrow column that lists it.
function IssueBody({ project, number }: { project?: Project; number: number }) {
	const { t } = useTranslation();
	const issue = project?.issues.find((item) => item.number === number);
	if (!issue) return <Missing />;

	return (
		<Article
			number={issue.number}
			title={issue.title}
			meta={
				<>
					<Pill>{t(`github.state.${issue.state}`)}</Pill>
					<span>{issue.author}</span>
					{issue.labels.map((label) => (
						<Pill key={label}>{label}</Pill>
					))}
				</>
			}
			body={issue.body}
		/>
	);
}

function PullBody({ project, number }: { project?: Project; number: number }) {
	const { t } = useTranslation();
	const pull = project?.pulls.find((item) => item.number === number);
	if (!pull) return <Missing />;

	return (
		<Article
			number={pull.number}
			title={pull.title}
			meta={
				<>
					<Pill>{t(`github.state.${pull.state}`)}</Pill>
					<span className="flex items-center gap-1">
						<GitBranch className="size-3" />
						<span className="font-mono">{pull.branch}</span>
					</span>
					<Pill>{t(`github.ci.${pull.ci}`)}</Pill>
					{pull.reviewer && <span>{pull.reviewer}</span>}
				</>
			}
			body={pull.body}
		/>
	);
}

function Article({
	number,
	title,
	meta,
	body,
}: {
	number: number;
	title: string;
	meta: ReactNode;
	body: string;
}) {
	return (
		<div className="min-h-0 flex-1 overflow-auto p-6">
			<div className="mx-auto max-w-2xl">
				<h2 className="font-medium text-lg">
					{title}{" "}
					<span className="text-muted-foreground tabular-nums">#{number}</span>
				</h2>
				<div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
					{meta}
				</div>
				<p className="mt-4 whitespace-pre-wrap text-sm leading-6">{body}</p>
			</div>
		</div>
	);
}

function Pill({ children }: { children: ReactNode }) {
	return (
		<span className="rounded-full border px-1.5 py-0.5 text-[11px]">
			{children}
		</span>
	);
}

function Missing() {
	const { t } = useTranslation();

	return (
		<p className="p-6 text-muted-foreground text-sm">{t("github.missing")}</p>
	);
}
