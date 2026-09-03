import {
	ChevronDown,
	ChevronRight,
	Plus,
	TerminalSquare,
	X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project, Session } from "../types";

type Props = {
	projects: Project[];
	sessions: Session[];
	/** The workspace whose window is on screen. Switching swaps the tab set. */
	activeProjectId: string;
	/** The terminal on screen, lit in the list. */
	activeSessionId?: string;
	onSelectProject: (projectId: string) => void;
	onOpenSession: (sessionId: string) => void;
	onNewWorkspace: () => void;
	onRemoveWorkspace: (projectId: string) => void;
};

// Workspace → terminal, each workspace folding. Rows, not boxes: the fold and
// the indent separate the levels, so no borders are needed to do it again.
export function SessionSidebar({
	projects,
	sessions,
	activeProjectId,
	activeSessionId,
	onSelectProject,
	onOpenSession,
	onNewWorkspace,
	onRemoveWorkspace,
}: Props) {
	const { t } = useTranslation();
	const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());

	const toggle = (id: string) =>
		setFolded((previous) => {
			const next = new Set(previous);
			if (!next.delete(id)) next.add(id);
			return next;
		});

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

			<ul className="mt-1 space-y-0.5">
				{projects.map((project) => {
					const own = sessions.filter(
						(session) => session.projectId === project.id,
					);
					const open = !folded.has(project.id);
					const active = project.id === activeProjectId;
					// When one of its terminals is on screen, that row is the selected
					// thing; the workspace only stands out while folded or empty.
					const showing =
						active && own.some((session) => session.id === activeSessionId);
					return (
						<li key={project.id}>
							<div
								className={cn(
									"group flex items-center rounded-md",
									active && (!open || !showing)
										? "bg-accent"
										: "hover:bg-accent/60",
								)}
							>
								<button
									type="button"
									aria-expanded={open}
									aria-label={project.name}
									onClick={() => toggle(project.id)}
									className="flex size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
								>
									{open ? (
										<ChevronDown className="size-3.5" />
									) : (
										<ChevronRight className="size-3.5" />
									)}
								</button>
								<button
									type="button"
									aria-current={active ? "true" : undefined}
									onClick={() => onSelectProject(project.id)}
									className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-1 text-left"
								>
									<span className="min-w-0 flex-1 truncate font-medium text-xs">
										{project.name}
									</span>
									{!open && own.length > 0 && (
										<span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
											{own.length}
										</span>
									)}
								</button>
								<Button
									size="icon"
									variant="ghost"
									aria-label={t("session.removeWorkspace")}
									title={t("session.removeWorkspace")}
									onClick={() => onRemoveWorkspace(project.id)}
									className="mr-1 size-5 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
								>
									<X className="size-3" />
								</Button>
							</div>

							{open && own.length > 0 && (
								<ul className="mt-0.5 space-y-px">
									{own.map((session) => {
										const current = session.id === activeSessionId && active;
										return (
											<li key={session.id}>
												<button
													type="button"
													aria-current={current ? "true" : undefined}
													onClick={() => onOpenSession(session.id)}
													className={cn(
														"flex w-full items-center gap-1.5 rounded-md py-1 pr-2 pl-7 text-left text-xs",
														current
															? "bg-accent text-foreground"
															: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
													)}
												>
													<TerminalSquare className="size-3.5 shrink-0" />
													<span className="truncate">{session.title}</span>
												</button>
											</li>
										);
									})}
								</ul>
							)}
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
