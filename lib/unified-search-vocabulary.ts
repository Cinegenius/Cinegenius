import languageIndex from "./i18n/smart-language-index.json" with { type: "json" };
import { departments } from "./departments";
import { occupationById, occupationCatalogue } from "./primary-occupation";
import { occupationTextKey } from "./search-text-key";
import type { SearchArea } from "./unified-search";

// Only the server search pipeline imports this module. The compact, generated
// recognition index contains labels, not seventeen application message bundles.
function uniqueIndex(rows: [string, string[]][]) {
  const index = new Map<string, string | null>();
  for (const [id, aliases] of rows) for (const alias of aliases) {
    if (!index.has(alias)) index.set(alias, id);
    else if (index.get(alias) !== id) index.set(alias, null);
  }
  return index;
}
const roleIndex = uniqueIndex(languageIndex.roles as [string, string[]][]);
const departmentIndex = uniqueIndex(languageIndex.departments as [string, string[]][]);

export function vocabularyDepartment(query: string) {
  const id = departmentIndex.get(occupationTextKey(query));
  return id ? departments.find(dept => dept.id === id) : undefined;
}

type Concept = { area: SearchArea | "all"; query: string; aliases: string[]; terms?: string[]; groups?: string[] };
// Reviewed language aliases, not inferred equivalence between whole departments.
// A particular hat/model stays precise; only a generic costume/lamp expands its
// corresponding inventory groups. Source notes: docs/smart-search-language.md.
export const searchConcepts: readonly Concept[] = [
  { area: "marketplace", query: "Lampe", groups: ["licht-quellen"],
    aliases: ["Lampe", "Lampen", "Leuchte", "Leuchten", "Scheinwerfer", "lamp", "lamps", "lighting fixture", "lighting fixtures", "film light", "film lights", "lámpara", "lámparas", "lampada", "lampade", "lampa", "lampy", "svítidlo", "svítidla", "lámpa", "lámpák", "lámpát", "lampen", "lampa", "lampor", "lampe", "lampes", "lâmpada", "lâmpadas", "luminária", "luminárias", "灯", "灯具", "影视灯", "撮影ライト", "照明ライト", "ランプ", "촬영 조명", "조명등", "램프", "лампа", "лампы", "светильник", "осветительный прибор", "лампи", "світильник"],
    terms: ["Lampe", "Leuchte", "Scheinwerfer", "Lichtquelle", "lamp", "lighting fixture", "film light"] },
  { area: "all", query: "Kostüm", groups: ["kostuem-kleidung", "kostuem-accessoires"],
    aliases: ["Kostüm", "Kostüme", "kostuem", "ostvüm", "costume", "costumes", "vestuario", "vestuário", "costumi", "kostým", "kostýmy", "jelmez", "jelmezek", "kostuum", "kostuums", "kostym", "kostymer", "kostium", "kostiumy", "戏服", "服装", "コスチューム", "衣装", "의상", "костюм", "костюмы", "костюми"],
    terms: ["Kostüm", "Costume", "Kostuem", "costumi", "vestuario", "jelmez", "kostuum", "kostium", "衣装", "의상", "костюм"] },
  { area: "marketplace", query: "Hut",
    aliases: ["Hut", "Hüte", "hat", "hats", "sombrero", "sombreros", "cappello", "cappelli", "klobouk", "klobouky", "kalap", "kalapok", "hoed", "hoeden", "hatt", "hattar", "chapeau", "chapeaux", "kapelusz", "kapelusze", "chapéu", "chapéus", "帽子", "모자", "шляпа", "шляпы", "капелюх", "капелюхи"],
    terms: ["Hut", "Hüte", "hat", "sombrero", "cappello", "klobouk", "kalap", "hoed", "hatt", "chapeau", "kapelusz", "chapéu", "帽子", "모자", "шляпа", "капелюх"] },
  { area: "marketplace", query: "Boot",
    aliases: ["Boot", "Boote", "boat", "boats", "barco", "barcos", "barca", "barche", "loď", "lodě", "hajó", "hajók", "hajót", "boten", "båt", "båtar", "bateau", "bateaux", "łódź", "łodzie", "船", "ボート", "보트", "лодка", "лодки", "човен", "човни"],
    terms: ["Boot", "Boat", "Schiff", "Yacht", "barco", "barca", "loď", "hajó", "bateau", "łódź", "船", "ボート", "보트", "лодка", "човен"] },
  { area: "locations", query: "Studio",
    aliases: ["Studio", "Studios", "estudio", "estudios", "ateliér", "ateliéry", "stúdió", "stúdiók", "stúdiót", "estúdio", "estúdios", "摄影棚", "摄影工作室", "スタジオ", "스튜디오", "студия", "студии", "студію", "студія"],
    terms: ["Studio", "Fotostudio", "Filmstudio", "estudio", "estúdio", "ateliér", "stúdió", "摄影棚", "スタジオ", "스튜디오", "студия", "студія"] },
  { area: "all", query: "Polizei",
    aliases: ["Polizei", "Police", "Polizia", "Policía", "Policie", "Rendőrség", "Politie", "Polis", "policja", "polícia", "警察", "경찰", "полиция", "поліція"],
    terms: ["Polizei", "Police", "Polizia", "Policía", "Policie", "Rendőrség", "Politie", "Polis", "policja", "polícia", "警察", "경찰", "полиция", "поліція", "Streifenwagen", "Streifenpolizist"] },
];
const concepts = new Map(searchConcepts.flatMap(concept => concept.aliases.map(alias => [occupationTextKey(alias), concept] as const)));
export const searchConcept = (query: string) => concepts.get(occupationTextKey(query));

