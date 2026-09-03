import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import icon from "@/assets/asdf-icon.svg";
import { Button } from "@/components/ui/button";

import { NewSessionDialog } from "@/features/sessions/components/NewSessionDialog";
import { PaneArea } from "@/features/sessions/components/PaneArea";
import { SessionSidebar } from "@/features/sessions/components/SessionSidebar";
import { SidePanel } from "@/features/sessions/components/SidePanel";
import { useSessions } from "@/features/sessions/use-sessions";
import { TerminalPane } from "@/features/terminal/components/TerminalPane";
import { UpdateChip } from "@/features/updater/components/UpdateChip";
import { UpdateDialog } from "@/features/updater/components/UpdateDialog";
import { useUpdater } from "@/features/updater/use-updater";
import { platform } from "@/ipc/platform";
import { NewProjectDialog } from "./NewProjectDialog";
import { SettingsDialog, type Theme } from "./SettingsDialog";

/**
 * The caption glyphs, drawn the way Windows draws its own: ten pixels, one
 * pixel of stroke, and the straight ones snapped to the pixel grid. An icon
 * font scaled down to this size lands on half pixels and blurs.
 */
const GLYPH = {
	minimize: (
		<path d="M0.5 5.5h9" stroke="currentColor" shapeRendering="crispEdges" />
	),
	maximize: (
		<rect
			x="0.5"
			y="0.5"
			width="9"
			height="9"
			fill="none"
			stroke="currentColor"
			shapeRendering="crispEdges"
		/>
	),
	close: <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" />,
} as const;

function WindowGlyph({ kind }: { kind: keyof typeof GLYPH }) {
	return (
		<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
			{GLYPH[kind]}
		</svg>
	);
}

export function App() {
	const { t } = useTranslation();
	const updater = useUpdater();
	const sessions = useSessions();
	const [projectOpen, setProjectOpen] = useState(false);
	const [sessionIn, setSessionIn] = useState<string | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [theme, setTheme] = useState<Theme>("system");

	useEffect(() => {
		const media = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
		const apply = () => {
			const dark = theme === "dark" || (theme === "system" && !!media?.matches);
			document.documentElement.classList.toggle("dark", dark);
		};
		apply();
		// "System" has to keep following the OS after mount, not just read it once.
		media?.addEventListener("change", apply);
		return () => media?.removeEventListener("change", apply);
	}, [theme]);

	const active = sessions.activeSession;

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
			{/* Drawn by us, dragged by the OS. On macOS the traffic lights sit at the
			    left end and the app draws no controls; elsewhere it draws its own at
			    the right end, so minimise and maximise can hover grey while close
			    hovers red. */}
			<div
				className={`title-bar flex shrink-0 select-none items-center gap-2 border-b text-muted-foreground text-xs ${platform.isMac ? "pl-20" : "pl-4"}`}
			>
				<img src={icon} alt="" className="size-4" draggable={false} />
				<span className="font-medium">asdf</span>

				{!platform.isMac && (
					<div className="ml-auto flex h-full">
						<button
							type="button"
							aria-label={t("window.minimize")}
							onClick={platform.window.minimize}
							className="flex h-full w-11 items-center justify-center transition-colors hover:bg-muted hover:text-foreground"
						>
							<WindowGlyph kind="minimize" />
						</button>
						<button
							type="button"
							aria-label={t("window.maximize")}
							onClick={platform.window.maximize}
							className="flex h-full w-11 items-center justify-center transition-colors hover:bg-muted hover:text-foreground"
						>
							<WindowGlyph kind="maximize" />
						</button>
						<button
							type="button"
							aria-label={t("window.close")}
							onClick={platform.window.close}
							className="flex h-full w-11 items-center justify-center transition-colors hover:bg-red-600 hover:text-white"
						>
							<WindowGlyph kind="close" />
						</button>
					</div>
				)}
			</div>

			<div className="flex min-h-0 flex-1">
				{/* Settings sits at the foot of the sidebar, out of the way of the work. */}
				<div className="flex w-64 shrink-0 flex-col border-r bg-muted/30">
					<SessionSidebar
						tree={sessions.tree}
						collapsed={sessions.collapsed}
						onToggle={sessions.toggleNode}
						activeProjectId={sessions.activeProjectId}
						onSelectProject={sessions.selectProject}
						onNewProject={() => setProjectOpen(true)}
					/>

					<div className="flex shrink-0 items-center gap-1 border-t p-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setSettingsOpen(true)}
							className="h-8 gap-1.5 px-2 text-muted-foreground text-xs"
						>
							<Settings className="size-4" />
							{t("settings.title")}
						</Button>
						<span className="ml-auto">
							<UpdateChip
								state={updater.state}
								onOpen={() => updater.setOpen(true)}
							/>
						</span>
					</div>
				</div>

				<PaneArea
					panes={sessions.panes}
					sessions={sessions.sessions}
					project={sessions.activeProject}
					projectSessions={sessions.projectSessions}
					activeId={sessions.activeId}
					onFocus={sessions.focusPane}
					onClose={sessions.closePane}
					onOpenSession={sessions.openSession}
					onNewSession={() => setSessionIn(sessions.activeProjectId)}
					renderAgent={() => <TerminalPane />}
					onReview={sessions.review}
				/>

				<SidePanel
					session={active}
					project={sessions.activeProject}
					projectSessions={sessions.projectSessions}
					onOpenFile={sessions.openFile}
					onOpenSession={sessions.openSession}
					onOpenIssue={sessions.openIssue}
					onOpenPull={sessions.openPull}
				/>
			</div>

			<footer className="flex h-7 shrink-0 items-center gap-3 border-t bg-muted/30 px-3 text-[11px] text-muted-foreground">
				{active && (
					<>
						<span className="truncate font-mono">{active.branch}</span>
						<span className="truncate">{sessions.activeProject?.name}</span>
						<span className="truncate">{active.agent}</span>
						<span className="tabular-nums">
							{t("session.changed", { n: active.files.length })}
						</span>
					</>
				)}
				<span className="ml-auto tabular-nums">
					{t("session.pane.open", { n: sessions.panes.length })}
				</span>
			</footer>

			<NewProjectDialog
				open={projectOpen}
				onOpenChange={setProjectOpen}
				groups={sessions.groups}
				onCreate={sessions.createProject}
			/>

			<NewSessionDialog
				projectId={sessionIn}
				projectName={
					sessions.projects.find((project) => project.id === sessionIn)?.name
				}
				onOpenChange={(next) => !next && setSessionIn(null)}
				onCreate={sessions.createSession}
			/>

			<SettingsDialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				theme={theme}
				onTheme={setTheme}
			/>

			<UpdateDialog
				state={updater.state}
				open={updater.open}
				onOpenChange={updater.setOpen}
				onDownload={updater.download}
				onInstallNow={updater.installNow}
				onInstallOnQuit={updater.installOnQuit}
				onRetry={() => void updater.runCheck(true)}
			/>
		</div>
	);
}
