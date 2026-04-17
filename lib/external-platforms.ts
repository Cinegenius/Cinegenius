// ─── External Platform Definitions ───────────────────────────────────────────
// CineGenius only stores and displays links — no content import, no sync.

export interface ExternalPlatform {
  type: string;
  name: string;
  urlHints: string[];   // if non-empty, URL host must contain one of these
  abbr: string;
  textCls: string;
  bgCls: string;
  borderCls: string;
}

export interface ExternalProfileRow {
  id: string;
  platform_type: string;
  platform_name: string | null;
  url: string;
  custom_label: string | null;
  sort_order: number;
  is_public: boolean;
}

export const PLATFORMS: ExternalPlatform[] = [
  {
    type: "crew_united", name: "Crew United",
    urlHints: ["crew-united.com"],
    abbr: "CU", textCls: "text-orange-400", bgCls: "bg-orange-500/15", borderCls: "border-orange-500/20",
  },
  {
    type: "imdb", name: "IMDb",
    urlHints: ["imdb.com"],
    abbr: "IM", textCls: "text-yellow-400", bgCls: "bg-yellow-500/15", borderCls: "border-yellow-500/20",
  },
  {
    type: "behance", name: "Behance",
    urlHints: ["behance.net"],
    abbr: "Be", textCls: "text-blue-400", bgCls: "bg-blue-500/15", borderCls: "border-blue-500/20",
  },
  {
    type: "model_mayhem", name: "Model Mayhem",
    urlHints: ["modelmayhem.com"],
    abbr: "MM", textCls: "text-purple-400", bgCls: "bg-purple-500/15", borderCls: "border-purple-500/20",
  },
  {
    type: "models_com", name: "Models.com",
    urlHints: ["models.com"],
    abbr: "Mc", textCls: "text-pink-400", bgCls: "bg-pink-500/15", borderCls: "border-pink-500/20",
  },
  {
    type: "model_management", name: "ModelManagement.com",
    urlHints: ["modelmanagement.com"],
    abbr: "ML", textCls: "text-rose-400", bgCls: "bg-rose-500/15", borderCls: "border-rose-500/20",
  },
  {
    type: "instagram", name: "Instagram",
    urlHints: ["instagram.com"],
    abbr: "IG", textCls: "text-pink-400", bgCls: "bg-pink-500/15", borderCls: "border-pink-500/20",
  },
  {
    type: "linkedin", name: "LinkedIn",
    urlHints: ["linkedin.com"],
    abbr: "LI", textCls: "text-sky-400", bgCls: "bg-sky-500/15", borderCls: "border-sky-500/20",
  },
  {
    type: "facebook", name: "Facebook",
    urlHints: ["facebook.com", "fb.com"],
    abbr: "FB", textCls: "text-blue-400", bgCls: "bg-blue-500/15", borderCls: "border-blue-500/20",
  },
  {
    type: "tiktok", name: "TikTok",
    urlHints: ["tiktok.com"],
    abbr: "TK", textCls: "text-slate-300", bgCls: "bg-slate-500/15", borderCls: "border-slate-500/20",
  },
  {
    type: "youtube", name: "YouTube",
    urlHints: ["youtube.com", "youtu.be"],
    abbr: "YT", textCls: "text-red-400", bgCls: "bg-red-500/15", borderCls: "border-red-500/20",
  },
  {
    type: "vimeo", name: "Vimeo",
    urlHints: ["vimeo.com"],
    abbr: "Vi", textCls: "text-sky-400", bgCls: "bg-sky-500/15", borderCls: "border-sky-500/20",
  },
  {
    type: "website", name: "Persönliche Website",
    urlHints: [],
    abbr: "WW", textCls: "text-emerald-400", bgCls: "bg-emerald-500/15", borderCls: "border-emerald-500/20",
  },
  {
    type: "portfolio", name: "Portfolio-Website",
    urlHints: [],
    abbr: "PF", textCls: "text-violet-400", bgCls: "bg-violet-500/15", borderCls: "border-violet-500/20",
  },
  {
    type: "other", name: "Sonstige",
    urlHints: [],
    abbr: "→", textCls: "text-text-muted", bgCls: "bg-bg-elevated", borderCls: "border-border",
  },
];

export function getPlatform(type: string): ExternalPlatform {
  return PLATFORMS.find((p) => p.type === type) ?? {
    type, name: type, urlHints: [], abbr: "?",
    textCls: "text-text-muted", bgCls: "bg-bg-elevated", borderCls: "border-border",
  };
}

/**
 * Returns a warning string if the URL doesn't match the expected platform domain.
 * Returns null if OK.
 */
export function validatePlatformUrl(platformType: string, url: string): string | null {
  if (!url.trim()) return "URL ist Pflichtfeld";
  let parsed: URL;
  try {
    parsed = new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`);
  } catch {
    return "Keine gültige URL (z. B. https://...)";
  }
  const platform = getPlatform(platformType);
  if (!platform.urlHints.length) return null;
  const host = parsed.hostname.replace(/^www\./, "");
  const matches = platform.urlHints.some((hint) => host.endsWith(hint) || host === hint);
  if (!matches) {
    return `Diese URL sieht nicht nach ${platform.name} aus (erwartet: ${platform.urlHints[0]})`;
  }
  return null;
}
