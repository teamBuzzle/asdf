import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useTranslation } from "react-i18next";

export function NotesEditor() {
	const { t } = useTranslation();
	const editor = useEditor({
		extensions: [StarterKit],
		content: "<p></p>",
		editorProps: { attributes: { class: "min-h-24 outline-none" } },
	});

	return (
		<section className="rounded-md border p-3">
			<h2 className="mb-2 font-medium text-sm">{t("notes.title")}</h2>
			<EditorContent editor={editor} />
		</section>
	);
}
