import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import ptBR from "./locales/pt-BR.json";
import ru from "./locales/ru.json";
import zhCN from "./locales/zh-CN.json";

// English plus Korean, Japanese and Spanish, plus the languages of the five
// countries with the most developers — United States, India, China, Brazil,
// Russia — where India works in English. See CLAUDE.md before adding one.
const resources = {
	en: { translation: en },
	ko: { translation: ko },
	"zh-CN": { translation: zhCN },
	ja: { translation: ja },
	es: { translation: es },
	"pt-BR": { translation: ptBR },
	ru: { translation: ru },
};

i18n.use(initReactI18next).init({
	lng: globalThis.navigator?.language,
	supportedLngs: Object.keys(resources),
	// `en-GB` resolves to `en` without listing every region.
	nonExplicitSupportedLngs: true,
	// Regional variants we do not ship land on the one we do, rather than on English.
	fallbackLng: {
		pt: ["pt-BR"],
		zh: ["zh-CN"],
		default: ["en"],
	},
	interpolation: { escapeValue: false },
	resources,
});
