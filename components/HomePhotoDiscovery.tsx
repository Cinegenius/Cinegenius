"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
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
    <article aria-hidden={decorative || undefined} inert={decorative || undefined} className={`home-photo-band-card group relative aspect-[4/3] w-[165px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-bg-elevated sm:w-[200px] lg:w-[240px] xl:w-[250px] ${decorative ? "pointer-events-none" : ""}`}>
      {!failed ? <Link href={href} onClick={decorative ? undefined : onPhotoOpen ?? (() => markPhotoNavigation())} aria-label={decorative ? undefined : `Foto öffnen: ${photo.caption || `Portfoliofoto von ${photo.author}`}`} tabIndex={decorative ? -1 : undefined} className="absolute inset-0 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
        <Image src={photo.imageUrl} alt={decorative ? "" : photo.caption || `Foto von ${photo.author}`} fill priority={priority} sizes="(max-width: 639px) 165px, (max-width: 1023px) 200px, (max-width: 1279px) 240px, 250px" onError={() => onImageError(photo.imageUrl)} draggable={false} className="object-cover" />
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
  const bandViewportRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<Array<HTMLDivElement | null>>([null, null]);
  const groupRefs = useRef<Array<HTMLDivElement | null>>([null, null]);
  const returnAnimationTimes = useRef<Array<number | null>>([null, null]);
  const pointerRef = useRef<{ id: number; row: number; lastX: number; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cycleDurations, setCycleDurations] = useState<[number, number]>([60, 60]);
  const [groupMinWidths, setGroupMinWidths] = useState<[number, number]>([0, 0]);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const animated = shouldAnimatePhotoBand(photos.length, reducedMotion);
  const shouldRun = animated && isInView && tabVisible && !userPaused && !hovered && !focused && !isDragging;
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
        if (Number.isFinite(time) && time >= 0) returnAnimationTimes.current[0] = time;
        window.sessionStorage.removeItem("cinegenius-photo-band-time");
      }
      const reverseStored = window.sessionStorage.getItem("cinegenius-photo-band-time-reverse");
      if (reverseStored !== null) {
        const time = Number(reverseStored);
        if (Number.isFinite(time) && time >= 0) returnAnimationTimes.current[1] = time;
        window.sessionStorage.removeItem("cinegenius-photo-band-time-reverse");
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
    const groups = groupRefs.current.filter((group): group is HTMLDivElement => group !== null);
    const viewport = bandViewportRef.current;
    if (groups.length === 0 || !viewport || !animated) return;
    const updateDuration = () => {
      const viewportWidth = viewport.clientWidth;
      setGroupMinWidths((current) => current[0] === viewportWidth && current[1] === viewportWidth ? current : [viewportWidth, viewportWidth]);
      setCycleDurations((current) => {
        const next: [number, number] = [...current];
        let changed = false;
        for (const row of [0, 1] as const) {
          const width = groupRefs.current[row]?.getBoundingClientRect().width ?? 0;
          if (width > 0) {
            const duration = Math.max(36, width / 26);
            if (next[row] !== duration) {
              next[row] = duration;
              changed = true;
            }
          }
        }
        return changed ? next : current;
      });
    };
    updateDuration();
    const observer = new ResizeObserver(updateDuration);
    groups.forEach((group) => observer.observe(group));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [animated, photos.length]);

  useEffect(() => () => {
    if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
  }, []);

  useEffect(() => {
    if (!shouldRun || !returnAnimationTimes.current.some((time) => time !== null)) return;
    const frame = window.requestAnimationFrame(() => {
      returnAnimationTimes.current.forEach((time, row) => {
        const animation = trackRefs.current[row]?.getAnimations()[0];
        if (time === null || !animation) return;
        animation.pause();
        animation.currentTime = time;
        returnAnimationTimes.current[row] = null;
        animation.play();
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [shouldRun]);

  function markImageFailed(imageUrl: string) {
    setFailedImages((previous) => new Set(previous).add(imageUrl));
  }

  function beginPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!animated || !event.isPrimary || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, input, textarea, select")) return;

    const track = (event.target as HTMLElement).closest<HTMLElement>("[data-photo-band-row]");
    const row = track ? Number(track.dataset.photoBandRow) : event.clientY < event.currentTarget.getBoundingClientRect().top + event.currentTarget.clientHeight / 2 ? 0 : 1;
    pointerRef.current = {
      id: event.pointerId,
      row: row === 1 ? 1 : 0,
      lastX: event.clientX,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function movePointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    const totalX = event.clientX - pointer.startX;
    const totalY = event.clientY - pointer.startY;
    if (!pointer.moved && Math.max(Math.abs(totalX), Math.abs(totalY)) < 6) return;
    if (!pointer.moved && Math.abs(totalY) > Math.abs(totalX)) {
      pointerRef.current = null;
      setIsDragging(false);
      return;
    }

    pointer.moved = true;
    const cycleWidth = groupRefs.current[pointer.row]?.getBoundingClientRect().width ?? 0;
    const animation = trackRefs.current[pointer.row]?.getAnimations()[0];
    const durationMs = cycleDurations[pointer.row] * 1000;
    if (cycleWidth > 0 && durationMs > 0 && animation && typeof animation.currentTime === "number") {
      const deltaX = event.clientX - pointer.lastX;
      const direction = pointer.row === 0 ? -1 : 1;
      const nextTime = animation.currentTime + direction * (deltaX / cycleWidth) * durationMs;
      animation.currentTime = ((nextTime % durationMs) + durationMs) % durationMs;
    }
    pointer.lastX = event.clientX;
  }

  function endPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    if (pointer.moved) {
      suppressClickRef.current = true;
      if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = setTimeout(() => {
        suppressClickRef.current = false;
        suppressClickTimerRef.current = null;
      }, 400);
    }
    pointerRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function suppressDraggedClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
    if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = null;
  }

  const markHomePhotoOpen = () => {
    const currentTimes = trackRefs.current.map((track) => track?.getAnimations()[0]?.currentTime);
    markPhotoNavigationWithAnimation(typeof currentTimes[0] === "number" ? currentTimes[0] : undefined);
    try {
      if (typeof currentTimes[1] === "number") window.sessionStorage.setItem("cinegenius-photo-band-time-reverse", String(currentTimes[1]));
    } catch { /* A blocked session store must not prevent opening a photo. */ }
  };

  return (
    <section ref={sectionRef} className="border-y border-border bg-bg-primary py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 sm:mb-5">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gold">{isRatedSelection ? "Best of CineGenius" : "Neu entdecken"}</p>
            <h2 className="font-display text-xl font-bold text-text-primary sm:text-2xl">{isRatedSelection ? "Fotos, die begeistern" : "Frische Einblicke aus der Community"}</h2>
            {!isRatedSelection && <p className="mt-1 text-xs text-text-muted">Sobald genügend echte Bewertungen vorliegen, zeigen wir hier das Best of.</p>}
          </div>
          <div className="flex items-center gap-2">
            {animated && <button type="button" onClick={() => setUserPaused((paused) => !paused)} aria-label={userPaused ? "Fotobänder fortsetzen" : "Fotobänder pausieren"} aria-pressed={userPaused} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:border-gold hover:text-gold">{userPaused ? <Play size={16} /> : <Pause size={16} />}</button>}
            <Link href="/photo" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-gold hover:text-gold-light">Alle entdecken <ArrowRight size={14} /></Link>
          </div>
        </div>
        {photos.length > 0 ? <div
          ref={bandViewportRef}
          className="home-photo-band-viewport outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-bg-primary"
          data-dragging={isDragging ? "true" : "false"}
          data-draggable={animated ? "true" : "false"}
          role="region"
          aria-label={staticGallery ? "Fotogalerie" : "Zwei automatisch gegenläufige Fotobänder. Mit Finger wischen oder Maus ziehen."}
          aria-roledescription={staticGallery ? undefined : "Fotobänder"}
          tabIndex={0}
          onPointerDown={beginPointerDrag}
          onPointerMove={movePointerDrag}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
          onClickCapture={suppressDraggedClick}
          onDragStart={(event) => event.preventDefault()}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}
        >
          {staticGallery ? <div className="home-photo-band-static-grid">
            {photos.map((photo, index) => <PhotoBandCard key={`${photo.profileId}:${photo.imageUrl}`} photo={photo} isRatedSelection={isRatedSelection} failed={failedImages.has(photo.imageUrl)} onImageError={markImageFailed} priority={index === 0} onPhotoOpen={markHomePhotoOpen} />)}
          </div> : <div className="home-photo-band-stack">
            {[0, 1].map((row) => {
              const rowPhotos = photos.filter((_, index) => index % 2 === row);
              if (row === 1) rowPhotos.reverse();
              const rowLoopPhotos = repeatForSeamlessLoop(rowPhotos);
              return <div key={`photo-band-row-${row}`} ref={(element) => { trackRefs.current[row] = element; }} className={`home-photo-band-track ${row === 0 ? "home-photo-band-track--left" : "home-photo-band-track--right"}`} data-paused={!shouldRun} data-photo-band-row={row} style={{ "--photo-band-duration": `${cycleDurations[row]}s` } as CSSProperties}>
                {[0, 1].map((copy) => <div key={`photo-band-row-${row}-copy-${copy}`} ref={(element) => { if (copy === 0) groupRefs.current[row] = element; }} className="home-photo-band-group" style={{ "--photo-band-group-min-width": `${groupMinWidths[row]}px` } as CSSProperties} aria-hidden={copy === 1 || undefined} inert={copy === 1 || undefined}>
                  {rowLoopPhotos.slice(copy * rowPhotos.length, (copy + 1) * rowPhotos.length).map((photo, index) => <PhotoBandCard key={`${row}:${copy}:${photo.profileId}:${photo.imageUrl}`} photo={photo} isRatedSelection={isRatedSelection} failed={failedImages.has(photo.imageUrl)} onImageError={markImageFailed} decorative={copy === 1} priority={copy === 0 && index === 0} onPhotoOpen={markHomePhotoOpen} />)}
                </div>)}
              </div>;
            })}
          </div>}
          {!staticGallery && <span className="sr-only" aria-live="polite">{userPaused ? "Fotobänder pausiert." : "Fotobänder laufen automatisch in entgegengesetzte Richtungen."}</span>}
          {reducedMotion && <span className="sr-only">Wegen der Einstellung für reduzierte Bewegung wird eine statische Galerie angezeigt.</span>}
        </div> : <div className="rounded-xl border border-border bg-bg-secondary px-4 py-8 text-center text-sm text-text-muted">Noch keine öffentlichen Portfoliofotos zum Entdecken vorhanden.</div>}
        {photos.length > 1 && animated && <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-text-muted sm:justify-end"><span aria-hidden="true">↔</span> Mit dem Finger wischen oder mit der Maus ziehen</p>}
      </div>
    </section>
  );
}
