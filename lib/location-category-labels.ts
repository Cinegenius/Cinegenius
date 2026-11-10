/** Translate known category labels without changing stored member values. */
const CATEGORY_KEYS: Readonly<Record<string, string>> = {
  Wohnen: "locLiving", Villa: "locVilla", Büro: "locOffice",
  Industrie: "locIndustry", Natur: "locNature", Gastronomie: "locGastronomy",
  Studio: "locFilmStudio", Filmstudio: "locFilmStudio",
  Fotostudio: "locPhotoStudio", Speziallocation: "locSpecial",
};

export function locationCategoryLabel(value: string, translate: (key: string) => string): string {
  return Object.hasOwn(CATEGORY_KEYS, value) ? translate(CATEGORY_KEYS[value]) : value;
}
