import {
	ArrowDown,
	ArrowUp,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	CircleDot,
	CircleSlash,
	Clock,
	GitBranch,
	GitMerge,
	GitPullRequest,
	GitPullRequestDraft,
	type LucideIcon,
	XCircle,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Issue, Project, PullRequest, Session } from "../types";
import { FileExplorer } from "./FileExplorer";

type View = "files" | "changes" | "issues" | "pulls";

const issueIcon: Record<Issue["state"], LucideIcon> = {
	open: CircleDot,
	closed: CircleSlash,
};

const issueTone: Record<Issue["state"], string> = {
	open: "text-emerald-600 dark:text-emerald-500",
	closed: "text-muted-foreground",
};

const pullIcon: Record<PullRequest["state"], LucideIcon> = {
	open: GitPullRequest,
	draft: GitPullRequestDraft,
	merged: GitMerge,
};

const pullTone: Record<PullRequest["state"], string> = {
	open: "text-emerald-600 dark:text-emerald-500",
	draft: "text-muted-foreground",
	merged: "text-violet-600 dark:text-violet-400",
};

const ciIcon: Record<PullRequest["ci"], LucideIcon> = {
	pass: CheckCircle2,
	fail: XCircle,
	pending: Clock,
};

const ciTone: Record<PullRequest["ci"], string> = {
	pass: "text-emerald-600 dark:text-emerald-500",
	fail: "text-destructive",
	pending: "text-muted-foreground",
};

// The single letter an editor puts next to a changed file.
const kindLetter = { modified: "M", added: "A", deleted: "D" } as const;

const kindTone = {
	modified: "text-amber-600 dark:text-amber-500",
	added: "text-emerald-600 dark:text-emerald-500",
	deleted: "text-destructive",
} as const;

type Props = {
	/** Files and changes follow the open tab; issues and pull requests follow
	 *  the project, because that is what they belong to. */
	session?: Session;
	project?: Project;
	/** Every session of the project — one worktree each. */
	projectSessions: Session[];
	onOpenFile: (sessionId: string, path: string) => void;
	onOpenSession: (sessionId: string) => void;
	onOpenIssue: (number: number) => void;
	onOpenPull: (number: number) => void;
};

