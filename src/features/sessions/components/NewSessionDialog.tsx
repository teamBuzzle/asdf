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
import type { NewSessionInput } from "../use-sessions";

const AGENTS = ["claude · sonnet", "claude · opus", "codex", "gemini"];

type Props = {
	/** The project the session belongs to. Null while the dialog is closed. */
	projectId: string | null;
	projectName?: string;
	onOpenChange: (open: boolean) => void;
	onCreate: (input: NewSessionInput) => void;
};

export function NewSessionDialog({
	projectId,
	projectName,
	onOpenChange,
	onCreate,
}: Props) {
	const { t } = useTranslation();
	const ids = useId();
	const [title, setTitle] = useState("");
	const [agent, setAgent] = useState(AGENTS[0]);

	const submit = () => {
		if (!projectId || !title.trim()) return;
		onCreate({ projectId, title, agent });
		setTitle("");
		onOpenChange(false);
	};

	return (
		<Dialog open={projectId !== null} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("session.create.title")}</DialogTitle>
					{/* The project is settled by where the session was started from, so
					    the dialog states it rather than asking again. */}
					<DialogDescription>
						{t("session.create.inProject", { project: projectName })}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<label htmlFor={`${ids}-what`} className="font-medium text-xs">
							{t("session.create.what")}
						</label>
						<Input
							id={`${ids}-what`}
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") submit();
							}}
							placeholder={t("session.create.whatPlaceholder")}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor={`${ids}-agent`} className="font-medium text-xs">
							{t("session.create.agent")}
						</label>
						<Input
							id={`${ids}-agent`}
							list={`${ids}-agents`}
							value={agent}
							onChange={(event) => setAgent(event.target.value)}
						/>
						<datalist id={`${ids}-agents`}>
							{AGENTS.map((name) => (
								<option key={name} value={name} />
							))}
						</datalist>
					</div>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						{t("session.create.cancel")}
					</Button>
					<Button onClick={submit} disabled={!title.trim()}>
						{t("session.create.start")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
