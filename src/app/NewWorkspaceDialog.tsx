import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Called with the trimmed name. The caller opens the first terminal. */
	onCreate: (name: string) => void;
};

// One field. A workspace is named and then used; where its shells go is up
// to the shells.
export function NewWorkspaceDialog({ open, onOpenChange, onCreate }: Props) {
	const { t } = useTranslation();
	const id = useId();
	const [name, setName] = useState("");

	const submit = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		onCreate(trimmed);
		setName("");
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("session.workspace.title")}</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-1.5">
					<label htmlFor={id} className="font-medium text-xs">
						{t("session.workspace.name")}
					</label>
					<Input
						id={id}
						value={name}
						onChange={(event) => setName(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") submit();
						}}
						placeholder={t("session.workspace.namePlaceholder")}
					/>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						{t("session.workspace.cancel")}
					</Button>
					<Button onClick={submit} disabled={!name.trim()}>
						{t("session.workspace.create")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
