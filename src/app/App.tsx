import { Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NotesEditor } from "@/features/notes/components/NotesEditor";
import { UpdateChip } from "@/features/updater/components/UpdateChip";
import { UpdateDialog } from "@/features/updater/components/UpdateDialog";
import { useUpdater } from "@/features/updater/use-updater";
import { WorkspaceOpener } from "@/features/workspace/components/WorkspaceOpener";

export function App() {
	const { t } = useTranslation();
	const updater = useUpdater();

	return (
		<main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
			{/* The update chip lives here until there is a status bar to hold it. */}
			<header className="flex items-center justify-between gap-2">
				<h1 className="flex items-center gap-2 font-heading text-2xl">
					<Terminal className="size-5" />
					{t("app.title")}
				</h1>
				<UpdateChip
					state={updater.state}
					onOpen={() => updater.setOpen(true)}
				/>
			</header>

			<WorkspaceOpener />
			<NotesEditor />

			<UpdateDialog
				state={updater.state}
				open={updater.open}
				onOpenChange={updater.setOpen}
				onDownload={updater.download}
				onInstallNow={updater.installNow}
				onInstallOnQuit={updater.installOnQuit}
				onRetry={() => void updater.runCheck(true)}
			/>
		</main>
	);
}
