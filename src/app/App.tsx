import { Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NotesEditor } from "@/features/notes/components/NotesEditor";
import { WorkspaceOpener } from "@/features/workspace/components/WorkspaceOpener";

export function App() {
	const { t } = useTranslation();

	return (
		<main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
			<h1 className="flex items-center gap-2 font-heading text-2xl">
				<Terminal className="size-5" />
				{t("app.title")}
			</h1>
			<WorkspaceOpener />
			<NotesEditor />
		</main>
	);
}
