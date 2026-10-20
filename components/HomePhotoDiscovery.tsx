"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Image as ImageIcon, Pause, Play, Star, X, Share2 } from "lucide-react";
import PhotoLikeButton from "@/components/PhotoLikeButton";
import { markPhotoNavigation, photoHref } from "@/lib/photo-link";
import { orderPhotosByAuthor } from "@/lib/home-discovery";

export type DiscoverPhoto = {
  profileId: string;
  profileSlug: string;
  author: string;
  imageUrl: string;
  caption: string;
  rating: number;
  count: number;
  likeCount?: number;
  likedByMe?: boolean;
};

function Stars({ rating }: { rating: number }) {
  return <span className="inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} von 5 Sternen`}>
    {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={13} className={star <= Math.round(rating) ? "fill-gold text-gold" : "fill-border text-border"} />)}
  </span>;
}

export function PhotoDialog({ photo, onClose, resumeLike = false }: { photo: DiscoverPhoto; onClose: () => void; resumeLike?: boolean }) {
  const [summary, setSummary] = useState<{ avg: number; count: number; myRating: number | null; eligible: boolean } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ profile_id: photo.profileId, image_url: photo.imageUrl });
    fetch(`/api/profile-image-ratings?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) { setSummary(data); setSelected(data.myRating ?? null); }
        else if (response.status !== 404) setError(data.error ?? "Bewertungen konnten nicht geladen werden.");
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
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/profile-image-ratings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: photo.profileId, image_url: photo.imageUrl, rating: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Bewertung konnte nicht gespeichert werden.");
      setSummary((current) => ({ avg: data.avg, count: data.count, myRating: data.myRating, eligible: current?.eligible ?? true }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Bewertung konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  }

  async function sharePhoto() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `Foto von ${photo.author}`, url });
      else { await navigator.clipboard.writeText(url); setShareMessage("Link kopiert"); }
    } catch { setShareMessage("Link konnte nicht geteilt werden."); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="relative flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-2xl" role="dialog" aria-modal="true" aria-label={`Foto von ${photo.author}`}>
        <button type="button" onClick={onClose} aria-label="Foto schließen" className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white hover:border-gold"><X size={20} /></button>
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black p-2 sm:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.imageUrl} alt={photo.caption || `Portfoliofoto von ${photo.author}`} className="max-h-[68dvh] max-w-full object-contain" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:px-6">
          <div className="min-w-0">
            <p className="break-words font-semibold text-text-primary">{photo.caption || "Portfoliofoto"}</p>
            <Link href={`/profile/${photo.profileSlug}#portfolio`} className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm text-gold hover:text-gold-light">{photo.author} <ArrowRight size={14} /> Profil ansehen</Link>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PhotoLikeButton profileId={photo.profileId} imageUrl={photo.imageUrl} initialCount={photo.likeCount ?? 0} initialLiked={photo.likedByMe ?? false} resumeLike={resumeLike} />
            <button type="button" onClick={() => void sharePhoto()} aria-label="Fotolink teilen" className="flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-sm text-text-primary hover:border-gold"><Share2 size={16} /> Teilen</button>
            {shareMessage && <span role="status" className="text-xs text-text-muted">{shareMessage}</span>}
          </div>
          <div className="flex min-w-[180px] flex-col items-start gap-2 sm:items-end">
            {summary && summary.count > 0 ? <div className="flex items-center gap-2"><Stars rating={summary.avg} /><span className="text-sm text-text-primary">{summary.avg.toFixed(1)}</span><span className="text-xs text-text-muted">({summary.count} {summary.count === 1 ? "Bewertung" : "Bewertungen"})</span></div> : <span className="text-sm text-text-muted">Noch keine Bewertungen</span>}
            {summary?.eligible && <div className="flex flex-wrap items-center gap-2" aria-label="Foto bewerten">
              <div className="flex" role="group" aria-label="Sterne auswählen">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setSelected(star)} aria-label={`${star} Sterne`} aria-pressed={selected === star} className="flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"><Star size={19} className={star <= (selected ?? 0) ? "fill-gold text-gold" : "text-text-muted"} /></button>)}</div>
              <button type="button" onClick={saveRating} disabled={!selected || saving} className="min-h-10 rounded-lg bg-gold px-3 text-xs font-semibold text-bg-primary disabled:opacity-50">{saving ? "Speichert…" : summary.myRating ? "Bewertung ändern" : "Bewerten"}</button>
            </div>}
            {summary && !summary.eligible && <p className="text-[11px] text-text-muted">Bewertungen sind nach bestätigter Zusammenarbeit möglich.</p>}
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

