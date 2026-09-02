import {
	AlertTriangle,
	ArrowUpCircle,
	CheckCircle2,
	Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { Button } from "@/components/ui/button";
import { isVisible, type UpdateState } from "../types";

type Props = {
	state: UpdateState;
	onOpen: () => void;
};

/** The only always-on surface. It renders nothing at all when there is nothing
 * to act on, so a silent failed check leaves no empty slot behind. */
export function UpdateChip({ state, onOpen }: Props) {
	const { t } = useTranslation();

	if (!isVisible(state)) return null;

	const percent =
		state.status === "downloading" && state.total
			? Math.round((state.received / state.total) * 100)
			: null;

	const { icon, label, aria } = match(state)
		.with({ status: "available" }, ({ update }) => ({
			icon: <ArrowUpCircle className="size-4" />,
			label: t("update.chip.available", { version: update.version }),
			aria: t("update.chip.ariaAvailable", { version: update.version }),
		}))
		.with({ status: "downloading" }, () => ({
			icon: <Loader2 className="size-4 animate-spin" />,
			label:
				percent === null
					? t("update.chip.downloadingUnknown")
					: t("update.chip.downloading", { percent }),
			aria: t("update.chip.ariaDownloading", { percent: percent ?? 0 }),
		}))
		.with({ status: "ready" }, ({ update }) => ({
			icon: <CheckCircle2 className="size-4" />,
			label: t("update.chip.ready"),
			aria: t("update.chip.ariaReady", { version: update.version }),
		}))
		.otherwise(() => ({
			icon: <AlertTriangle className="size-4" />,
			label: t("update.chip.error"),
			aria: t("update.chip.ariaError"),
		}));

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={onOpen}
			aria-label={aria}
			className="text-muted-foreground text-xs"
		>
			{icon}
			{label}
		</Button>
	);
}