export function SidePanel({
	session,
	project,
	projectSessions,
	onOpenFile,
	onOpenSession,
	onOpenIssue,
	onOpenPull,
}: Props) {
	const { t } = useTranslation();
	const [view, setView] = useState<View>("files");

	const counts: Record<View, number | undefined> = {
		files: undefined,
		changes: session?.files.filter((file) => file.review === "new").length,
		issues: project?.issues.filter((issue) => issue.state === "open").length,
		pulls: project?.pulls.filter((pull) => pull.state !== "merged").length,
	};

	const label: Record<View, string> = {
		files: t("session.files.title"),
		changes: t("session.changes.title"),
		issues: t("github.issues"),
		pulls: t("github.pulls"),
	};

	return (
		<aside className="flex w-72 shrink-0 flex-col border-l bg-muted/30">
			{/* One view at a time. Stacking them would leave every list too short to
			    read and the tree squeezed to nothing. */}
			<nav
				aria-label={t("session.sidePanel")}
				className="flex shrink-0 gap-px border-b p-1"
			>
				{(["files", "changes", "issues", "pulls"] as const).map((value) => (
					<button
						key={value}
						type="button"
						aria-pressed={view === value}
						onClick={() => setView(value)}
						className={cn(
							"flex flex-1 items-center justify-center gap-1 rounded-md px-1 py-1 text-[11px] transition-colors",
							view === value
								? "bg-background font-medium text-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<span className="truncate">{label[value]}</span>
						{counts[value] ? (
							<span className="tabular-nums">{counts[value]}</span>
						) : null}
					</button>
				))}
			</nav>

			{view === "files" ? (
				session ? (
					<FileExplorer session={session} onOpenFile={onOpenFile} />
				) : (
					<Empty>{t("session.files.noSession")}</Empty>
				)
			) : view === "changes" ? (
				<SourceControl
					session={session}
					project={project}
					projectSessions={projectSessions}
					onOpenFile={onOpenFile}
					onOpenSession={onOpenSession}
				/>
			) : view === "issues" ? (
				<IssuesView project={project} onOpen={onOpenIssue} />
			) : (
				<PullsView project={project} onOpen={onOpenPull} />
			)}
		</aside>
	);
}

// Source control the way an editor lays it out: a message box, then the state
// of the branch, then what is checked out where, then the changes themselves.
function SourceControl({
	session,
	project,
	projectSessions,
	onOpenFile,
	onOpenSession,
}: {
	session?: Session;
	project?: Project;
	projectSessions: Session[];
	onOpenFile: (sessionId: string, path: string) => void;
	onOpenSession: (sessionId: string) => void;
}) {
	const { t } = useTranslation();
	const [message, setMessage] = useState("");
	const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());

	if (!session) return <Empty>{t("session.files.noSession")}</Empty>;

	const toggle = (key: string) =>
		setClosed((previous) => {
			const next = new Set(previous);
			if (!next.delete(key)) next.add(key);
			return next;
		});

	const pending = session.files.filter((file) => file.review === "new");
	const settled = session.files.filter((file) => file.review !== "new");

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex shrink-0 flex-col gap-1.5 border-b p-2">
				<textarea
					value={message}
					onChange={(event) => setMessage(event.target.value)}
					placeholder={t("scm.messagePlaceholder")}
					aria-label={t("scm.message")}
					rows={2}
					className="w-full resize-none rounded-md border bg-background/70 px-2 py-1.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
				/>
				<Button
					size="sm"
					className="h-7 w-full text-xs"
					disabled={!message.trim() || session.files.length === 0}
				>
					{t("scm.commit")}
				</Button>
			</div>

			<div className="min-h-0 flex-1 overflow-auto">
				<Section
					label={t("scm.branch")}
					open={!closed.has("branch")}
					onToggle={() => toggle("branch")}
				>
					<div className="flex items-center gap-1.5 px-3 py-1 text-xs">
						<GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
						<span className="min-w-0 flex-1 truncate font-mono">
							{session.branch}
						</span>
						<span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
							<ArrowUp className="size-3" />
							{session.ahead}
							<ArrowDown className="size-3" />
							{session.behind}
						</span>
					</div>
					<p className="px-3 pb-1.5 text-[11px] text-muted-foreground">
						{t("scm.basedOn", { branch: project?.branch })}
					</p>
				</Section>

				{/* Which branch is checked out where is the thing a normal git GUI
				    cannot tell you once worktrees are in play. */}
				<Section
					label={t("scm.worktrees")}
					count={projectSessions.length}
					open={!closed.has("worktrees")}
					onToggle={() => toggle("worktrees")}
				>
					<ul>
						{projectSessions.map((item) => (
							<li key={item.id}>
								<button
									type="button"
									onClick={() => onOpenSession(item.id)}
									className={cn(
										"flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs hover:bg-accent/60",
										item.id === session.id && "bg-accent/60",
									)}
								>
									<GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1">
										<span className="block truncate font-mono">
											{item.branch}
										</span>
										<span className="block truncate text-[11px] text-muted-foreground">
											{item.title}
										</span>
									</span>
									{item.id === session.id && (
										<span className="size-1.5 shrink-0 rounded-full bg-sky-500" />
									)}
								</button>
							</li>
						))}
					</ul>
				</Section>

				<Section
					label={t("scm.changes")}
					count={session.files.length}
					open={!closed.has("changes")}
					onToggle={() => toggle("changes")}
				>
					{session.files.length === 0 ? (
						<p className="px-3 pb-2 text-[11px] text-muted-foreground">
							{t("session.changes.empty")}
						</p>
					) : (
						<ul>
							{pending.map((file) => (
								<ChangedRow
									key={file.path}
									file={file}
									onOpen={() => onOpenFile(session.id, file.path)}
								/>
							))}

							{settled.length > 0 && (
								<li
									aria-hidden
									className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wide"
								>
									<span className="h-px flex-1 bg-border" />
									{t("session.changes.reviewedDivider")}
									<span className="h-px flex-1 bg-border" />
								</li>
							)}

							{settled.map((file) => (
								<ChangedRow
									key={file.path}
									file={file}
									onOpen={() => onOpenFile(session.id, file.path)}
								/>
							))}
						</ul>
					)}
				</Section>
			</div>

			{session.files.length > 0 && (
				<footer className="shrink-0 border-t px-3 py-2 text-[11px] text-muted-foreground">
					{t("session.changes.reviewedCount", {
						done: settled.length,
						total: session.files.length,
					})}
				</footer>
			)}
		</div>
	);
}

