import type { Metadata } from "next";
import Link from "next/link";
import { Camera, ArrowRight } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { PhotoGallery } from "@/components/PhotoGallery";
import { getTranslations } from "next-intl/server";


export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/photo" },
  title: tMetadata('m_be7ae4214fc1'),
  description: tMetadata('m_27c362172a4e'),
};
}

export const revalidate = 300;

import { getCommunityMedia } from "@/lib/community-media-server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";
export const dynamic = "force-dynamic";

export default async function PhotoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const uiText = await getTranslations();

  const params = await searchParams;
  const profileParam = typeof params.profile_id === "string" ? params.profile_id : "";
  const imageParam = typeof params.image_url === "string" ? params.image_url : "";
  const resumeLike = params.action === "like";
  const page = Math.max(1, Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const { userId } = await auth();
  const { photos: gridItems, total } = await getCommunityMedia({ page, viewerId: userId });
  const selectedWithLikes = profileParam && imageParam
    ? (await getCommunityMedia({ ownerId: profileParam.startsWith("media:") ? undefined : profileParam, imageUrl: imageParam, limit: 1, viewerId: userId })).photos[0] ?? null : null;
  return (
    <div className="relative min-h-screen bg-black">
      <div className="relative z-10">
        <section className="site-container pb-8 pt-32 sm:pb-10 sm:pt-36">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-xs font-semibold text-gold">{uiText.rich("Ui.text_9daae6775df589", { part1: () => (<Camera size={11} />) })}</div>
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div className="min-w-0">
              <h1 className="mb-3 font-display text-4xl font-bold text-text-primary sm:text-5xl">{uiText("Ui.text_be7ae4214fc19c")}</h1>
              <p className="max-w-xl leading-relaxed text-text-muted">{uiText("Ui.text_27c362172a4e44")}</p>
            </div>
            <Link href="/creators" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-bg-primary transition-colors hover:bg-gold-light">{uiText.rich("Ui.text_a5a362cd6aedad", { part1: () => (<ArrowRight size={14} />) })}</Link>
          </div>
        </section>
        {imageParam && !selectedWithLikes && <p role="status" className="site-container mb-6 text-sm text-text-muted">{uiText("Ui.text_c115f0a7e58370")}</p>}
        <PhotoGallery items={gridItems} selectedPhoto={selectedWithLikes} resumeLike={resumeLike} />
        <nav aria-label={uiText("Ui.text_6642485ca65572")} className="site-container flex items-center justify-between gap-3 pb-24 text-sm text-gold">{uiText.rich("Ui.text_366656bc16effa", { value1: () => (page > 1 ? <Link href={`/photo?page=${page - 1}`} className="min-h-11 p-3">{uiText("setup.copy99")}</Link> : <span />), value3: () => (page), value4: () => (total), part2: chunks => (<span className="text-text-muted">{chunks}</span>), value5: () => (page * 48 < total ? <Link href={`/photo?page=${page + 1}`} className="min-h-11 p-3">{uiText("Ui.text_e8ed3a778cde39")}</Link> : <span />) })}</nav>
      </div>
    </div>
  );
}
