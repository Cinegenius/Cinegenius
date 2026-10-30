import Link from "next/link";
import { useTranslations } from "next-intl";

export type ContentUsageContext = "profile" | "company" | "offer" | "project" | "board";
export type ContentUsageVisibility = "private" | "restricted" | "pending" | "public" | "configured";

/** Informational only: no consent, validation or publication side effects.
 * Use configured when a form can edit multiple visibility states; never infer public access.
 */
export default function ContentUsageNotice({ context, visibility }: {
  context: ContentUsageContext;
  visibility: ContentUsageVisibility;
}) {
  const t = useTranslations("ContentUsageNotice");
  const visibilityKey = visibility === "public" ? `public.${context}` : visibility;

  return <div className="mt-3 min-w-0 text-xs leading-6 text-text-secondary [overflow-wrap:anywhere]">
    <p>{t("short")}</p>
    <details className="mt-1">
      <summary className="min-h-11 cursor-pointer py-2 text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
        {t("details")}
      </summary>
      <div className="space-y-2 pb-2">
        <p>{t("rights")}</p>
        <p>{t(visibilityKey)}</p>
        {visibility === "configured" && <p>{t(`public.${context}`)}</p>}
        <Link href="/bildrechte" className="inline-flex min-h-11 items-center text-gold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
          {t("learnMore")}
        </Link>
      </div>
    </details>
  </div>;
}
