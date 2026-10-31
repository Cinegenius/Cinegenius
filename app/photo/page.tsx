import type { Metadata } from "next";
import Link from "next/link";
import { Camera, ArrowRight } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { PhotoGallery } from "@/components/PhotoGallery";

export const metadata: Metadata = {
  title: "Fotos & Portfolio — CineGenius",
  description: "Entdecke öffentliche Profilfotos, Arbeitsproben und Bilder aus Firmenprofilen der CineGenius-Community.",
};

export const revalidate = 300;

import { getCommunityMedia } from "@/lib/community-media-server";
export const dynamic = "force-dynamic";

export default async function PhotoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1.5 text-xs font-semibold text-gold"><Camera size={11} /> CineGenius Galerie</div>
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div className="min-w-0">
              <h1 className="mb-3 font-display text-4xl font-bold text-text-primary sm:text-5xl">Fotos & Portfolio</h1>
              <p className="max-w-xl leading-relaxed text-text-muted">Entdecke öffentliche Profilfotos, Arbeitsproben und Bilder aus Firmenprofilen der CineGenius-Community.</p>
            </div>
            <Link href="/creators" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-bg-primary transition-colors hover:bg-gold-light">Crew entdecken <ArrowRight size={14} /></Link>
          </div>
        </section>
        {imageParam && !selectedWithLikes && <p role="status" className="site-container mb-6 text-sm text-text-muted">Dieses Foto ist nicht mehr öffentlich verfügbar. Hier findest du die aktuellen Einblicke.</p>}
        <PhotoGallery items={gridItems} selectedPhoto={selectedWithLikes} resumeLike={resumeLike} />
        <nav aria-label="Galerieseiten" className="site-container flex items-center justify-between gap-3 pb-24 text-sm text-gold">
          {page > 1 ? <Link href={`/photo?page=${page - 1}`} className="min-h-11 p-3">Zurück</Link> : <span />}
          <span className="text-text-muted">Seite {page} · {total} Einblicke</span>
          {page * 48 < total ? <Link href={`/photo?page=${page + 1}`} className="min-h-11 p-3">Weitere Einblicke</Link> : <span />}
        </nav>
      </div>
    </div>
  );
}
