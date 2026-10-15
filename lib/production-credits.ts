export type ProductionCredit = {
  title: string;
  year?: number | null;
  format?: string | null;
  note?: string | null;
  image_urls?: string[];
};

export type ProductionCreditDraft = {
  id: string;
  title: string;
  year: string;
  format: string;
  note: string;
  image_urls: string[];
};

export const PRODUCTION_FORMATS = [
  "Film / Serie",
  "Werbung",
  "Musikvideo",
  "Social Media",
  "Foto / Shooting",
  "Sonstiges",
];

export function createProductionCreditDraft(): ProductionCreditDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    year: "",
    format: "",
    note: "",
    image_urls: [],
  };
}

export function serializeProductionCredits(drafts: ProductionCreditDraft[]): ProductionCredit[] {
  return drafts
    .filter((credit) => credit.title.trim())
    .map((credit) => ({
      title: credit.title.trim().slice(0, 200),
      year: credit.year ? Number.parseInt(credit.year, 10) || null : null,
      format: credit.format || null,
      note: credit.note.trim().slice(0, 800) || null,
      image_urls: credit.image_urls.slice(0, 4),
    }));
}

export function parseProductionCredits(value: unknown): ProductionCredit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ProductionCredit[] => {
    if (!entry || typeof entry !== "object") return [];
    const credit = entry as Record<string, unknown>;
    if (typeof credit.title !== "string" || !credit.title.trim()) return [];
    return [{
      title: credit.title,
      year: typeof credit.year === "number" ? credit.year : null,
      format: typeof credit.format === "string" ? credit.format : null,
      note: typeof credit.note === "string" ? credit.note : null,
      image_urls: Array.isArray(credit.image_urls)
        ? credit.image_urls.filter((url): url is string => typeof url === "string").slice(0, 4)
        : [],
    }];
  });
}