export function HomePhotoDiscovery({ ratedPhotos, newPhotos }: { ratedPhotos: DiscoverPhoto[]; newPhotos: DiscoverPhoto[] }) {
  const photos = orderPhotosByAuthor(ratedPhotos.length >= 3 ? ratedPhotos : newPhotos).slice(0, 6) as DiscoverPhoto[];
  const isRatedSelection = ratedPhotos.length >= 3;
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const activePhoto = photos[activeIndex];
  const nextPhoto = photos.length > 1 ? photos[(activeIndex + 1) % photos.length] : null;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
      setPlaying(!media.matches && photos.length > 1);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [photos.length]);

  useEffect(() => {
    if (!playing || hovered || focused || photos.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % photos.length), 6000);
    return () => window.clearInterval(timer);
  }, [focused, hovered, photos.length, playing]);

  function goTo(index: number) {
    setActiveIndex((index + photos.length) % photos.length);
    setPlaying(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget || photos.length < 2) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); goTo(activeIndex - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); goTo(activeIndex + 1); }
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    if (!touchStart.current || photos.length < 2) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) goTo(activeIndex + (dx < 0 ? 1 : -1));
  }

  function markImageFailed(imageUrl: string) {
    setFailedImages((previous) => new Set(previous).add(imageUrl));
  }

  return (
    <section className="border-y border-border bg-bg-primary py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gold">{isRatedSelection ? "Best of CineGenius" : "Neu entdecken"}</p>
            <h2 className="font-display text-xl font-bold text-text-primary sm:text-2xl">{isRatedSelection ? "Fotos, die begeistern" : "Frische Einblicke aus der Community"}</h2>
            {!isRatedSelection && <p className="mt-1 text-xs text-text-muted">Sobald genügend echte Bewertungen vorliegen, zeigen wir hier das Best of.</p>}
          </div>
          <Link href="/photo" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-gold hover:text-gold-light">Alle entdecken <ArrowRight size={14} /></Link>
        </div>
        {activePhoto ? <div
          className="outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-bg-primary"
          role="region"
          aria-label="Foto-Slideshow"
          aria-roledescription="Diashow"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
          onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY }; }}
          onTouchEnd={handleTouchEnd}
        >
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,24%)] md:gap-4">
            {photos.map((photo, index) => {
              const current = index === activeIndex;
              return <article key={`${photo.profileId}:${photo.imageUrl}`} hidden={!current} className="group relative min-w-0 overflow-hidden rounded-2xl bg-bg-elevated md:col-start-1 md:row-start-1">
                <div key={`${photo.imageUrl}:${activeIndex}`} className="animate-fade-in relative aspect-[4/3] overflow-hidden bg-bg-elevated motion-reduce:animate-none sm:aspect-[16/9] md:aspect-[2/1]">
                  {!failedImages.has(photo.imageUrl) ? <Link href={photoHref(photo.profileId, photo.imageUrl)} onClick={markPhotoNavigation} aria-label={`Foto öffnen: ${photo.caption || `Portfoliofoto von ${photo.author}`}`} className="absolute inset-0 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
                    <Image src={photo.imageUrl} alt={photo.caption || `Foto von ${photo.author}`} fill priority={index === 0} sizes="(max-width:767px) 100vw, (max-width:1023px) 92vw, 76vw" onError={() => markImageFailed(photo.imageUrl)} className="object-cover transition-opacity duration-700 motion-reduce:transition-none" />
                  </Link> : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-bg-elevated to-bg-primary text-text-muted"><div className="flex flex-col items-center gap-2"><ImageIcon size={30} /><span className="text-sm">Bild derzeit nicht verfügbar</span></div></div>}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/5" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-6 lg:p-8">
                    <div className="min-w-0 max-w-2xl text-white">
                      <Link href={`/profile/${photo.profileSlug}#portfolio`} className="pointer-events-auto inline-flex min-h-11 items-center text-base font-semibold hover:text-gold sm:text-lg">{photo.author}</Link>
                      <p className="line-clamp-2 text-sm text-white/75 sm:text-base">{photo.caption || "Portfolio-Einblick"}</p>
                      {isRatedSelection && <div className="mt-2 flex flex-wrap items-center gap-2 text-white"><Stars rating={photo.rating} /><span className="text-sm font-semibold">{photo.rating.toFixed(1)}</span><span className="text-xs text-white/65">{photo.count} {photo.count === 1 ? "Bewertung" : "Bewertungen"}</span></div>}
                    </div>
                    <Link href={photoHref(photo.profileId, photo.imageUrl)} onClick={markPhotoNavigation} aria-label="Foto in voller Größe öffnen" className="pointer-events-auto hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur hover:border-gold sm:flex"><ImageIcon size={18} /></Link>
                  </div>
                </div>
                <PhotoLikeButton profileId={photo.profileId} imageUrl={photo.imageUrl} initialCount={photo.likeCount ?? 0} initialLiked={photo.likedByMe ?? false} className="absolute right-3 top-3 z-10" />
              </article>;
            })}
            {nextPhoto && <button type="button" onClick={() => goTo(activeIndex + 1)} aria-label={`Nächstes Foto: ${nextPhoto.caption || nextPhoto.author}`} className="group relative hidden min-w-0 overflow-hidden rounded-2xl bg-bg-elevated text-left md:col-start-2 md:row-start-1 md:block">
              {!failedImages.has(nextPhoto.imageUrl) ? <Image src={nextPhoto.imageUrl} alt="" fill sizes="(max-width:1023px) 0px, 22vw" onError={() => markImageFailed(nextPhoto.imageUrl)} className="object-cover opacity-70 transition-opacity duration-500 group-hover:opacity-90" /> : <span className="absolute inset-0 bg-bg-elevated" />}
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/10" />
              <span className="absolute bottom-4 left-4 right-4 line-clamp-2 text-sm font-medium text-white">Als Nächstes · {nextPhoto.author}</span>
            </button>}
          </div>
          {photos.length > 1 && <div className="mt-3 flex items-center justify-between gap-3" aria-label="Slideshow-Steuerung">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => goTo(activeIndex - 1)} aria-label="Vorheriges Foto" className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary transition-colors hover:border-gold hover:text-gold"><ChevronLeft size={20} /></button>
              <button type="button" onClick={() => goTo(activeIndex + 1)} aria-label="Nächstes Foto" className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary transition-colors hover:border-gold hover:text-gold"><ChevronRight size={20} /></button>
              <button type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Diashow pausieren" : "Diashow starten"} aria-pressed={playing} className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-primary transition-colors hover:border-gold hover:text-gold">{playing ? <Pause size={17} /> : <Play size={17} />}</button>
            </div>
            <div className="flex min-w-0 items-center gap-3" aria-live="polite" aria-atomic="true">
              <div className="flex items-center gap-1" aria-hidden="true">{photos.map((photo, index) => <span key={`${photo.imageUrl}-position`} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-6 bg-gold" : "w-1.5 bg-border"}`} />)}</div>
              <span className="text-xs tabular-nums text-text-muted">{activeIndex + 1} / {photos.length}</span>
            </div>
            {reducedMotion && <span className="sr-only">Automatische Wiedergabe ist wegen der Einstellung für reduzierte Bewegung ausgeschaltet.</span>}
          </div>}
        </div> : <div className="rounded-xl border border-border bg-bg-secondary px-4 py-8 text-center text-sm text-text-muted">Noch keine öffentlichen Portfoliofotos zum Entdecken vorhanden.</div>}
      </div>
    </section>
  );
}
