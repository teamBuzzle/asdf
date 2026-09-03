import { Plus, TerminalSquare, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project, Session } from "../types";

type Props = {
	projects: Project[];
	sessions: Session[];
	/** The project whose window is on screen. Switching swaps the whole tab set. */
	activeProjectId: string;
	onSelectProject: (projectId: string) => void;
	onNewWorkspace: () => void;
	onRemoveWorkspace: (projectId: string) => void;
};

// A flat list of folders, the way a feed's left rail is drawn: rows, not
// boxes. The row shows what the folder is on, so the list doubles as a
// glance at every checkout.
export function SessionSidebar({
	projects,
	sessions,
	activeProjectId,
	onSelectProject,
	onNewWorkspace,
	onRemoveWorkspace,
}: Props) {
	const { t } = useTranslation();

	return (
		<nav
			aria-label={t("session.sidebarLabel")}
			className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 pb-2"
		>
			{/* First row of the list, so a new workspace is made where it will
			    appear. */}
			<button
				type="button"
				onClick={onNewWorkspace}
				className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent/60"
			>
				<Plus className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="truncate">{t("session.newWorkspace")}</span>
			</button>

			<ul className="mt-1 space-y-px">
				{projects.map((project) => (
					<li key={project.id}>
						<ProjectRow
							project={project}
							sessionCount={
								sessions.filter((session) => session.projectId === project.id)
									.length
							}
							active={project.id === activeProjectId}
							onSelect={() => onSelectProject(project.id)}
							onRemove={() => onRemoveWorkspace(project.id)}
						/>
					</li>
				))}
			</ul>
		</nav>
	);
}

// The sidebar lists windows, not tabs: a workspace and how many terminals it
// holds. Where those terminals are is the panel's business.
function ProjectRow({
	project,
	sessionCount,
	active,
	onSelect,
	onRemove,
}: {
	project: Project;
	sessionCount: number;
	active: boolean;
	onSelect: () => void;
	onRemove: () => void;
}) {
	const { t } = useTranslation();

	return (
		<div
			className={cn(
				"group flex items-center rounded-md",
				active ? "bg-accent" : "hover:bg-accent/60",
			)}
		>
			<button
				type="button"
				aria-current={active ? "true" : undefined}
				onClick={onSelect}
				className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
			>
				<TerminalSquare className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate font-medium text-xs">
					{project.name}
				</span>
				{sessionCount > 0 && (
					<span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
						{sessionCount}
					</span>
				)}
			</button>
			<Button
				size="icon"
				variant="ghost"
				aria-label={t("session.removeWorkspace")}
				title={t("session.removeWorkspace")}
				onClick={onRemove}
				className="mr-1 size-5 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
			>
				<X className="size-3" />
			</Button>
		</div>
	);
}
