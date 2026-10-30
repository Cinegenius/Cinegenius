import Link from "next/link";
import { useTranslations } from "next-intl";
import { isAiGeneratedSiteImage } from "@/lib/site-image-provenance";

/** Only render with confirmed provenance; appearance alone is never evidence of AI origin. */
export default function AiDisclosureBadge({ source, subtle = false, className = "" }: { source: string; subtle?: boolean; className?: string }) {
  const t = useTranslations("AiTransparency");
  if (!isAiGeneratedSiteImage(source)) return null;
  return <Link href="/ki-transparenz#bilder" aria-label={t("imageLabelAccessible")}
    className={`inline-flex items-center font-medium leading-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${subtle
      ? "min-h-8 rounded px-1 text-[11px] text-text-muted hover:text-text-primary hover:underline"
      : "min-h-9 rounded-lg border border-white/20 bg-bg-primary/90 px-2.5 py-1 text-[11px] text-white/90 shadow-sm hover:border-gold/50"} ${className}`}>
    {t("imageLabel")}
  </Link>;
}
