import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadAdminReview, ReviewError } from "@/lib/admin-review-server";
import AdminReviewDetail from "@/components/admin/AdminReviewDetail";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false, noarchive: true }, title: "Admin · CineGenius" };
export default async function ReviewPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  let review;
  try { review = await loadAdminReview(kind, id); }
  catch (error) {
    const t = await getTranslations("AdminReview");
    return <main className="site-container pt-24 pb-10"><p role="alert" className="rounded-xl border border-crimson/30 p-5 text-crimson-light">{t(error instanceof ReviewError ? error.code : "loadError")}</p><Link href="/admin" className="mt-5 inline-flex min-h-11 items-center text-gold">{t("back")}</Link></main>;
  }
  return <AdminReviewDetail review={review.dto} />;
}