const jargon: Concept[] = [
  { area: "crew", query: "Director of Photography (DoP)", aliases: ["DP", "DOP", "D.O.P.", "D.P."] },
  { area: "crew", query: "Gaffer (Oberbeleuchter)", aliases: ["gaff", "chef électricien", "chef élec", "chief lighting technician", "oberbeleuchtr"] },
  { area: "crew", query: "Beleuchter (Electrician)", aliases: ["spark", "sparks", "sparky", "sparkies", "lighting technician", "lighting tech", "électricien de plateau", "beleuchtr"] },
  { area: "crew", query: "1st AC (Focus Puller)", aliases: ["1AC", "1stAC", "first AC", "focus puller", "foquista", "premier assistant caméra"] },
  { area: "crew", query: "2nd AC (Clapper / Loader)", aliases: ["2AC", "2ndAC", "second AC"] },
  { area: "crew", query: "Camera Operator", aliases: ["cam op", "camop", "camera op"], terms: ["Camera Operator", "A-Kamera Operator", "B-Kamera Operator", "C-Kamera Operator"] },
];
const jargonIndex = new Map(jargon.flatMap(concept => [concept.query, ...concept.aliases].map(alias => [occupationTextKey(alias), concept] as const)));
export const searchJargon = (query: string) => jargonIndex.get(occupationTextKey(query));
export const ambiguousCrewShorthand = (query: string) => ["best boy", "swing", "operator", "pa"].includes(occupationTextKey(query));

export function vocabularyRole(query: string) {
  if (ambiguousCrewShorthand(query)) return undefined;
  const alias = searchJargon(query);
  if (alias) return occupationCatalogue.find(role => role.label === alias.query);
  const id = roleIndex.get(occupationTextKey(query));
  return id ? occupationById(id) ?? undefined : undefined;
}

export function vocabularyKeyword(query: string): { area: SearchArea | "all"; query: string; department: string } | undefined {
  if (ambiguousCrewShorthand(query)) return undefined;
  const concept = searchJargon(query) ?? searchConcept(query);
  if (concept) return { area: concept.area, query: concept.query, department: "" };
  const dept = vocabularyDepartment(query);
  if (dept) return { area: "all", query: dept.label, department: "" };
  const role = vocabularyRole(query);
  if (role) return { area: "crew", query: role.label, department: "" };
}
