"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { reviewPath, type ReviewKind } from "@/lib/admin-review";

export default function AdminReviewLink({ kind, id }: { kind: ReviewKind; id: string }) {
  const t = useTranslations("AdminReview");
  return <Link href={reviewPath(kind, id)} prefetch={false} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold"><Eye size={14} />{t("open")}</Link>;
}
