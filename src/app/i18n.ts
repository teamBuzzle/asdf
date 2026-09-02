import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
	lng: "ko",
	fallbackLng: "en",
	interpolation: { escapeValue: false },
	resources: {
		en: {
			translation: {
				app: { title: "goldeye" },
				workspace: {
					open: "Open",
					pathLabel: "Workspace path",
					idle: "Pick a folder to open.",
					opening: "Opening…",
				},
				notes: { title: "Notes" },
			},
		},
		ko: {
			translation: {
				app: { title: "goldeye" },
				workspace: {
					open: "열기",
					pathLabel: "워크스페이스 경로",
					idle: "열 폴더를 선택하세요.",
					opening: "여는 중…",
				},
				notes: { title: "노트" },
			},
		},
	},
});
