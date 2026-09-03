import { FolderGit2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Group } from "@/features/sessions/types";
import type { NewProjectInput } from "@/features/sessions/use-sessions";
import { ipc } from "@/ipc/client";

// Lives in the app shell because it joins a feature to the IPC layer, and it is
// the only screen that needs a folder before anything exists to hang it on.

type Check =
	| { status: "idle" }
	| { status: "checking" }
	| { status: "ok"; path: string; isGitRepo: boolean }
	| { status: "failed"; reason: string };

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	groups: Group[];
	onCreate: (input: NewProjectInput) => void;
};

export function NewProjectDialog({
	open,
	onOpenChange,
	groups,
	onCreate,
}: Props) {
	const { t } = useTranslation();
	const ids = useId();
	const [folder, setFolder] = useState("");
	const [name, setName] = useState("");
	const [groupName, setGroupName] = useState(groups[0]?.name ?? "");
	const [check, setCheck] = useState<Check>({ status: "idle" });

	// The folder is checked before the project exists, so a typo is caught here
	// rather than the first time an agent tries to run in it.
	const verify = async () => {
		if (!folder.trim()) return;
		setCheck({ status: "checking" });
		const result = await ipc.openWorkspace(folder.trim());
		if (!result.ok) {
			setCheck({ status: "failed", reason: result.error.message });
			return;
		}
		setCheck({
			status: "ok",
			path: result.value.path,
			isGitRepo: result.value.isGitRepo,
		});
		setName((previous) => previous || result.value.name);
	};

	const submit = () => {
		if (!name.trim()) return;
		onCreate({ name, groupName });
		setFolder("");
		setName("");
		setCheck({ status: "idle" });
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("session.project.title")}</DialogTitle>
					<DialogDescription>{t("session.project.subtitle")}</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<label htmlFor={`${ids}-folder`} className="font-medium text-xs">
							{t("session.project.folder")}
						</label>
						<div className="flex gap-2">
							<Input
								id={`${ids}-folder`}
								value={folder}
								onChange={(event) => {
									setFolder(event.target.value);
									setCheck({ status: "idle" });
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter") void verify();
								}}
								placeholder="/path/to/repo"
							/>
							<Button
								variant="outline"
								onClick={() => void verify()}
								disabled={!folder.trim() || check.status === "checking"}
							>
								{t("session.project.check")}
							</Button>
						</div>
						<p className="text-muted-foreground text-xs" role="status">
							{match(check)
								.with({ status: "idle" }, () => t("session.project.checkHint"))
								.with({ status: "checking" }, () =>
									t("session.project.checking"),
								)
								.with({ status: "failed" }, ({ reason }) => reason)
								.with({ status: "ok" }, ({ path, isGitRepo }) => (
									<span className="flex items-center gap-1.5">
										{isGitRepo && <FolderGit2 className="size-3.5 shrink-0" />}
										<span className="truncate">{path}</span>
									</span>
								))
								.exhaustive()}
						</p>
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor={`${ids}-name`} className="font-medium text-xs">
							{t("session.project.name")}
						</label>
						<Input
							id={`${ids}-name`}
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder={t("session.project.namePlaceholder")}
						/>
					</div>

					{/* A free-text field with suggestions: typing a new name makes the
					    group, so grouping never needs a management screen. */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor={`${ids}-group`} className="font-medium text-xs">
							{t("session.project.group")}
						</label>
						<Input
							id={`${ids}-group`}
							list={`${ids}-groups`}
							value={groupName}
							onChange={(event) => setGroupName(event.target.value)}
							placeholder={t("session.project.groupPlaceholder")}
						/>
						<datalist id={`${ids}-groups`}>
							{groups.map((group) => (
								<option key={group.id} value={group.name} />
							))}
						</datalist>
					</div>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						{t("session.create.cancel")}
					</Button>
					<Button onClick={submit} disabled={!name.trim()}>
						{t("session.project.add")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
