"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Image as ImageIcon, Star, X } from "lucide-react";

export type DiscoverPhoto = {
  profileId: string;
  profileSlug: string;
  author: string;
  imageUrl: string;
  caption: string;
  rating: number;
  count: number;
};

function Stars({ rating }: { rating: number }) {
  return <span className="inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} von 5 Sternen`}>
    {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={13} className={star <= Math.round(rating) ? "fill-gold text-gold" : "fill-border text-border"} />)}
  </span>;
}

function PhotoDialog({ photo, onClose }: { photo: DiscoverPhoto; onClose: () => void }) {
  const [summary, setSummary] = useState<{ avg: number; count: number; myRating: number | null; eligible: boolean } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ profile_id: photo.profileId, image_url: photo.imageUrl });
    fetch(`/api/profile-image-ratings?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) {
          setSummary(data);
          setSelected(data.myRating ?? null);
        } else if (response.status !== 404) setError(data.error ?? "Bewertungen konnten nicht geladen werden.");
      })
      .catch(() => {});
    return () => controller.abort();
  }, [photo.profileId, photo.imageUrl]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function saveRating() {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/profile-image-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: photo.profileId, image_url: photo.imageUrl, rating: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Bewertung konnte nicht gespeichert werden.");
      setSummary((current) => ({ avg: data.avg, count: data.count, myRating: data.myRating, eligible: current?.eligible ?? true }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bewertung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-2xl" role="dialog" aria-modal="true" aria-label={`Foto von ${photo.author}`}>
        <button type="button" onClick={onClose} aria-label="Foto schließen" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white hover:border-gold">
          <X size={20} />
        </button>
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-2 sm:p-4">
          {/* Keep the complete original visible in the detail view. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.imageUrl} alt={photo.caption || `Portfoliofoto von ${photo.author}`} className="max-h-[68dvh] max-w-full object-contain" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">{photo.caption || "Portfoliofoto"}</p>
            <Link href={`/profile/${photo.profileSlug}#portfolio`} className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm text-gold hover:text-gold-light">
              {photo.author} <ArrowRight size={14} /> Profil ansehen
            </Link>
          </div>
          <div className="flex min-w-[180px] flex-col items-start gap-2 sm:items-end">
            {summary && summary.count > 0 ? <div className="flex items-center gap-2"><Stars rating={summary.avg} /><span className="text-sm text-text-primary">{summary.avg.toFixed(1)}</span><span className="text-xs text-text-muted">({summary.count} {summary.count === 1 ? "Bewertung" : "Bewertungen"})</span></div> : <span className="text-sm text-text-muted">Noch keine Bewertungen</span>}
            {summary?.eligible && (
              <div className="flex flex-wrap items-center gap-2" aria-label="Foto bewerten">
                <div className="flex" role="group" aria-label="Sterne auswählen">
                  {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setSelected(star)} aria-label={`${star} Sterne`} aria-pressed={selected === star} className="flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"><Star size={19} className={star <= (selected ?? 0) ? "fill-gold text-gold" : "text-text-muted"} /></button>)}
                </div>
                <button type="button" onClick={saveRating} disabled={!selected || saving} className="min-h-10 rounded-lg bg-gold px-3 text-xs font-semibold text-bg-primary disabled:opacity-50">{saving ? "Speichert…" : summary.myRating ? "Bewertung ändern" : "Bewerten"}</button>
              </div>
            )}
            {summary && !summary.eligible && <p className="text-[11px] text-text-muted">Bewertungen sind nach bestätigter Zusammenarbeit möglich.</p>}
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

export function HomePhotoDiscovery({ ratedPhotos, newPhotos }: { ratedPhotos: DiscoverPhoto[]; newPhotos: DiscoverPhoto[] }) {
  const [activePhoto, setActivePhoto] = useState<DiscoverPhoto | null>(null);
  const closePhoto = useCallback(() => setActivePhoto(null), []);
  const photos = ratedPhotos.length >= 3 ? ratedPhotos : newPhotos;
  const isRatedSelection = ratedPhotos.length >= 3;
  return (
    <>
      {activePhoto && <PhotoDialog photo={activePhoto} onClose={closePhoto} />}
      <section className="py-10 sm:py-14 border-y border-border bg-bg-secondary/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gold">{isRatedSelection ? "Best of CineGenius" : "Neu entdecken"}</p>
              <h2 className="font-display text-xl font-bold text-text-primary sm:text-2xl">{isRatedSelection ? "Fotos, die begeistern" : "Frische Einblicke aus der Community"}</h2>
              {!isRatedSelection && <p className="mt-1 text-xs text-text-muted">Sobald genügend echte Bewertungen vorliegen, zeigen wir hier das Best of.</p>}
            </div>
            <Link href="/photo" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-gold hover:text-gold-light">Alle entdecken <ArrowRight size={14} /></Link>
          </div>
          {photos.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {photos.slice(0, 4).map((photo) => (
              <button key={`${photo.profileId}:${photo.imageUrl}`} type="button" onClick={() => setActivePhoto(photo)} className="group overflow-hidden rounded-xl border border-border bg-bg-primary text-left transition-colors hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
                <div className="relative aspect-[4/3] overflow-hidden bg-bg-elevated">
                  <Image src={photo.imageUrl} alt={photo.caption || `Foto von ${photo.author}`} fill sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  <span className="absolute bottom-2 right-2 rounded-full border border-white/15 bg-black/65 p-2 text-white"><ImageIcon size={14} /></span>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-text-primary">{photo.author}</p>
                  {isRatedSelection ? <div className="mt-1 flex flex-wrap items-center gap-1.5"><Stars rating={photo.rating} /><span className="text-xs font-semibold text-text-primary">{photo.rating.toFixed(1)}</span><span className="text-[11px] text-text-muted">({photo.count} {photo.count === 1 ? "Bewertung" : "Bewertungen"})</span></div> : <p className="mt-1 line-clamp-1 text-xs text-text-muted">{photo.caption || "Portfolio-Einblick"}</p>}
                </div>
              </button>
            ))}
          </div> : <div className="rounded-xl border border-border bg-bg-primary/70 px-4 py-8 text-center text-sm text-text-muted">Noch keine öffentlichen Portfoliofotos zum Entdecken vorhanden.</div>}
        </div>
      </section>
    </>
  );
}
