import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { produce } from "immer";
import { Terminal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

const pathSchema = z.string().min(1).max(255);

type Status =
	| { kind: "idle" }
	| { kind: "ok"; path: string }
	| { kind: "error"; message: string };

export default function App() {
	const { t } = useTranslation();
	const [draft, setDraft] = useState("");
	const [status, setStatus] = useState<Status>({ kind: "idle" });
	const editor = useEditor({
		extensions: [StarterKit],
		content: "<p>hello</p>",
	});

	const [recent, setRecent] = useState<string[]>([]);

	const submit = () => {
		const parsed = pathSchema.safeParse(draft.trim());
		if (!parsed.success) {
			setStatus({ kind: "error", message: parsed.error.issues[0].message });
			return;
		}
		setStatus({ kind: "ok", path: parsed.data });
		setRecent(
			produce((list: string[]) => {
				list.unshift(parsed.data);
			}),
		);
	};

	return (
		<main className="mx-auto flex max-w-xl flex-col gap-4 p-8">
			<h1 className="flex items-center gap-2 font-heading text-2xl">
				<Terminal className="size-5" />
				{t("title")}
			</h1>

			<div className="flex gap-2">
				<Input
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					placeholder="/path/to/repo"
				/>
				<Tooltip>
					<TooltipTrigger render={<Button onClick={submit}>Open</Button>} />
					<TooltipContent>Validate with zod</TooltipContent>
				</Tooltip>
			</div>

			<p className="text-muted-foreground text-sm">
				{match(status)
					.with({ kind: "idle" }, () => "waiting")
					.with({ kind: "ok" }, ({ path }) => `opened ${path}`)
					.with({ kind: "error" }, ({ message }) => message)
					.exhaustive()}
			</p>

			<ul className="text-muted-foreground text-xs">
				{recent.map((path) => (
					<li key={path}>{path}</li>
				))}
			</ul>

			<section className="rounded-md border p-3">
				<h2 className="mb-2 font-medium text-sm">{t("notes")}</h2>
				<EditorContent editor={editor} className="prose-sm" />
			</section>
		</main>
	);
}
