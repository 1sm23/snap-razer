import rawFaq from "./faq.json";
import { DEFAULT_LANGUAGE, type SupportedLanguage } from "../i18n";

type FaqLocale = {
  question: string;
  answer: string[];
};

type FaqId = keyof typeof rawFaq;

export function getFaqItem(id: FaqId, language: SupportedLanguage): FaqLocale {
  return rawFaq[id][language] ?? rawFaq[id][DEFAULT_LANGUAGE];
}
