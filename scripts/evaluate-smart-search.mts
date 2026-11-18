/** Opt-in staged evaluation with synthetic requests only. No member history,
 * secret exports, public endpoint, automatic retries or production mutations. */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { buildGenieInstructions, GENIE_LINKS, GENIE_LOCALES } from "../lib/genie";
import { SEARCH_WISH_SCHEMA, readSearchPlan, type SearchWish } from "../lib/unified-search";
import { keywordSearchPlan, normalizeKeywordPlan } from "../lib/unified-search-intent";
import { matchesWishPlaces, wishMarketplaceCategories, wishSearchTerms } from "../lib/unified-search-matching";
import { departments } from "../lib/departments";

const checkOnly = process.argv.includes("--check");
if (process.env.CG_EVALUATE_SMART !== "1" && !checkOnly) process.exit(0);
const source = ts.createSourceFile("plan.ts", readFileSync("lib/unified-search-plan-server.ts", "utf8"), ts.ScriptTarget.Latest);
let instructions = "";
for (const statement of source.statements) if (ts.isVariableStatement(statement)) {
  for (const declaration of statement.declarationList.declarations) if (declaration.name.getText(source) === "UNIFIED_SEARCH_INSTRUCTIONS"
    && declaration.initializer && (ts.isNoSubstitutionTemplateLiteral(declaration.initializer) || ts.isTemplateExpression(declaration.initializer))) {
      // Evaluate only our checked-in instruction template and its catalogue
      // interpolation, never provider output or user content.
      instructions = new Function("departments", `return ${declaration.initializer.getText(source)}`)(departments);
    }
}
if (!instructions) throw new Error("Cannot read current Smart instructions.");
const requests: Record<string, string> = {
  de: "Für meinen Dreh in München möchte ich eine Lampe und Kostüme mieten.",
  en: "For my shoot in Munich I would like to rent a lamp and costumes.",
  es: "Para mi rodaje en Múnich quiero alquilar una lámpara y vestuario.",
  it: "Per le riprese a Monaco di Baviera vorrei noleggiare una lampada e dei costumi.",
  cs: "Na natáčení v Mnichově si chci pronajmout lampu a kostýmy.",
  hu: "A müncheni forgatáshoz szeretnék egy lámpát és jelmezeket bérelni.",
  nl: "Voor mijn opnames in München wil ik een lamp en kostuums huren.",
  "nl-BE": "Voor mijn opnames in München wil ik een lamp en kostuums huren.",
  sv: "Till min inspelning i München vill jag hyra en lampa och kostymer.",
  fr: "Pour mon tournage à Munich, je voudrais louer une lampe et des costumes.",
  pl: "Na zdjęcia w Monachium chcę wynająć lampę i kostiumy.",
  "pt-PT": "Para as minhas filmagens em Munique, quero alugar uma lâmpada e figurinos.",
  "zh-Hans": "我想为慕尼黑的拍摄租一盏灯和一些戏服。",
  ja: "ミュンヘンでの撮影のために、照明ライトと衣装をレンタルしたいです。",
  ko: "뮌헨 촬영을 위해 조명과 의상을 대여하고 싶어요.",
  ru: "Для съёмок в Мюнхене хочу арендовать лампу и костюмы.",
  uk: "Для зйомок у Мюнхені хочу орендувати лампу та костюми.",
};
const munich = { city: "München", place_city_id: "geonames:2867714", place_country_code: "DE" };
type Case = { id: string; locale: string; query: string; check: (wishes: SearchWish[]) => boolean };
const cases: Case[] = Object.entries(requests).map(([locale, query]) => ({ id: locale, locale, query, check: wishes =>
  ["licht-quellen", "kostuem-accessoires"].every(category => wishes.some(wish => ["all", "marketplace"].includes(wish.area)
    && wishMarketplaceCategories(wish.query, key => key).includes(category) && wish.places.length && matchesWishPlaces(munich, wish))) }));