function ChangedRow({
	file,
	onOpen,
}: {
	file: Session["files"][number];
	onOpen: () => void;
}) {
	const name = file.path.split("/").pop() ?? file.path;
	const dir = file.path.slice(0, file.path.length - name.length - 1);

	return (
		<li>
			<button
				type="button"
				onClick={onOpen}
				className={cn(
					"flex w-full items-baseline gap-1.5 px-3 py-1 text-left text-xs hover:bg-accent/60",
					file.review === "reverted" && "line-through opacity-60",
				)}
			>
				<span className="min-w-0 truncate">{name}</span>
				<span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
					{dir}
				</span>
				<span className="shrink-0 text-[11px] tabular-nums">
					<span className="text-emerald-600">+{file.added}</span>{" "}
					<span className="text-destructive">-{file.removed}</span>
				</span>
				<span className={cn("w-3 shrink-0 text-center", kindTone[file.kind])}>
					{kindLetter[file.kind]}
				</span>
			</button>
		</li>
	);
}

function Section({
	label,
	count,
	open,
	onToggle,
	children,
}: {
	label: string;
	count?: number;
	open: boolean;
	onToggle: () => void;
	children: ReactNode;
}) {
	return (
		<section className="border-b last:border-b-0">
			<button
				type="button"
				aria-expanded={open}
				onClick={onToggle}
				className="flex w-full items-center gap-1 px-2 py-1.5 text-[11px] text-muted-foreground uppercase tracking-wide hover:bg-accent/60 hover:text-foreground"
			>
				{open ? (
					<ChevronDown className="size-3.5 shrink-0" />
				) : (
					<ChevronRight className="size-3.5 shrink-0" />
				)}
				<span className="font-medium">{label}</span>
				{count !== undefined && <span className="tabular-nums">{count}</span>}
			</button>
			{open && <div className="pb-1">{children}</div>}
		</section>
	);
}

function IssuesView({
	project,
	onOpen,
}: {
	project?: Project;
	onOpen: (number: number) => void;
}) {
	const { t } = useTranslation();
	if (!project?.issues.length) return <Empty>{t("github.noIssues")}</Empty>;

	return (
		<ul className="flex-1 overflow-auto p-1">
			{project.issues.map((issue) => {
				const Icon = issueIcon[issue.state];
				return (
					<Row
						key={issue.number}
						icon={<Icon className={cn("size-3.5", issueTone[issue.state])} />}
						number={issue.number}
						title={issue.title}
						meta={issue.labels.join(" · ")}
						onOpen={() => onOpen(issue.number)}
					/>
				);
			})}
		</ul>
	);
}

function PullsView({
	project,
	onOpen,
}: {
	project?: Project;
	onOpen: (number: number) => void;
}) {
	const { t } = useTranslation();
	if (!project?.pulls.length) return <Empty>{t("github.noPulls")}</Empty>;

	return (
		<ul className="flex-1 overflow-auto p-1">
			{project.pulls.map((pull) => {
				const Icon = pullIcon[pull.state];
				const Ci = ciIcon[pull.ci];
				return (
					<Row
						key={pull.number}
						icon={<Icon className={cn("size-3.5", pullTone[pull.state])} />}
						number={pull.number}
						title={pull.title}
						meta={pull.branch}
						trailing={<Ci className={cn("size-3", ciTone[pull.ci])} />}
						onOpen={() => onOpen(pull.number)}
					/>
				);
			})}
		</ul>
	);
}

function Row({
	icon,
	number,
	title,
	meta,
	trailing,
	onOpen,
}: {
	icon: ReactNode;
	number: number;
	title: string;
	meta?: string;
	trailing?: ReactNode;
	onOpen: () => void;
}) {
	return (
		<li>
			<button
				type="button"
				onClick={onOpen}
				className="flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent/60"
			>
				<span className="mt-0.5 shrink-0">{icon}</span>
				<span className="min-w-0 flex-1">
					<span className="flex items-baseline gap-1.5">
						<span className="shrink-0 text-muted-foreground tabular-nums">
							#{number}
						</span>
						<span className="min-w-0 flex-1 truncate">{title}</span>
					</span>
					{meta && (
						<span className="block truncate text-[11px] text-muted-foreground">
							{meta}
						</span>
					)}
				</span>
				{trailing && <span className="mt-0.5 shrink-0">{trailing}</span>}
			</button>
		</li>
	);
}

function Empty({ children }: { children: ReactNode }) {
	return (
		<p className="flex-1 px-3 py-3 text-muted-foreground text-xs">{children}</p>
	);
}
