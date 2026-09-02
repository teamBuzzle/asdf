import { useTranslation } from "react-i18next";
import { TerminalPane } from "@/features/terminal/components/TerminalPane";
import { UpdateChip } from "@/features/updater/components/UpdateChip";
import { UpdateDialog } from "@/features/updater/components/UpdateDialog";
import { useUpdater } from "@/features/updater/use-updater";

export function App() {
	const { t } = useTranslation();
	const updater = useUpdater();

	return (
		// grid-rows-[1fr_auto] pins the status bar: the terminal gets exactly the
		// remaining height rather than being free to overflow past it.
		<div className="grid h-dvh grid-rows-[1fr_auto] overflow-hidden bg-background">
			<TerminalPane />

			<footer className="relative z-10 flex items-center justify-between gap-2 border-t bg-background px-3 py-1">
				<span className="text-muted-foreground text-xs">{t("app.title")}</span>
				<UpdateChip
					state={updater.state}
					onOpen={() => updater.setOpen(true)}
				/>
			</footer>

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
