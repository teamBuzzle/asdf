import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { useTerminalSession } from "../use-terminal-session";

export function TerminalPane() {
	const { t } = useTranslation();
	const host = useRef<HTMLDivElement | null>(null);
	const session = useTerminalSession(host);

	return (
		<div className="relative min-h-0 overflow-hidden">
			{/* The emulator owns this element's children; never render into it. */}
			<div ref={host} className="absolute inset-0" />

			{match(session)
				.with({ status: "starting" }, () => (
					<p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
						{t("terminal.starting")}
					</p>
				))
				.with({ status: "exited" }, () => (
					<p className="absolute right-0 bottom-0 left-0 border-t bg-background px-3 py-1 text-muted-foreground text-xs">
						{t("terminal.exited")}
					</p>
				))
				.with({ status: "failed" }, ({ reason }) => (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center">
						<p className="text-sm">{t("terminal.failed")}</p>
						<p className="text-muted-foreground text-xs">{reason}</p>
					</div>
				))
				.otherwise(() => null)}
		</div>
	);
}
