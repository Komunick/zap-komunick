import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { messages } from "./languages";

// Zap Komunick: Portuguese is the default language. The browser language is no
// longer guessed; a language chosen by the user is kept in localStorage.
try {
  if (!localStorage.getItem("language")) {
    localStorage.setItem("language", "pt");
  }
} catch (e) {
  // storage blocked: the fallback below is Portuguese as well
}

i18n.use(LanguageDetector).init({
  debug: false,
  detection: {
    order: ["localStorage"],
    lookupLocalStorage: "language",
    caches: ["localStorage"]
  },
  defaultNS: ["translations"],
  fallbackLng: "pt",
  ns: ["translations"],
  resources: messages
});

export { i18n };
