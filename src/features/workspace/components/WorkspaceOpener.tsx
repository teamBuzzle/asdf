import { FolderGit2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaces } from "../use-workspaces";

export function WorkspaceOpener() {
	const { t } = useTranslation();
	const { state, recent, open } = useWorkspaces();
	const [draft, setDraft] = useState("");

	return (
		<section className="flex flex-col gap-3">
			<form
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					open(draft);
				}}
			>
				<Input
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					placeholder="/path/to/repo"
					aria-label={t("workspace.pathLabel")}
				/>
				<Button type="submit" disabled={state.status === "opening"}>
					{t("workspace.open")}
				</Button>
			</form>

			<p className="text-muted-foreground text-sm" role="status">
				{match(state)
					.with({ status: "idle" }, () => t("workspace.idle"))
					.with({ status: "opening" }, () => t("workspace.opening"))
					.with({ status: "opened" }, ({ workspace }) => workspace.path)
					.with({ status: "failed" }, ({ reason }) => reason)
					.exhaustive()}
			</p>

			{recent.length > 0 && (
				<ul className="flex flex-col gap-1 text-sm">
					{recent.map((workspace) => (
						<li key={workspace.path} className="flex items-center gap-2">
							{workspace.isGitRepo && (
								<FolderGit2 className="size-4 shrink-0" />
							)}
							<span className="truncate">{workspace.name}</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
