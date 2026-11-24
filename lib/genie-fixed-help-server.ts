import "server-only";
import { getTranslations } from "next-intl/server";
import { GENIE_LINKS, type validateGenieRequest } from "./genie";

type Input = Extract<ReturnType<typeof validateGenieRequest>, { ok: true }>["value"];
// Reuse maintained help-page copy, not a second generated knowledge base.
const topics = [
  { question: "text_9ecf3a88360bb2", answer: "text_d78932ee50b0dd", link: "setup", aliases: ["wie erstelle ich ein profil", "wie erstelle ich mein profil", "how do i create a profile"] },
  { question: "text_f466f86a12a014", answer: "text_ddea6729a28713", link: "company-setup", aliases: ["wie trage ich meine firma ein", "wie erstelle ich ein firmenprofil", "how do i add my company"] },
  { question: "text_1ade5581502ca9", answer: "text_b169cf44e42adb", link: "companies", aliases: [] },
  { question: "text_4a610b516161ec", answer: "text_e1893e6dffad16", link: "help", aliases: [] },
  { question: "text_35080d686eadb3", answer: "text_b1bedfc7113d76", link: "messages", aliases: [] },
  { question: "text_44e28c14fa9ae7", answer: "text_2f3e72f1bf18d0", link: "locations", aliases: [] },
  { question: "text_5f048e755d7f6c", answer: "text_b0007f0e5db38e", link: "marketplace", aliases: [] },
  { question: "text_2fd5173f2cbb9c", answer: null, link: null, aliases: ["was kostet cinegenius", "is cinegenius free", "what does cinegenius cost"] },
] as const;

function questionKey(value: string) {
  return value.normalize("NFC").trim().toLowerCase().replace(/[?？.!！。]+$/u, "").replace(/\s+/gu, " ");
}

/** Exact stand-alone known questions only. Negations, extra requirements and
 * conversational follow-ups remain with the existing interpreter. */
export async function fixedGenieHelp(input: Input) {
  if (input.writing || input.searchContext || input.messages.length !== 1) return null;
  const content = questionKey(input.messages[0].content);
  const ui = await getTranslations({ locale: input.locale, namespace: "Ui" });
  const topic = topics.find(item => questionKey(ui(item.question)) === content || item.aliases.some(alias => alias === content && input.locale === (/^(wie|was) /.test(alias) ? "de" : "en")));
  if (!topic) return null;
  if (!topic.answer) {
    const pricing = await getTranslations({ locale: input.locale, namespace: "SupportMediation" });
    return { reply: pricing("genieSummary"), links: [], language: input.locale };
  }
  const labels = await getTranslations({ locale: input.locale, namespace: "Genie.destinations" });
  const link = GENIE_LINKS.find(item => item.id === topic.link)!;
  return { reply: ui(topic.answer), links: [{ href: link.href, label: labels(link.id) }], language: input.locale };
}
