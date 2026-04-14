"use client";

import Image from "next/image";
import Link from "next/link";
import ImageStrip from "@/components/ImageStrip";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  MapPin, MessageSquare, Play, Award, ChevronDown, ChevronUp,
  Pencil, ExternalLink, X, Check, Globe, Building2, UserPlus, UserCheck, Clock,
} from "lucide-react";
import type { UserProfile, ProfileModule, ProfileImage, FilmographyEntry, ProfileAward, PhysicalData, ProjectCredit } from "@/lib/profile-types";
import { PROFILE_CATEGORY_MAP } from "@/lib/profile-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the URL only if it is non-empty and parseable — prevents dead links */
function safeLink(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try { new URL(url); return url; } catch { return null; }
}

function getEnabledModules(modules: ProfileModule[] | null | undefined) {
  if (!Array.isArray(modules)) return [];
  return [...modules].filter((m) => m?.enabled).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function getVideoEmbed(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`;
  return null;
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-[0.15em] text-text-muted font-semibold">{label}</span>
      <span className="text-sm font-medium text-text-primary leading-snug">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-5">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="h-px bg-border my-12" />;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button className="absolute top-4 right-4 text-white/60 hover:text-white">
        <X size={24} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Company badge ────────────────────────────────────────────────────────────

type CompanyMembership = {
  id: string;
  role: string;
  title: string | null;
  companies: { id: string; slug: string; name: string; logo_url: string | null } | null;
} | null;

function CompanyBadge({ membership }: { membership: CompanyMembership }) {
  if (!membership?.companies) return null;
  const co = membership.companies;
  return (
    <Link
      href={`/companies/${co.slug}`}
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-bg-secondary border border-border rounded-xl text-xs text-text-secondary hover:border-gold/50 hover:text-gold transition-all group"
    >
      {co.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={co.logo_url} alt="" className="w-4 h-4 rounded object-cover" />
      ) : (
        <Building2 size={12} className="text-text-muted group-hover:text-gold" />
      )}
      <span className="font-medium">{co.name}</span>
      {membership.title && <span className="text-text-muted">· {membership.title}</span>}
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTOR PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

function ActorProfile({ profile, isOwner, projectCredits, companyMembership }: { profile: UserProfile; isOwner: boolean; projectCredits: ProjectCredit[]; companyMembership: CompanyMembership }) {
  const { user } = useUser();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showAllFilms, setShowAllFilms] = useState(false);
  const [expandedFilm, setExpandedFilm] = useState<number | null>(null);
  const [friendStatus, setFriendStatus] = useState<null | "pending_sent" | "pending_received" | "friends">(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendLoading, setFriendLoading] = useState(false);

  // Fetch friendship status
  useEffect(() => {
    if (isOwner || !user) return;
    fetch(`/api/friendships?userId=${profile.user_id}`)
      .then(r => r.json())
      .then(({ friendship }) => {
        if (!friendship) return;
        setFriendshipId(friendship.id);
        if (friendship.status === "accepted") {
          setFriendStatus("friends");
        } else if (friendship.status === "pending") {
          setFriendStatus(friendship.sender_id === user.id ? "pending_sent" : "pending_received");
        }
      })
      .catch(() => {});
  }, [isOwner, user, profile.user_id]);

  async function handleFriendAction() {
    if (friendLoading) return;
    setFriendLoading(true);
    try {
      if (!friendStatus) {
        // Send request
        const res = await fetch("/api/friendships", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiver_id: profile.user_id }),
        });
        const { id } = await res.json();
        setFriendshipId(id);
        setFriendStatus("pending_sent");
      } else if (friendStatus === "pending_received" && friendshipId) {
        // Accept
        await fetch(`/api/friendships/${friendshipId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "accepted" }),
        });
        setFriendStatus("friends");
      }
    } finally {
      setFriendLoading(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (profile.physical ?? {}) as any;

  // Main headshot = avatar; strip = profile_images
  const mainShot = profile.avatar_url ?? null;
  const stripImages: ProfileImage[] = profile.profile_images ?? [];

  const allVideoUrls = [
    profile.showreel_url ?? profile.reel_url,
    ...(profile.video_links ?? []),
  ].filter(Boolean) as string[];
  const videoEmbeds = allVideoUrls.map(getVideoEmbed).filter(Boolean) as string[];

  const manualFilms: FilmographyEntry[] = profile.filmography ?? [];
  const creditTitles = new Set(
    projectCredits.filter((c) => c.projects).map((c) => c.projects!.title.toLowerCase().trim())
  );

  type FilmRow =
    | { kind: "manual"; data: FilmographyEntry }
    | { kind: "credit"; data: ProjectCredit };

  const films: FilmRow[] = [
    ...projectCredits.filter((c) => c.projects).map((c): FilmRow => ({ kind: "credit", data: c })),
    ...manualFilms.filter((f) => !creditTitles.has(f.title.toLowerCase().trim())).map((f): FilmRow => ({ kind: "manual", data: f })),
  ].sort((a, b) => {
    const ya = a.kind === "credit" ? (a.data.projects?.year ?? 0) : (a.data.year ?? 0);
    const yb = b.kind === "credit" ? (b.data.projects?.year ?? 0) : (b.data.year ?? 0);
    return yb - ya;
  });

  const visibleFilms = showAllFilms ? films : films.slice(0, 6);
  const awards: ProfileAward[] = profile.awards ?? [];
  const skills: string[] = profile.skills ?? [];
  const languages = profile.languages ?? [];

  const playingAge = p.playing_age_min || p.playing_age_max
    ? [p.playing_age_min, p.playing_age_max].filter(Boolean).join("–") + " J."
    : null;

  const socialLinks = [
    { label: "Instagram", url: safeLink(profile.instagram_url) },
    { label: "TikTok",    url: safeLink((profile as unknown as {tiktok_url?: string}).tiktok_url) },
    { label: "YouTube",   url: safeLink(profile.youtube_url) },
    { label: "Vimeo",     url: safeLink((profile as unknown as {vimeo_url?: string}).vimeo_url) },
    { label: "LinkedIn",  url: safeLink(profile.linkedin_url) },
    { label: "IMDb",      url: safeLink((profile as unknown as {imdb_url?: string}).imdb_url) },
    { label: "Website",   url: safeLink(profile.website_url), icon: true },
  ].filter(l => l.url);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="pt-16 bg-bg-primary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10 items-start">

            {/* ── Main headshot (= avatar) ── */}
            <div className="lg:col-span-2">
              {mainShot ? (
                <div
                  className="relative w-full aspect-[3/4] rounded-xl overflow-hidden cursor-pointer group bg-bg-elevated"
                  onClick={() => setLightbox(mainShot)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mainShot}
                    alt={profile.display_name ?? ""}
                    className="w-full h-full object-cover object-top group-hover:scale-[1.03] transition-transform duration-700"
                  />
                  {profile.verified && (
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                      <Check size={9} /> Verified
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-[3/4] rounded-xl bg-bg-elevated border border-border flex items-center justify-center">
                  <span className="text-5xl font-display font-bold text-text-muted/20">
                    {(profile.display_name ?? "?")[0]}
                  </span>
                </div>
              )}
            </div>

            {/* ── Info panel ── */}
            <div className="lg:col-span-3 flex flex-col gap-5 lg:pt-1">

              {/* Top bar: availability + name + CTAs */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${profile.available ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className="text-xs font-medium text-text-muted">
                      {profile.available ? "Verfügbar" : "Nicht verfügbar"}
                    </span>
                  </div>
                  <h1 className="font-display text-4xl sm:text-5xl font-bold text-text-primary leading-none tracking-tight">
                    {profile.display_name ?? "Unbekannt"}
                  </h1>
                  {(profile.positions?.[0] ?? profile.role) && (
                    <p className="text-text-muted text-sm mt-2 tracking-wide">
                      {(profile.positions ?? [profile.role]).filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {profile.tagline && (
                    <p className="text-text-secondary text-sm mt-1 italic">
                      {profile.tagline}
                    </p>
                  )}
                  {profile.location && (
                    <p className="text-text-muted/60 text-xs mt-1 flex items-center gap-1">
                      <MapPin size={10} /> {profile.location}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2 mt-1">
                  {!isOwner ? (
                    <>
                      <Link href={`/messages?to=${profile.user_id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-text-primary text-bg-primary font-semibold rounded-lg hover:opacity-90 transition-opacity text-xs">
                        <MessageSquare size={12} /> Nachricht
                      </Link>
                      {friendStatus === "friends" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium">
                          <UserCheck size={12} /> Freunde
                        </span>
                      ) : friendStatus === "pending_sent" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-text-muted rounded-lg text-xs">
                          <Clock size={12} /> Anfrage gesendet
                        </span>
                      ) : friendStatus === "pending_received" ? (
                        <button onClick={handleFriendAction} disabled={friendLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors text-xs disabled:opacity-50">
                          <Check size={12} /> Annehmen
                        </button>
                      ) : (
                        <button onClick={handleFriendAction} disabled={friendLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-text-secondary rounded-lg hover:border-gold/50 hover:text-gold transition-all text-xs disabled:opacity-50">
                          <UserPlus size={12} /> Freund
                        </button>
                      )}
                    </>
                  ) : (
                    <Link href="/profile" className="flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors">
                      <Pencil size={11} /> Bearbeiten
                    </Link>
                  )}
                </div>
              </div>

              {/* Stats grid — only non-null values */}
              {(playingAge || p.height_cm || p.hair_color || p.eye_color || languages.length > 0 || p.body_type || profile.day_rate) && (
                <div className="grid grid-cols-3 gap-x-4 gap-y-4 py-5 border-y border-border">
                  {playingAge        && <StatPill label="Spielalter" value={playingAge} />}
                  {p.height_cm       && <StatPill label="Größe"      value={`${p.height_cm} cm`} />}
                  {p.hair_color      && <StatPill label="Haarfarbe"  value={p.hair_color} />}
                  {p.eye_color       && <StatPill label="Augenfarbe" value={p.eye_color} />}
                  {p.body_type       && <StatPill label="Körperbau"  value={p.body_type} />}
                  {languages.length > 0 && <StatPill label="Sprachen" value={languages.slice(0, 3).join(", ")} />}
                  {profile.day_rate  && <StatPill label="Tagesgage"  value={`${profile.day_rate} €`} />}
                  {profile.travel_ready && <StatPill label="Reisen" value="Reisebereit" />}
                </div>
              )}

              {/* Bio */}
              {profile.bio && (
                <p className="text-text-secondary text-sm leading-relaxed">
                  {profile.bio.length > 280 ? profile.bio.slice(0, 280) + "…" : profile.bio}
                </p>
              )}


              {/* Company badge */}
              <CompanyBadge membership={companyMembership} />

              {/* Social links */}
              {socialLinks.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {socialLinks.map(({ label, url, icon }) => (
                    <a key={label} href={url!} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-xs text-text-secondary hover:border-gold/50 hover:text-gold transition-all">
                      {icon && <Globe size={11} />}{label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── VIDEOS ────────────────────────────────────────────────────── */}
        {videoEmbeds.length > 0 && (
          <>
            <Divider />
            <SectionLabel>Videos</SectionLabel>
            {videoEmbeds.length === 1 ? (
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-2xl">
                <iframe src={videoEmbeds[0]} className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {videoEmbeds.map((embed, i) => (
                  <div key={i} className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-xl">
                    <iframe src={embed} className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PORTFOLIO FOTOS ───────────────────────────────────────────── */}
        {stripImages.length > 0 && (
          <>
            <Divider />
            <SectionLabel>Portfolio</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {stripImages.map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer group bg-bg-elevated"
                  onClick={() => setLightbox(img.url)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.caption ?? `Foto ${i + 1}`}
                    className="w-full h-full object-cover object-top group-hover:scale-[1.04] transition-transform duration-500"
                  />
                  {img.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-[10px] truncate">{img.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── FILMOGRAFIE ───────────────────────────────────────────────── */}
        {films.length > 0 && (
          <>
            <Divider />
            <SectionLabel>Filmografie</SectionLabel>
            <div className="divide-y divide-border">
              {visibleFilms.map((row, i) => {
                if (row.kind === "credit") {
                  const credit = row.data;
                  const proj = credit.projects!;
                  const isOpen = expandedFilm === i;
                  const hasDetails = !!(proj.director || proj.type);
                  return (
                    <div key={`credit-${credit.id}`}>
                      <div className="flex items-center gap-4 py-3">
                        <span className="text-xs font-bold tabular-nums text-text-muted w-10 shrink-0">{proj.year ?? "—"}</span>
                        <div className="flex-1 min-w-0">
                          <Link href={`/projects/${credit.project_id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-text-primary hover:text-gold transition-colors">
                            {proj.title}
                          </Link>
                          {credit.role && <p className="text-xs text-text-muted">{credit.role}</p>}
                        </div>
                        {proj.type && <span className="text-[10px] px-2 py-0.5 bg-bg-secondary border border-border text-text-muted rounded font-medium shrink-0">{proj.type}</span>}
                        {hasDetails && (
                          <button type="button" onClick={() => setExpandedFilm(isOpen ? null : i)}
                            className="shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors">
                            <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </div>
                      {isOpen && hasDetails && (
                        <div className="pb-3 pl-14 flex flex-wrap gap-x-6 gap-y-1">
                          {proj.type && <span className="text-xs text-text-muted">Typ: <span className="text-text-secondary">{proj.type}</span></span>}
                          {proj.director && <span className="text-xs text-text-muted">Regie: <span className="text-text-secondary">{proj.director}</span></span>}
                        </div>
                      )}
                    </div>
                  );
                }
                const film = row.data;
                const isOpen = expandedFilm === i;
                const hasDetails = !!(film.director || film.festival || film.type || film.production);
                return (
                  <div key={`film-${i}`}>
                    <div className="flex items-center gap-4 py-3">
                      <span className="text-xs font-bold tabular-nums text-text-muted w-10 shrink-0">{film.year}</span>
                      <div className="flex-1 min-w-0">
                        {film.imdb_url ? (
                          <a href={film.imdb_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-text-primary hover:text-gold transition-colors">
                            {film.title} <ExternalLink size={10} className="shrink-0 text-text-muted" />
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-text-primary">{film.title}</span>
                        )}
                        {film.role && <p className="text-xs text-text-muted">{film.role}</p>}
                      </div>
                      {film.festival && <span className="text-[10px] px-2 py-0.5 bg-gold/10 border border-gold/20 text-gold rounded font-medium shrink-0">★ {film.festival}</span>}
                      {hasDetails && (
                        <button type="button" onClick={() => setExpandedFilm(isOpen ? null : i)}
                          className="shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors">
                          <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                    {isOpen && hasDetails && (
                      <div className="pb-3 pl-14 flex flex-wrap gap-x-6 gap-y-1">
                        {film.type && <span className="text-xs text-text-muted">Typ: <span className="text-text-secondary">{film.type}</span></span>}
                        {film.director && <span className="text-xs text-text-muted">Regie: <span className="text-text-secondary">{film.director}</span></span>}
                        {film.production && <span className="text-xs text-text-muted">Produktion: <span className="text-text-secondary">{film.production}</span></span>}
                        {film.festival && <span className="text-xs text-text-muted">Festival: <span className="text-gold">{film.festival}</span></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {films.length > 6 && (
              <button onClick={() => setShowAllFilms(!showAllFilms)}
                className="mt-4 flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors">
                {showAllFilms ? <><ChevronUp size={13} /> Weniger</> : <><ChevronDown size={13} /> Alle {films.length} Projekte</>}
              </button>
            )}
          </>
        )}

        {/* ── SKILLS ────────────────────────────────────────────────────── */}
        {skills.length > 0 && (
          <>
            <Divider />
            <SectionLabel>Skills & Besonderheiten</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <span key={s} className="px-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:border-gold/40 transition-colors">
                  {s}
                </span>
              ))}
            </div>
          </>
        )}

        {/* ── AWARDS ────────────────────────────────────────────────────── */}
        {awards.length > 0 && (
          <>
            <Divider />
            <SectionLabel>Awards & Festivals</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {awards.map((award, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-bg-secondary border border-border rounded-xl hover:border-gold/30 transition-colors">
                  <Award size={16} className="text-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{award.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">{[award.event, award.year].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}


        <div className="h-16" />
      </div>

      {/* ── FOTO-STRIP full-bleed unten ───────────────────────────────── */}
      {stripImages.length > 0 && (
        <ImageStrip
          images={stripImages.map((img) => ({ src: img.url, alt: img.caption ?? "", onClick: () => setLightbox(img.url) }))}
          aspectRatio="poster"
          height={320}
          speed="slow"
          overlay
        />
      )}
      <div className="h-16" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

function ModelProfile({ profile, isOwner, companyMembership }: { profile: UserProfile; isOwner: boolean; companyMembership: CompanyMembership }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (profile.physical ?? {}) as any;
  const images: ProfileImage[] = profile.profile_images ?? [];
  const heroImg = images.find((i) => i.featured) ?? images[0];
  const galleryImgs = heroImg ? images.filter((i) => i !== heroImg) : images.slice(1);

  const reelUrl = profile.showreel_url ?? profile.reel_url;
  const reelEmbed = reelUrl ? getVideoEmbed(reelUrl) : null;
  const skills: string[] = profile.skills ?? [];
  const languages = profile.languages ?? [];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* ── HERO (full editorial) ──────────────────────────────────────── */}
      <section className="relative h-[90vh] min-h-[560px] bg-black">
        {heroImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImg.url}
            alt={profile.display_name ?? ""}
            className="absolute inset-0 w-full h-full object-cover object-top opacity-90"
          />
        ) : profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={profile.display_name ?? ""}
            fill
            className="object-cover object-top opacity-90"
          />
        ) : (
          <div className="absolute inset-0 bg-bg-elevated" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 pt-20 px-6 sm:px-10 flex items-start justify-between">
          {profile.verified && (
            <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md text-white text-[10px] font-semibold px-3 py-1.5 rounded-full border border-white/20">
              <Check size={10} /> Verified
            </span>
          )}
          {isOwner ? (
            <Link href="/profile" className="ml-auto flex items-center gap-1.5 bg-white/10 backdrop-blur-md text-white text-[10px] font-semibold px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-colors">
              <Pencil size={10} /> Bearbeiten
            </Link>
          ) : (
            <div className="ml-auto flex gap-2">
              <Link href={`/messages?to=${profile.user_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 text-black font-semibold rounded-lg hover:bg-white transition-colors text-xs">
                <MessageSquare size={12} /> Nachricht
              </Link>
              <Link href={`/booking?profile=${profile.user_id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-lg hover:bg-white/20 transition-colors text-xs">
                Anfrage <ExternalLink size={11} />
              </Link>
            </div>
          )}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-10 pb-10">
          <p className="text-white/60 text-xs uppercase tracking-[0.2em] mb-2">
            {(profile.positions?.[0] ?? profile.role) ?? "Model"}
          </p>
          <h1 className="font-display text-5xl sm:text-7xl font-bold text-white leading-none tracking-tight mb-4">
            {profile.display_name ?? "Unbekannt"}
          </h1>
          {profile.location && (
            <p className="text-white/60 text-sm flex items-center gap-1.5">
              <MapPin size={12} /> {profile.location}
            </p>
          )}
        </div>
      </section>

      {/* ── MEASUREMENTS STRIP ────────────────────────────────────────── */}
      {(p.height_cm || p.hair_color || p.eye_color || languages.length > 0) && (
        <section className="border-b border-border bg-bg-secondary">
          <div className="max-w-6xl mx-auto px-4 sm:px-10 py-6">
            <div className="flex flex-wrap gap-x-10 gap-y-3 items-center">
              {p.height_cm && (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-text-primary">{p.height_cm}</span>
                  <span className="text-xs text-text-muted">cm Größe</span>
                </div>
              )}
              {p.hair_color && (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-text-primary">{p.hair_color}</span>
                  <span className="text-xs text-text-muted">Haare</span>
                </div>
              )}
              {p.eye_color && (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-text-primary">{p.eye_color}</span>
                  <span className="text-xs text-text-muted">Augen</span>
                </div>
              )}
              {languages.length > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-text-primary">{languages.join(" / ")}</span>
                  <span className="text-xs text-text-muted">Sprachen</span>
                </div>
              )}
              {profile.available && (
                <div className="ml-auto flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Verfügbar
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── PORTFOLIO GRID ────────────────────────────────────────────── */}
        {images.length > 0 && (
          <>
            <div className="py-14">
              <SectionLabel>Portfolio</SectionLabel>
              {/* Masonry-style grid */}
              <div className="columns-2 sm:columns-3 gap-2 sm:gap-3 space-y-2 sm:space-y-3">
                {images.slice(0, 12).map((img, i) => (
                  <div
                    key={i}
                    className="break-inside-avoid cursor-pointer group overflow-hidden rounded-xl"
                    onClick={() => setLightbox(img.url)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.caption ?? ""}
                      className="w-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      style={{ aspectRatio: i % 3 === 0 ? "3/4" : i % 5 === 0 ? "1/1" : "2/3" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── SHOWREEL / VIDEO ──────────────────────────────────────────── */}
        {reelEmbed && (
          <>
            <Divider />
            <SectionLabel>Video</SectionLabel>
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-2xl">
              <iframe
                src={reelEmbed}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </>
        )}

        {/* ── SPEZIALISIERUNG ───────────────────────────────────────────── */}
        {(skills.length > 0 || profile.bio) && (
          <>
            <Divider />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              {profile.bio && (
                <div>
                  <SectionLabel>Über mich</SectionLabel>
                  <p className="text-text-secondary text-sm leading-relaxed">{profile.bio}</p>
                </div>
              )}
              {skills.length > 0 && (
                <div>
                  <SectionLabel>Spezialisierung</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s) => (
                      <span key={s} className="px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}


        {companyMembership?.companies && (
          <>
            <Divider />
            <CompanyBadge membership={companyMembership} />
          </>
        )}

        {(() => {
          const links = [
            { label: "Instagram", url: safeLink(profile.instagram_url) },
            { label: "TikTok",    url: safeLink((profile as unknown as {tiktok_url?: string}).tiktok_url) },
            { label: "YouTube",   url: safeLink(profile.youtube_url) },
            { label: "Vimeo",     url: safeLink((profile as unknown as {vimeo_url?: string}).vimeo_url) },
            { label: "LinkedIn",  url: safeLink(profile.linkedin_url) },
            { label: "Website",   url: safeLink(profile.website_url) },
          ].filter(l => l.url);
          if (links.length === 0) return null;
          return (
            <>
              <Divider />
              <SectionLabel>Links</SectionLabel>
              <div className="flex flex-wrap gap-2 pb-4">
                {links.map(({ label, url }) => (
                  <a key={label} href={url!} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
                    {label} <ExternalLink size={9} className="opacity-50" />
                  </a>
                ))}
              </div>
            </>
          );
        })()}

        <div className="h-16" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC PROFILE (Crew, Creative, Vendor etc.)
// ═══════════════════════════════════════════════════════════════════════════════

function GenericProfile({ profile, isOwner, projectCredits, companyMembership }: { profile: UserProfile; isOwner: boolean; projectCredits: ProjectCredit[]; companyMembership: CompanyMembership }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [expandedFilm, setExpandedFilm] = useState<number | null>(null);

  const images: ProfileImage[] = profile.profile_images ?? [];
  const reelUrl = profile.showreel_url ?? profile.reel_url;
  const reelEmbed = reelUrl ? getVideoEmbed(reelUrl) : null;
  const films: FilmographyEntry[] = profile.filmography ?? [];
  const awards: ProfileAward[] = profile.awards ?? [];
  const skills: string[] = profile.skills ?? [];
  const languages = profile.languages ?? [];
  const certificates: string[] = profile.crew?.certificates ?? [];
  const software: string[] = profile.crew?.software ?? [];
  const bgImage = profile.cover_image_url ?? (images.find((i) => i.featured)?.url);

  // Merge manual filmography + linked project credits into one unified list
  type FilmRow =
    | { kind: "manual"; data: FilmographyEntry }
    | { kind: "credit"; data: ProjectCredit };

  // Build unified list: linked credits first, then manual entries that aren't already covered
  const creditTitles = new Set(
    projectCredits
      .filter((c) => c.projects)
      .map((c) => c.projects!.title.toLowerCase().trim())
  );

  const filmRows: FilmRow[] = [
    ...projectCredits
      .filter((c) => c.projects)
      .map((c): FilmRow => ({ kind: "credit", data: c })),
    ...films
      .filter((f) => !creditTitles.has(f.title.toLowerCase().trim()))
      .map((f): FilmRow => ({ kind: "manual", data: f })),
  ].sort((a, b) => {
    const yearA = a.kind === "credit" ? (a.data.projects?.year ?? 0) : (a.data.year ?? 0);
    const yearB = b.kind === "credit" ? (b.data.projects?.year ?? 0) : (b.data.year ?? 0);
    return yearB - yearA;
  });

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* Hero */}
      <section className="relative overflow-hidden">
        {bgImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/40 via-bg-primary/70 to-bg-primary" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-bg-elevated to-bg-primary" />
        )}

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-10">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary leading-tight">
                {profile.display_name ?? "Unbekannt"}
              </h1>
              {(profile.positions?.[0] ?? profile.role) && (
                <p className="text-text-muted text-sm mt-1">
                  {(profile.positions ?? [profile.role]).filter(Boolean).join(" · ")}
                </p>
              )}
              {profile.location && (
                <p className="text-text-muted text-xs mt-1.5 flex items-center gap-1">
                  <MapPin size={10} />{profile.location}
                </p>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-2 mt-1">
              {!isOwner ? (
                <>
                  <Link href={`/messages?to=${profile.user_id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-text-primary text-bg-primary font-semibold rounded-lg hover:opacity-90 transition-opacity text-xs">
                    <MessageSquare size={12} /> Nachricht
                  </Link>
                  <Link href={`/booking?profile=${profile.user_id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-text-secondary rounded-lg hover:border-gold/50 hover:text-gold transition-all text-xs">
                    Anfrage <ExternalLink size={11} />
                  </Link>
                </>
              ) : (
                <Link href="/profile" className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-text-muted rounded-lg hover:border-gold/50 text-xs transition-colors">
                  <Pencil size={11} /> Bearbeiten
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* Two-column: avatar + compact info */}
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-8 mb-12">
          {/* Avatar */}
          <div className="shrink-0">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.display_name ?? ""} width={200} height={200}
                className="w-full aspect-square rounded-2xl object-cover ring-1 ring-border shadow-xl" />
            ) : (
              <div className="w-full aspect-square rounded-2xl bg-bg-elevated border border-border flex items-center justify-center text-4xl font-bold text-text-muted">
                {(profile.display_name ?? "?")[0]}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-3">
              <span className={`w-2 h-2 rounded-full ${profile.available ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="text-xs text-text-muted">{profile.available ? "Verfügbar" : "Nicht verfügbar"}</span>
            </div>
          </div>

          {/* Compact info */}
          <div className="space-y-5 pt-1">
            <CompanyBadge membership={companyMembership} />

            {profile.bio && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2">Über mich</p>
                <p className="text-text-secondary text-sm leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {(languages.length > 0 || profile.day_rate || profile.travel_ready || profile.crew?.experience_years) && (
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {languages.length > 0 && <StatPill label="Sprachen" value={languages.join(", ")} />}
                {profile.day_rate && <StatPill label="Tagesgage" value={`${profile.day_rate} €`} />}
                {profile.travel_ready && <StatPill label="Reisen" value="Reisebereit" />}
                {profile.crew?.experience_years && <StatPill label="Erfahrung" value={`${profile.crew.experience_years} Jahre`} />}
              </div>
            )}

            {skills.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {certificates.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2">Lizenzen & Zertifikate</p>
                <div className="flex flex-wrap gap-1.5">
                  {certificates.map((c) => (
                    <span key={c} className="px-2.5 py-1 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {software.length > 0 && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2">Software</p>
                <div className="flex flex-wrap gap-1.5">
                  {software.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Social links */}
            {(() => {
              const links = [
                { label: "Instagram", url: safeLink(profile.instagram_url) },
                { label: "TikTok",    url: safeLink((profile as unknown as {tiktok_url?: string}).tiktok_url) },
                { label: "YouTube",   url: safeLink(profile.youtube_url) },
                { label: "Vimeo",     url: safeLink((profile as unknown as {vimeo_url?: string}).vimeo_url) },
                { label: "LinkedIn",  url: safeLink(profile.linkedin_url) },
                { label: "Website",   url: safeLink(profile.website_url) },
              ].filter(l => l.url);
              if (links.length === 0) return null;
              return (
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2">Links</p>
                  <div className="flex flex-wrap gap-1.5">
                    {links.map(({ label, url }) => (
                      <a key={label} href={url!} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
                        {label} <ExternalLink size={9} className="shrink-0 opacity-50" />
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Filmografie */}
        {filmRows.length > 0 && (
          <div className="mb-12">
            <SectionLabel>Filmografie</SectionLabel>
            <div className="divide-y divide-border">
              {filmRows.map((row, i) => {
                if (row.kind === "credit") {
                  const credit = row.data;
                  const proj = credit.projects!;
                  const isOpen = expandedFilm === i;
                  const hasDetails = !!(proj.director || proj.type);
                  return (
                    <div key={`credit-${credit.id}`}>
                      <div className="flex items-center gap-4 py-3">
                        <span className="text-xs font-bold tabular-nums text-text-muted w-10 shrink-0">{proj.year ?? "—"}</span>
                        <div className="flex-1 min-w-0">
                          <Link href={`/projects/${credit.project_id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-text-primary hover:text-gold transition-colors">
                            {proj.title}
                          </Link>
                          {credit.role && <p className="text-xs text-text-muted">{credit.role}</p>}
                        </div>
                        {proj.type && (
                          <span className="text-[10px] px-2 py-0.5 bg-bg-secondary border border-border text-text-muted rounded font-medium shrink-0">{proj.type}</span>
                        )}
                        {hasDetails && (
                          <button type="button" onClick={() => setExpandedFilm(isOpen ? null : i)}
                            className="shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors">
                            <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </div>
                      {isOpen && hasDetails && (
                        <div className="pb-3 pl-14 flex flex-wrap gap-x-6 gap-y-1">
                          {proj.type && <span className="text-xs text-text-muted">Typ: <span className="text-text-secondary">{proj.type}</span></span>}
                          {proj.director && <span className="text-xs text-text-muted">Regie: <span className="text-text-secondary">{proj.director}</span></span>}
                        </div>
                      )}
                    </div>
                  );
                }

                // Manual filmography entry
                const film = row.data;
                const isOpen = expandedFilm === i;
                const hasDetails = !!(film.director || film.festival || film.type || film.production);
                return (
                  <div key={`film-${i}`}>
                    <div className="flex items-center gap-4 py-3 group">
                      <span className="text-xs font-bold tabular-nums text-text-muted w-10 shrink-0">{film.year}</span>
                      <div className="flex-1 min-w-0">
                        {film.imdb_url ? (
                          <a href={film.imdb_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-text-primary hover:text-gold transition-colors">
                            {film.title} <ExternalLink size={10} className="shrink-0 text-text-muted" />
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-text-primary">{film.title}</span>
                        )}
                        {film.role && <p className="text-xs text-text-muted">{film.role}</p>}
                      </div>
                      {film.festival && (
                        <span className="text-[10px] px-2 py-0.5 bg-gold/10 border border-gold/20 text-gold rounded font-medium shrink-0">★ {film.festival}</span>
                      )}
                      {hasDetails && (
                        <button type="button" onClick={() => setExpandedFilm(isOpen ? null : i)}
                          className="shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors">
                          <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                    {isOpen && hasDetails && (
                      <div className="pb-3 pl-14 flex flex-wrap gap-x-6 gap-y-1">
                        {film.type && <span className="text-xs text-text-muted">Typ: <span className="text-text-secondary">{film.type}</span></span>}
                        {film.director && <span className="text-xs text-text-muted">Regie: <span className="text-text-secondary">{film.director}</span></span>}
                        {film.production && <span className="text-xs text-text-muted">Produktion: <span className="text-text-secondary">{film.production}</span></span>}
                        {film.festival && <span className="text-xs text-text-muted">Festival: <span className="text-gold">{film.festival}</span></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Showreel */}
        {reelEmbed && (
          <div className="mb-12">
            <SectionLabel>Showreel</SectionLabel>
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
              <iframe src={reelEmbed} className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>
        )}

        {/* Awards */}
        {awards.length > 0 && (
          <div className="mb-12">
            <SectionLabel>Awards</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {awards.map((award, i) => (
                <div key={i} className="flex gap-3 p-4 bg-bg-secondary border border-border rounded-xl">
                  <Award size={15} className="text-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{award.title}</p>
                    <p className="text-xs text-text-muted">{[award.event, award.year].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Photo strip — full-bleed scrolling marquee */}
      {images.length > 0 && (
        <ImageStrip
          images={images.map((img) => ({ src: img.url, alt: img.caption ?? "", onClick: () => setLightbox(img.url) }))}
          aspectRatio="poster"
          height={320}
          speed="slow"
          overlay
        />
      )}

      <div className="h-16" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — type-based routing
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProfileView({
  profile,
  isOwner,
  projectCredits = [],
  companyMembership = null,
}: {
  profile: UserProfile;
  isOwner: boolean;
  projectCredits?: ProjectCredit[];
  companyMembership?: CompanyMembership;
}) {
  const category = PROFILE_CATEGORY_MAP[profile.profile_type] ?? "crew";

  // Model types get editorial layout
  if (profile.profile_type === "model") {
    return <ModelProfile profile={profile} isOwner={isOwner} companyMembership={companyMembership} />;
  }

  // Actor/talent types get casting-ready layout
  if (category === "talent") {
    return <ActorProfile profile={profile} isOwner={isOwner} projectCredits={projectCredits} companyMembership={companyMembership} />;
  }

  // Crew, creative, vendor get generic layout
  return <GenericProfile profile={profile} isOwner={isOwner} projectCredits={projectCredits} companyMembership={companyMembership} />;
}
