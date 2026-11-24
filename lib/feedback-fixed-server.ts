import "server-only";
import { getTranslations } from "next-intl/server";
import { readFeedbackAdvice, type FeedbackAdvice, type FeedbackInput, type FeedbackItem } from "./community-feedback";

const replies: Record<string, [string[], string[], string[]]> = {
  de: [["ja"], ["nein"], ["überspringen", "weiter"]],
  en: [["yes"], ["no"], ["skip", "next"]],
  es: [["sí", "si"], ["no"], ["omitir", "siguiente"]],
  it: [["sì", "si"], ["no"], ["salta", "avanti"]],
  cs: [["ano"], ["ne"], ["přeskočit", "další"]],
  hu: [["igen"], ["nem"], ["kihagyás", "következő"]],
  nl: [["ja"], ["nee"], ["overslaan", "volgende"]],
  "nl-BE": [["ja"], ["nee"], ["overslaan", "volgende"]],
  sv: [["ja"], ["nej"], ["hoppa över", "nästa"]],
  fr: [["oui"], ["non"], ["passer", "suivant"]],
  pl: [["tak"], ["nie"], ["pomiń", "dalej"]],
  "pt-PT": [["sim"], ["não", "nao"], ["saltar", "seguinte"]],
  "zh-Hans": [["是", "是的", "对"], ["不", "不是", "不对"], ["跳过", "下一个"]],
  ja: [["はい"], ["いいえ"], ["スキップ", "次へ"]],
  ko: [["네", "예"], ["아니요"], ["건너뛰기", "다음"]],
  ru: [["да"], ["нет"], ["пропустить", "далее"]],
  uk: [["так"], ["ні"], ["пропустити", "далі"]],
};
const questions = ["opening", "quick.equipment", "quick.signup", "quick.listing", "quick.contact"] as const;
const normalize = (value: string) => value.normalize("NFC").trim().toLowerCase().replace(/[.!！。]+$/u, "");

/** Replay only a fully recognized fixed sequence. Any free text, old AI reply,
 * changed language or ambiguous confirmation falls back with the ENTIRE history. */
export async function fixedFeedback(input: FeedbackInput): Promise<FeedbackAdvice | null> {
  if (!replies[input.locale] || input.messages.length > questions.length * 2 - 1) return null;
  const [t, de] = await Promise.all([
    getTranslations({ locale: input.locale, namespace: "Feedback" }),
    getTranslations({ locale: "de", namespace: "Feedback" }),
  ]);
  const items: FeedbackItem[] = [];
  for (let index = 0; index < input.messages.length; index += 2) {
    const step = index / 2;
    if (index > 0 && input.messages[index - 1].content !== t(questions[step])) return null;
    const message = input.messages[index];
    const answer = replies[input.locale].findIndex(words => words.includes(normalize(message.content)));
    if (answer < 0) return null;
    if (answer !== 2) {
      const prefix = answer === 0 ? "positive" : "issue";
      items.push({ title: t(`quick.${prefix}Title`), titleDe: de(`quick.${prefix}Title`),
        problem: t(`quick.${prefix}Problem`, { question: t(questions[step]) }),
        problemDe: de(`quick.${prefix}Problem`, { question: de(questions[step]) }),
        suggestion: t(`quick.${prefix}Suggestion`), suggestionDe: de(`quick.${prefix}Suggestion`),
        priority: "normal", source: index, quote: message.content });
    }
    if (answer === 1) {
      if (index !== input.messages.length - 1) return null;
      return readFeedbackAdvice({ reply: t("quick.clarify"), items }, input.messages);
    }
  }
  const next = (input.messages.length + 1) / 2;
  return readFeedbackAdvice({ reply: next < questions.length ? t(questions[next])
    : t(items.length ? "quick.submit" : "quick.free"), items }, input.messages);
}
