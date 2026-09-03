import {
	ChevronDown,
	ChevronRight,
	FolderGit2,
	GitBranch,
	Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GroupNode, Project } from "../types";

type Props = {
	tree: GroupNode[];
	collapsed: ReadonlySet<string>;
	onToggle: (key: string) => void;
	/** The project whose window is on screen. Switching swaps the whole tab set. */
	activeProjectId: string;
	onSelectProject: (projectId: string) => void;
	onNewProject: () => void;
};

export function SessionSidebar({
	tree,
	collapsed,
	onToggle,
	activeProjectId,
	onSelectProject,
	onNewProject,
}: Props) {
	const { t } = useTranslation();

	return (
		<nav
			aria-label={t("session.sidebarLabel")}
			className="flex min-h-0 flex-1 flex-col"
		>
			<div className="p-2">
				<Button
					size="sm"
					onClick={onNewProject}
					className="h-8 w-full justify-center gap-1.5 text-xs"
				>
					<Plus className="size-3.5" />
					{t("session.newProject")}
				</Button>
			</div>

			<div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
				{tree.map((node) => {
					const key = `g:${node.group.id}`;
					const open = !collapsed.has(key);
					return (
						// A group is a box around projects and nothing else — work never
						// hangs off it directly.
						<section
							key={key}
							className="overflow-hidden rounded-lg border bg-background/50"
						>
							<button
								type="button"
								aria-expanded={open}
								onClick={() => onToggle(key)}
								className="flex w-full items-center gap-1 px-2 py-1.5 text-[11px] text-muted-foreground uppercase tracking-wide hover:bg-accent/60 hover:text-foreground"
							>
								{open ? (
									<ChevronDown className="size-3.5 shrink-0" />
								) : (
									<ChevronRight className="size-3.5 shrink-0" />
								)}
								<span className="truncate font-medium">{node.group.name}</span>
								{node.needsAttention && <NeedsYou />}
							</button>

							{open && (
								<ul className="border-t p-1">
									{node.projects.map((child) => (
										<li key={child.project.id}>
											<ProjectRow
												project={child.project}
												sessionCount={child.sessions.length}
												needsAttention={child.needsAttention}
												active={child.project.id === activeProjectId}
												onSelect={() => onSelectProject(child.project.id)}
											/>
										</li>
									))}
								</ul>
							)}
						</section>
					);
				})}
			</div>
		</nav>
	);
}

// The sidebar lists windows, not tabs. A project shows the branch its local
// checkout is on; the sessions themselves live as tabs inside the window.
function ProjectRow({
	project,
	sessionCount,
	needsAttention,
	active,
	onSelect,
}: {
	project: Project;
	sessionCount: number;
	needsAttention: boolean;
	active: boolean;
	onSelect: () => void;
}) {
	return (
		<div
			className={cn(
				"flex items-center rounded-md",
				active ? "bg-accent" : "hover:bg-accent/60",
			)}
		>
			<button
				type="button"
				aria-current={active ? "true" : undefined}
				onClick={onSelect}
				className="flex min-w-0 flex-1 items-start gap-1.5 px-2 py-1.5 text-left"
			>
				<FolderGit2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-1.5">
						<span className="truncate font-medium text-xs">{project.name}</span>
						<span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
							{sessionCount}
						</span>
						{needsAttention && <NeedsYou />}
					</span>
					<span className="flex items-center gap-1 text-[11px] text-muted-foreground">
						<GitBranch className="size-3 shrink-0" />
						<span className="truncate font-mono">{project.branch}</span>
					</span>
				</span>
			</button>
		</div>
	);
}

/** Survives collapsing, which is what makes collapsing safe. */
function NeedsYou() {
	const { t } = useTranslation();

	return (
		<span className="ml-auto shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-medium text-[10px] text-amber-700 normal-case dark:text-amber-500">
			{t("session.needsYou")}
		</span>
	);
}
