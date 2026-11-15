import type { SearchArea } from "./unified-search";

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
