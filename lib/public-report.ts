export const PUBLIC_REPORT_CATEGORIES = [
  "illegal_content",
  "rights",
  "fraud",
  "harassment",
  "child_safety",
  "other",
] as const;

export type PublicReportCategory = (typeof PUBLIC_REPORT_CATEGORIES)[number];

export type PublicReportInput = {
  target: string;
  category: string;
  details: string;
  reporterName?: string;
  reporterEmail?: string;
  goodFaith: unknown;
};

export type PublicReport = {
  target: string;
  category: PublicReportCategory;
  details: string;
  reporterName: string | null;
  reporterEmail: string | null;
};

const CATEGORY_SET = new Set<string>(PUBLIC_REPORT_CATEGORIES);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CINEGENIUS_HOSTS = new Set([
  "cinegenius.co",
  "www.cinegenius.co",
  "cinegenius.de",
  "www.cinegenius.de",
]);

function normalizedText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return Array.from(value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()).slice(0, maxLength + 1).join("");
}

function validTarget(value: string) {
  if (!value || value.length > 500) return false;
  if (value.startsWith("/")) return value.length > 1 && !value.startsWith("//");
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && CINEGENIUS_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function validatePublicReport(input: PublicReportInput): { ok: true; value: PublicReport } | { ok: false; error: "target" | "category" | "details" | "email" | "goodFaith" } {
  const target = normalizedText(input.target, 500);
  if (!validTarget(target)) return { ok: false, error: "target" };

  const category = normalizedText(input.category, 50);
  if (!CATEGORY_SET.has(category)) return { ok: false, error: "category" };

  const details = normalizedText(input.details, 5000);
  if (details.length < 20 || details.length > 5000) return { ok: false, error: "details" };

  const reporterName = normalizedText(input.reporterName ?? "", 160);
  const reporterEmail = normalizedText(input.reporterEmail ?? "", 254).toLowerCase();
  if (reporterEmail && !EMAIL_PATTERN.test(reporterEmail)) return { ok: false, error: "email" };

  if (input.goodFaith !== true) return { ok: false, error: "goodFaith" };

  return {
    ok: true,
    value: {
      target,
      category: category as PublicReportCategory,
      details,
      reporterName: reporterName || null,
      reporterEmail: reporterEmail || null,
    },
  };
}