cases.push({ id: "independent-places", locale: "de", query: "Für Berlin brauche ich zwei sparkies, aber den foquista brauche ich in München.", check: wishes =>
  wishes.some(wish => wish.area === "crew" && wish.quantity === 2 && wishSearchTerms(wish).includes("Beleuchter (Electrician)") && wish.places.some(p => p.city === "Berlin"))
  && wishes.some(wish => wish.area === "crew" && wishSearchTerms(wish).includes("1st AC (Focus Puller)") && wish.places.length > 0 && matchesWishPlaces(munich, wish)) });
cases.push({ id: "exact-model", locale: "de", query: "Ich möchte genau eine ARRI M18 in München ausleihen, keine andere Lampe.", check: wishes => wishes.length === 1
  && wishes[0].query.toLowerCase().includes("m18") && !wishMarketplaceCategories(wishes[0].query, key => key).includes("licht-quellen") });
const schema = { type: "object", additionalProperties: false, properties: { reply: { type: "string" }, linkIds: { type: "array", items: { type: "string", enum: GENIE_LINKS.map(link => link.id) } },
  topic: { type: "string", enum: ["general", "platform_costs"] }, searches: SEARCH_WISH_SCHEMA, language: { type: "string", enum: GENIE_LOCALES } }, required: ["reply", "linkIds", "topic", "searches", "language"] };
const checks = [...cases.map(item => ({ ...item, model: "gpt-4.1-mini" })), ...cases.filter(item => ["de", "independent-places", "exact-model"].includes(item.id)).map(item => ({ ...item, model: "gpt-6-astra" }))];
if (checks.length > 22) throw new Error("Evaluation request budget exceeded.");
if (checkOnly) { console.log(`Smart evaluation prepared: ${checks.length} synthetic requests, no API calls.`); process.exit(0); }
if (process.env.VERCEL !== "1") throw new Error("Smart evaluation requires the explicit staged build.");
const key = process.env.OPENAI_API_KEY?.trim();
if (!key || key.length < 20 || /placeholder|sensitive/i.test(key)) throw new Error("No usable staged AI credential.");
let next = 0, failed = 0;
async function worker() {
  while (next < checks.length) {
    const item = checks[next++];
    try {
      const personal = item.model === "gpt-6-astra";
      const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", redirect: "error", signal: AbortSignal.timeout(60000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: item.model, store: false,
          max_output_tokens: personal ? 8192 : 2400, ...(personal ? { service_tier: "ultrafast", reasoning: { effort: "low" } } : {}),
          instructions: `${buildGenieInstructions("general", item.locale)}\nReturn plain JSON matching the schema. ${instructions}`,
          input: [{ role: "user", content: item.query }], text: { format: { type: "json_schema", name: "genie_advice", strict: true, schema } } }) });
      if (!response.ok) { await response.body?.cancel(); throw new Error(`Provider status ${response.status}`); }
      const body = await response.json();
      const text = (body.output ?? []).flatMap((part: { content?: { type: string; text?: string }[] }) => part.content ?? []).filter((part: { type: string }) => part.type === "output_text").map((part: { text: string }) => part.text).join("");
      const advice = JSON.parse(text);
      const provided = readSearchPlan({ version: 2, searches: advice.searches.map(({ quantity, ...wish }: SearchWish) => ({ ...wish, ...(quantity ? { quantity } : {}) })) });
      const plan = keywordSearchPlan(item.query, item.locale) ?? (provided && normalizeKeywordPlan(provided, item.locale));
      const passed = !!plan && item.check(plan.searches);
      if (!passed) failed++;
      console.log("SMART_EVAL " + JSON.stringify({ id: item.id, model: item.model, passed, searches: plan?.searches ?? [], usage: body.usage }));
    } catch (error) {
      failed++;
      console.log("SMART_EVAL " + JSON.stringify({ id: item.id, model: item.model, passed: false, error: error instanceof Error && /^Provider status \d+$/.test(error.message) ? error.message : "Evaluation failed" }));
    }
  }
}
await Promise.all([worker(), worker()]);
console.log("SMART_EVAL_SUMMARY " + JSON.stringify({ total: checks.length, passed: checks.length - failed, failed, syntheticOnly: true }));
if (failed) throw new Error(`${failed} Smart evaluation checks failed.`);
