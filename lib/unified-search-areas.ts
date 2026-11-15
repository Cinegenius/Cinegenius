import type { SearchArea, SearchWish } from "./unified-search";

// Search vocabulary, not interface copy. Canonical area words represent an
// entire directory; they must not become a literal title/description filter.
export const SEARCH_AREA_WORDS: Partial<Record<SearchArea, string[]>> = {
  crew: ["Crew"],
  locations: ["Location", "Locations", "Drehort", "Drehorte", "Localizaciones", "Locaciones", "Luoghi di ripresa", "Lokace", "Forgatási helyszínek", "Locaties", "Inspelningsplatser"],
  marketplace: ["Marktplatz", "Marketplace", "Mercado", "Mercatino", "Tržiště", "Piactér", "Marktplaats", "Marknadsplats"],
  companies: ["Firma", "Firmen", "Companies", "Empresas", "Aziende", "Firmy", "Cégek", "Bedrijven", "Företag"],
  jobs: ["Jobs", "Empleos", "Lavori", "Práce", "Állások", "Vacatures", "Jobb"],
  animals: ["Filmtiere", "Film animals", "Animales de cine", "Animali da cinema", "Filmová zvířata", "Filmes állatok", "Filmdieren", "Filmdjur"],
  projects: ["Projekte", "Projects", "Proyectos", "Progetti", "Projekty", "Projektek", "Projecten", "Projekt"],
  news: ["News", "Nachrichten aus der Branche", "Noticias", "Notizie", "Novinky", "Hírek", "Nieuws", "Nyheter"],
  organizations: ["Organisationen", "Organizations", "Organizaciones", "Organizzazioni", "Organizace", "Szervezetek", "Organisaties", "Organisationer"],
};

export function isWholeAreaQuery(area: string, query: string) {
  return SEARCH_AREA_WORDS[area as SearchArea]?.some(word => word.toLocaleLowerCase() === query.trim().toLocaleLowerCase()) ?? false;
}

export const DEPARTMENT_HEADS_QUERY = "Heads of Department";
const headNames = ["heads of department", "head of departments", "headofs", "heads", "abteilungsleitungen", "abteilungsleiter", "gewerkeleitungen", "jefes de departamento", "capi reparto", "vedouci oddeleni", "reszlegvezetok", "afdelingshoofden", "avdelningschefer"];
export const isDepartmentHeadsQuery = (query: string) => headNames.includes(query.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim());

export const PRODUCTION_CREW_QUERY = "Production Crew";
const productionCrewNames = ["production crew", "filmcrew", "film crew", "produktionscrew", "komplette crew", "equipo de rodaje", "troupe cinematografica", "filmovy stab", "forgatocsoport", "filmploeg", "filmteam"];
export const isProductionCrewQuery = (query: string) => productionCrewNames.includes(query.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim());

/** Lightweight display mapping for generated semantic queries; member-written
 * names and unknown query text remain unchanged. No catalogue in the client bundle. */
export function searchQueryTitle(wish: SearchWish, t: (key: string) => string): string {
  if (wish.area === "crew" && isProductionCrewQuery(wish.query)) return t("productionCrew");
  if (wish.area === "crew" && isDepartmentHeadsQuery(wish.query)) return t("departmentHeads");
  if (isWholeAreaQuery(wish.area, wish.query)) return t(`areas.${wish.area}`);
  if (wish.area === "companies" && wish.query === "Filmproduktion") return t("productionCompanies");
  if (wish.area === "companies" && wish.query === "Catering") return t("catering");
  if (wish.area === "all" && wish.query === "Polizei") return t("policeTheme");
  if (wish.area === "all" && wish.query === "Mittelalter") return t("medievalTheme");
  return wish.query;
}
