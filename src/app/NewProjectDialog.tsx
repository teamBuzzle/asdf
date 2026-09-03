import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { WorkspaceOpener } from "@/features/workspace/components/WorkspaceOpener";

// Lives in the app shell because it composes two features — sessions supplies
// the groups, workspace supplies the folder picker — and features are not
// allowed to import each other.

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
	const [name, setName] = useState("");
	const [groupName, setGroupName] = useState(groups[0]?.name ?? "");

	const submit = () => {
		if (!name.trim()) return;
		onCreate({ name, groupName });
		setName("");
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("session.project.title")}</DialogTitle>
					<DialogDescription>{t("session.project.subtitle")}</DialogDescription>
				</DialogHeader>

				{/* Not a <form>: WorkspaceOpener brings its own, and forms cannot nest. */}
				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<p className="font-medium text-xs">{t("session.project.folder")}</p>
						<WorkspaceOpener
							onOpened={(workspace) => setName(workspace.name)}
						/>
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
