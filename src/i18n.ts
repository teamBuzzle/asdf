import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
	lng: "ko",
	fallbackLng: "en",
	interpolation: { escapeValue: false },
	resources: {
		en: { translation: { title: "goldeye", notes: "Notes" } },
		ko: { translation: { title: "goldeye", notes: "노트" } },
	},
});
