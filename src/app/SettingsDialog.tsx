import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type Theme = "system" | "light" | "dark";

const THEMES: Theme[] = ["system", "light", "dark"];

// The locales the app ships. Keep in step with src/app/i18n.ts.
const LOCALES = ["en", "ko", "zh-CN", "ja", "es", "pt-BR", "ru"] as const;

const LOCALE_NAMES: Record<(typeof LOCALES)[number], string> = {
	en: "English",
	ko: "한국어",
	"zh-CN": "中文",
	ja: "日本語",
	es: "Español",
	"pt-BR": "Português",
	ru: "Русский",
};

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	theme: Theme;
	onTheme: (theme: Theme) => void;
};

export function SettingsDialog({ open, onOpenChange, theme, onTheme }: Props) {
	const { t, i18n } = useTranslation();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("settings.title")}</DialogTitle>
					<DialogDescription>{t("settings.subtitle")}</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<fieldset className="flex flex-col gap-1.5">
						<legend className="font-medium text-xs">
							{t("settings.theme")}
						</legend>
						<div className="flex gap-1 rounded-lg bg-muted p-1">
							{THEMES.map((value) => (
								<button
									key={value}
									type="button"
									aria-pressed={theme === value}
									onClick={() => onTheme(value)}
									className={cn(
										"flex-1 rounded-md px-2 py-1.5 text-xs transition-colors",
										theme === value
											? "bg-background font-medium shadow-xs"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{t(`settings.themes.${value}`)}
								</button>
							))}
						</div>
					</fieldset>

					<fieldset className="flex flex-col gap-1.5">
						<legend className="font-medium text-xs">
							{t("settings.language")}
						</legend>
						<div className="flex flex-wrap gap-1">
							{LOCALES.map((locale) => (
								<button
									key={locale}
									type="button"
									aria-pressed={i18n.resolvedLanguage === locale}
									onClick={() => void i18n.changeLanguage(locale)}
									className={cn(
										"rounded-md border px-2.5 py-1 text-xs transition-colors",
										i18n.resolvedLanguage === locale
											? "border-foreground bg-foreground text-background"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{LOCALE_NAMES[locale]}
								</button>
							))}
						</div>
					</fieldset>
				</div>

				<div className="flex justify-end">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						{t("settings.close")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
