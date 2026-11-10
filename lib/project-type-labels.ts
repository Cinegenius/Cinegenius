type Translator = (key: string) => string;

/** Curated system values only. Personal project formats keep their original text. */
const PROJECT_TYPE_KEYS: Readonly<Record<string, string>> = {
  Spielfilm: "Ui.text_031b1c1fc4b241",
  Kurzfilm: "Ui.text_75b346d26e4973",
  Film: "Ui.text_113af97940c301",
  Serie: "Ui.text_ab7743a4ad9a44",
  "TV / Serie": "Ui.text_75c196fdbc2c09",
  "TV / Episodic": "Ui.text_13faef85f075ea",
  "Serie / TV": "Ui.text_75c196fdbc2c09",
  Dokumentation: "projects.catDokumentation",
  Dokumentarfilm: "Ui.text_e2dec20c086399",
  Werbung: "home.showcaseAds",
  Werbefilm: "Ui.text_5c634ccc3ba66d",
  Imagefilm: "Ui.text_411e73c2f310f4",
  Musikvideo: "projects.catMusikvideo",
  Corporate: "projects.catCorporate",
  "Corporate Video": "Ui.text_5329bf3ff4340a",
  "Corporate Film": "Ui.text_3a7f36cb4e7257",
  "Social Media": "home.showcaseSocial",
  "Instagram / Reels": "ProjectTypeLabels.instagramReels",
  TikTok: "Ui.text_1bb6fcfbf1368a",
  YouTube: "Ui.text_fb7accfff8c6f8",
  "UGC Content": "ProjectTypeLabels.ugcContent",
  "Brand Content": "ProjectTypeLabels.brandContent",
  "Fashion Shooting": "ProjectTypeLabels.fashionShoot",
  "Produkt-Shooting": "ProjectTypeLabels.productShoot",
  "Event-Fotografie": "ProjectTypeLabels.eventPhotography",
  "Hochzeits-Fotografie": "ProjectTypeLabels.weddingPhotography",
  "Portrait-Shooting": "ProjectTypeLabels.portraitShoot",
  "Werbe-Fotografie": "ProjectTypeLabels.commercialPhotography",
  "Foto / Shooting": "Ui.text_f1ff7fc6fb8449",
  Foto: "Ui.text_494e0843d958b9",
  Event: "Organizations.entryType.event",
  "Event / Live": "Ui.text_eab270724977e8",
  Sonstiges: "profile.typeOther",
};

export function projectTypeLabel(value: string, translate: Translator): string {
  return Object.hasOwn(PROJECT_TYPE_KEYS, value) ? translate(PROJECT_TYPE_KEYS[value]) : value;
}

export function projectTypeOptions(values: readonly string[], translate: Translator, locale: string) {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return [...new Set(values)].map(value => ({ value, label: projectTypeLabel(value, translate) }))
    .sort((a, b) => collator.compare(a.label, b.label) || collator.compare(a.value, b.value));
}

export function normalizedCatalogueSearch(value: string, locale: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(locale);
}

/** Native labels augment the original German, English and curated alias search terms. */
export function roleOptionMatchesSearch(
  option: { label: string; labelEn?: string; aliases?: readonly string[]; description?: string },
  query: string,
  displayLabel: (value: string) => string,
  locale: string,
): boolean {
  const normalized = normalizedCatalogueSearch(query, locale);
  if (!normalized) return true;
  const terms = [option.label, option.labelEn ?? "", ...(option.aliases ?? []), displayLabel(option.label)];
  if (option.description) terms.push(option.description, displayLabel(option.description));
  return terms.some(term => normalizedCatalogueSearch(term, locale).includes(normalized));
}
