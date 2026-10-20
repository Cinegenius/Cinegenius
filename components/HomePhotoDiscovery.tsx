"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Image as ImageIcon, Pause, Play, Star, X, Share2 } from "lucide-react";
import PhotoLikeButton from "@/components/PhotoLikeButton";
import { markPhotoNavigation, markPhotoNavigationWithAnimation, photoHref } from "@/lib/photo-link";
import { orderPhotosByAuthor, repeatForSeamlessLoop, shouldAnimatePhotoBand } from "@/lib/home-discovery";

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

function PhotoBandCard({
  photo,
  isRatedSelection,
  failed,
  onImageError,
  onPhotoOpen,
  decorative = false,
  priority = false,
}: {
  photo: DiscoverPhoto;
  isRatedSelection: boolean;
  failed: boolean;
  onImageError: (imageUrl: string) => void;
  onPhotoOpen?: () => void;
  decorative?: boolean;
  priority?: boolean;
}) {
  const href = photoHref(photo.profileId, photo.imageUrl);
  return (
    <article aria-hidden={decorative || undefined} inert={decorative || undefined} className={`group relative aspect-[4/3] w-[82vw] max-w-[32rem] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-bg-elevated sm:aspect-[3/2] md:w-[40vw] lg:w-[30vw] xl:w-[25vw] ${decorative ? "pointer-events-none" : ""}`}>
      {!failed ? <Link href={href} onClick={decorative ? undefined : onPhotoOpen ?? (() => markPhotoNavigation())} aria-label={decorative ? undefined : `Foto öffnen: ${photo.caption || `Portfoliofoto von ${photo.author}`}`} tabIndex={decorative ? -1 : undefined} className="absolute inset-0 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
        <Image src={photo.imageUrl} alt={decorative ? "" : photo.caption || `Foto von ${photo.author}`} fill priority={priority} sizes="(max-width: 639px) 82vw, (max-width: 767px) 78vw, (max-width: 1023px) 40vw, (max-width: 1279px) 30vw, 25vw" onError={() => onImageError(photo.imageUrl)} className="object-cover" />
      </Link> : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-bg-elevated to-bg-primary text-text-muted"><div className="flex flex-col items-center gap-2"><ImageIcon size={28} /><span className="text-xs">Bild derzeit nicht verfügbar</span></div></div>}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      {!decorative && <PhotoLikeButton profileId={photo.profileId} imageUrl={photo.imageUrl} initialCount={photo.likeCount ?? 0} initialLiked={photo.likedByMe ?? false} className="absolute right-3 top-3 z-10" />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
        {decorative ? <p className="truncate text-sm font-medium">{photo.author}</p> : <Link href={`/profile/${photo.profileSlug}#portfolio`} className="pointer-events-auto inline-flex min-h-11 max-w-full items-center truncate text-sm font-semibold hover:text-gold sm:text-base">{photo.author}</Link>}
        <p className="line-clamp-1 text-xs text-white/75 sm:text-sm">{photo.caption || "Portfolio-Einblick"}</p>
        {isRatedSelection && <div className="mt-1.5 flex items-center gap-2 text-white"><Stars rating={photo.rating} /><span className="text-xs font-semibold">{photo.rating.toFixed(1)}</span><span className="text-[11px] text-white/70">({photo.count})</span></div>}
      </div>
    </article>
  );
}

export function HomePhotoDiscovery({ ratedPhotos, newPhotos }: { ratedPhotos: DiscoverPhoto[]; newPhotos: DiscoverPhoto[] }) {
  const photos = orderPhotosByAuthor(ratedPhotos.length >= 3 ? ratedPhotos : newPhotos).slice(0, 6) as DiscoverPhoto[];
  const isRatedSelection = ratedPhotos.length >= 3;
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const returnAnimationTime = useRef<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cycleDuration, setCycleDuration] = useState(60);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const loopPhotos = repeatForSeamlessLoop(photos);
  const animated = shouldAnimatePhotoBand(photos.length, reducedMotion);
  const shouldRun = animated && isInView && tabVisible && !userPaused && !hovered && !focused;
  const staticGallery = !animated;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("cinegenius-photo-band-time");
      if (stored !== null) {
        const time = Number(stored);
        if (Number.isFinite(time) && time >= 0) returnAnimationTime.current = time;
        window.sessionStorage.removeItem("cinegenius-photo-band-time");
      }
    } catch { /* The animation starts from its natural position when storage is unavailable. */ }
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setIsInView(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), { threshold: 0.01 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setTabVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || !animated) return;
    const updateDuration = () => {
      const width = group.getBoundingClientRect().width;
      if (width > 0) setCycleDuration(Math.max(36, width / 26));
    };
    updateDuration();
    const observer = new ResizeObserver(updateDuration);
    observer.observe(group);
    return () => observer.disconnect();
  }, [animated, photos.length]);

  useEffect(() => {
    if (!shouldRun || returnAnimationTime.current === null) return;
    const frame = window.requestAnimationFrame(() => {
      const animation = trackRef.current?.getAnimations()[0];
      if (!animation) return;
      animation.pause();
      animation.currentTime = returnAnimationTime.current;
      returnAnimationTime.current = null;
      animation.play();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [shouldRun]);

  function markImageFailed(imageUrl: string) {
    setFailedImages((previous) => new Set(previous).add(imageUrl));
  }

  const trackStyle = { "--photo-band-duration": `${cycleDuration}s` } as CSSProperties;
  const markHomePhotoOpen = () => {
    const currentTime = trackRef.current?.getAnimations()[0]?.currentTime;
    markPhotoNavigationWithAnimation(typeof currentTime === "number" ? currentTime : undefined);
  };

  return (
    <section ref={sectionRef} className="border-y border-border bg-bg-primary py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-7">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gold">{isRatedSelection ? "Best of CineGenius" : "Neu entdecken"}</p>
            <h2 className="font-display text-xl font-bold text-text-primary sm:text-2xl">{isRatedSelection ? "Fotos, die begeistern" : "Frische Einblicke aus der Community"}</h2>
            {!isRatedSelection && <p className="mt-1 text-xs text-text-muted">Sobald genügend echte Bewertungen vorliegen, zeigen wir hier das Best of.</p>}
          </div>
          <div className="flex items-center gap-2">
            {animated && <button type="button" onClick={() => setUserPaused((paused) => !paused)} aria-label={userPaused ? "Fotoband fortsetzen" : "Fotoband pausieren"} aria-pressed={userPaused} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:border-gold hover:text-gold">{userPaused ? <Play size={16} /> : <Pause size={16} />}</button>}
            <Link href="/photo" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-gold hover:text-gold-light">Alle entdecken <ArrowRight size={14} /></Link>
          </div>
        </div>
        {photos.length > 0 ? <div
          className="overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-bg-primary"
          role="region"
          aria-label={staticGallery ? "Fotogalerie" : "Automatisch laufendes Fotoband"}
          aria-roledescription={staticGallery ? undefined : "Fotoband"}
          tabIndex={0}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
        >
          {staticGallery ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {photos.map((photo, index) => <PhotoBandCard key={`${photo.profileId}:${photo.imageUrl}`} photo={photo} isRatedSelection={isRatedSelection} failed={failedImages.has(photo.imageUrl)} onImageError={markImageFailed} priority={index === 0} onPhotoOpen={markHomePhotoOpen} />)}
          </div> : <div ref={trackRef} className="home-photo-band-track" data-paused={!shouldRun} style={trackStyle}>
            {[0, 1].map((copy) => <div key={`photo-band-copy-${copy}`} ref={copy === 0 ? groupRef : undefined} className="home-photo-band-group" aria-hidden={copy === 1 || undefined} inert={copy === 1 || undefined}>
              {loopPhotos.slice(copy * photos.length, (copy + 1) * photos.length).map((photo, index) => <PhotoBandCard key={`${copy}:${photo.profileId}:${photo.imageUrl}`} photo={photo} isRatedSelection={isRatedSelection} failed={failedImages.has(photo.imageUrl)} onImageError={markImageFailed} decorative={copy === 1} priority={copy === 0 && index === 0} onPhotoOpen={markHomePhotoOpen} />)}
            </div>)}
          </div>}
          {!staticGallery && <span className="sr-only" aria-live="polite">{userPaused ? "Fotoband pausiert." : "Fotoband läuft automatisch von rechts nach links."}</span>}
          {reducedMotion && <span className="sr-only">Wegen der Einstellung für reduzierte Bewegung wird eine statische Galerie angezeigt.</span>}
        </div> : <div className="rounded-xl border border-border bg-bg-secondary px-4 py-8 text-center text-sm text-text-muted">Noch keine öffentlichen Portfoliofotos zum Entdecken vorhanden.</div>}
      </div>
    </section>
  );
}
