"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import ImageStrip from "@/components/ImageStrip";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  MapPin, MessageSquare, Award, ChevronDown, ChevronUp,
  Pencil, ExternalLink, X, Check, Globe, Building2, UserPlus, UserCheck, Clock,
  Film, Briefcase, Package, Car, Ban, Flag, Users2, MoreHorizontal, Phone, Mail, Heart, Send,
} from "lucide-react";
import type { UserProfile, ProfileModule, ProfileImage, FilmographyEntry, ProfileAward, ProjectCredit } from "@/lib/profile-types";
import ReviewsSection from "@/components/ReviewsSection";
import { PROFILE_CATEGORY_MAP } from "@/lib/profile-types";
import { getPlatform, type ExternalProfileRow } from "@/lib/external-platforms";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the URL only if it is non-empty and parseable — prevents dead links */
function safeLink(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const u = new URL(normalized);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return normalized;
  } catch { return null; }
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
      <span className="text-[9px] uppercase tracking-[0.15em] text-gold font-bold">{label}</span>
      <span className="text-sm font-semibold text-text-primary leading-snug">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
      <p className="text-[10px] uppercase tracking-widest text-text-muted/70 font-semibold">
        {children}
      </p>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border my-12" />;
}

// ─── Block / Report Bar ───────────────────────────────────────────────────────

const REPORT_REASONS: Record<string, string> = {
  spam: "Spam",
  harassment: "Belästigung",
  fake_profile: "Fake-Profil",
  inappropriate_content: "Unangemessener Inhalt",
  scam: "Betrug",
  other: "Anderes",
};

const PROJECT_TYPE_NORMALIZE: Record<string, string> = {
  "Werbefilm / Commercial": "Werbefilm",
  "Corporate Film": "Corporate",
  "Event / Live": "Event",
  "Foto / Shooting": "Shooting",
};
function normType(t: string | null | undefined): string | null {
  if (!t) return null;
  return PROJECT_TYPE_NORMALIZE[t] ?? t;
}

function BlockReportBar({ targetId, initialYouBlocked }: { targetId: string; initialYouBlocked: boolean }) {
  const [youBlocked, setYouBlocked] = useState(initialYouBlocked);
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState("");

  async function toggleBlock() {
    setBlockLoading(true);
    setBlockError("");
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked_id: targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        setYouBlocked(data.blocked);
      } else {
        setBlockError("Aktion fehlgeschlagen. Bitte erneut versuchen.");
      }
    } catch {
      setBlockError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setBlockLoading(false);
    }
  }

  async function submitReport() {
    if (!reportReason) return;
    setReportError("");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "user", target_id: targetId, reason: reportReason }),
    });
    if (res.ok) {
      setReportSent(true);
      setReportOpen(false);
    } else {
      setReportError("Meldung fehlgeschlagen. Bitte erneut versuchen.");
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setReportOpen((o) => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white/70 hover:text-white hover:bg-white/20 transition-all"
        aria-label="Mehr Optionen"
      >
        <MoreHorizontal size={15} />
      </button>

      {reportOpen && (
        <div className="absolute right-0 bottom-10 z-50 bg-[#1e2028] border border-white/10 rounded-xl shadow-2xl py-1 w-52">
          <button
            onClick={() => { toggleBlock(); setReportOpen(false); }}
            disabled={blockLoading}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
              youBlocked ? "text-red-400 hover:bg-red-500/10" : "text-white/70 hover:bg-white/5 hover:text-red-400"
            }`}
          >
            <Ban size={12} /> {youBlocked ? "Entblockieren" : "Blockieren"}
          </button>
          {reportSent ? (
            <span className="flex items-center gap-2 px-3 py-2 text-xs text-emerald-400">
              <Check size={12} /> Gemeldet
            </span>
          ) : (
            <>
              <div className="h-px bg-white/10 mx-2 my-1" />
              <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-widest text-white/40 font-semibold">Melden als</p>
              {Object.entries(REPORT_REASONS).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setReportReason(value)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                    reportReason === value ? "text-gold bg-gold/10" : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  {reportReason === value && <Check size={10} />}
                  {label}
                </button>
              ))}
              {reportReason && (
                <div className="px-2 pt-1">
                  <button
                    onClick={submitReport}
                    className="w-full px-3 py-1.5 bg-gold text-bg-primary font-semibold rounded-lg text-xs hover:bg-gold-light transition-colors"
                  >
                    Abschicken
                  </button>
                </div>
              )}
            </>
          )}
          {blockError && <p className="px-3 py-1 text-xs text-red-400">{blockError}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Collaborations Section ───────────────────────────────────────────────────

type PublicCollab = { user_id: string; label: string; display_name: string; avatar_url: string | null; slug: string; role: string | null };

function CollaborationsSection({ collaborations }: { collaborations: PublicCollab[] }) {
  if (!collaborations.length) return null;
  return (
    <>
      <Divider />
      <SectionLabel>Zusammenarbeit</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {collaborations.map((c) => (
          <Link
            key={c.user_id}
            href={`/profile/${c.slug}`}
            className="group flex flex-col items-center gap-2 p-4 bg-bg-secondary border border-border rounded-xl hover:border-gold/40 hover:bg-bg-elevated transition-all text-center"
          >
            {c.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.avatar_url}
                alt={c.display_name}
                className="w-12 h-12 rounded-full object-cover border-2 border-border group-hover:border-gold/40 transition-colors shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-bg-elevated border-2 border-border flex items-center justify-center shrink-0">
                <Users2 size={18} className="text-text-muted" />
              </div>
            )}
            <div className="min-w-0 w-full">
              <p className="text-xs font-semibold text-text-primary truncate group-hover:text-gold transition-colors">
                {c.display_name}
              </p>
              <p className="text-[10px] text-gold font-medium truncate mt-0.5">{c.label}</p>
              {c.role && <p className="text-[10px] text-text-muted truncate">{c.role}</p>}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

// ─── Inserate Section ─────────────────────────────────────────────────────────

const LISTING_TYPE_META: Record<string, { label: string; color: string; href: (id: string) => string }> = {
  job:      { label: "Job",        color: "text-gold",         href: (id) => `/jobs/${id}` },
  prop:     { label: "Marktplatz", color: "text-violet-400",   href: (id) => `/props/${id}` },
  location: { label: "Location",   color: "text-emerald-400",  href: (id) => `/locations/${id}` },
  vehicle:  { label: "Fahrzeug",   color: "text-sky-400",      href: (id) => `/vehicles/${id}` },
  creator:  { label: "Creator",    color: "text-rose-400",     href: (id) => `/creators/${id}` },
  animal:   { label: "Tier",       color: "text-amber-400",    href: (id) => `/tiere/${id}` },
};

const LISTING_TYPE_ICON: Record<string, React.ElementType> = {
  job: Briefcase, prop: Package, location: MapPin, vehicle: Car, creator: Film,
};

function ListingsSection({ listings }: { listings: PublicListing[] }) {
  if (!listings.length) return null;
  const grouped = listings.reduce<Record<string, PublicListing[]>>((acc, l) => {
    (acc[l.type] = acc[l.type] ?? []).push(l);
    return acc;
  }, {});
  return (
    <>
      <Divider />
      <SectionLabel>Inserate</SectionLabel>
      <div className="space-y-3">
        {Object.entries(grouped).map(([type, items]) => {
          const meta = LISTING_TYPE_META[type] ?? { label: type, color: "text-text-muted", href: (id: string) => `/${type}/${id}` };
          const Icon = LISTING_TYPE_ICON[type] ?? Briefcase;
          return (
            <div key={type}>
              <p className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${meta.color}`}>{meta.label}</p>
              <div className="border border-border rounded-lg overflow-hidden bg-bg-secondary">
                {items.map((l) => {
                  const hasPhoto = ["location", "prop", "vehicle", "animal"].includes(l.type) && !!l.image_url;
                  return (
                    <Link key={l.id} href={meta.href(l.id)}
                      className="group flex items-center gap-3 px-3 py-2 border-b border-border last:border-b-0 hover:bg-bg-elevated transition-colors">
                      {hasPhoto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.image_url!}
                          alt={l.title}
                          className="w-24 h-16 rounded object-cover shrink-0 border border-border/50"
                          style={l.focal_point ? { objectPosition: `${l.focal_point.x * 100}% ${l.focal_point.y * 100}%` } : undefined}
                        />
                      )}
                      <span className="text-xs text-text-primary truncate flex-1 group-hover:text-gold transition-colors">{l.title}</span>
                      {l.category && <span className="text-[10px] text-text-primary shrink-0 hidden sm:inline">{l.category}</span>}
                      {l.city && <span className="text-[10px] text-text-primary shrink-0">{l.city}</span>}
                      {l.price != null && l.price > 0 && (
                        <span className="text-[10px] text-gold font-semibold shrink-0">{l.price.toLocaleString("de-DE")} €</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
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

// ─── External Profiles Display ───────────────────────────────────────────────

function ExternalProfilesDisplay({ profiles }: { profiles: ExternalProfileRow[] }) {
  const visible = profiles.filter((p) => p.is_public);
  if (!visible.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
        <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Externe Profile</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((entry) => {
          const href = safeLink(entry.url);
          if (!href) return null;
          const plat = getPlatform(entry.platform_type);
          const displayName =
            entry.platform_type === "other" && entry.platform_name
              ? entry.platform_name
              : plat.name;
          const faviconDomain = plat.urlHints[0] ?? null;
          return (
            <a
              key={entry.id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-elevated border border-border rounded-lg text-xs text-text-secondary hover:border-gold/40 hover:text-gold transition-all group"
            >
              {faviconDomain ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=32`}
                  alt=""
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 rounded-sm shrink-0 opacity-80 group-hover:opacity-100"
                />
              ) : (
                <span className={`text-[10px] font-bold shrink-0 ${plat.textCls}`}>{plat.abbr}</span>
              )}
              <span>{displayName}{entry.custom_label ? ` · ${entry.custom_label}` : ""}</span>
              <ExternalLink size={9} className="shrink-0 opacity-40 group-hover:opacity-70" />
            </a>
          );
        })}
      </div>
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
  const roleLabel = membership.title ?? membership.role ?? null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
        <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Unternehmen</p>
      </div>
      <Link
        href={`/companies/${co.slug}`}
        className="flex items-center gap-3 p-3 bg-bg-elevated border border-border rounded-xl hover:border-gold/40 transition-all group"
      >
        {co.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={co.logo_url} alt={co.name} className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-bg-secondary border border-border flex items-center justify-center shrink-0">
            <Building2 size={18} className="text-text-muted group-hover:text-gold" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors truncate">{co.name}</p>
          {roleLabel && <p className="text-xs text-text-muted truncate">{roleLabel}</p>}
        </div>
        <ExternalLink size={12} className="text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTOR PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

function ActorProfile({ profile, isOwner, projectCredits, companyMembership, externalProfiles, listings = [], blockStatus = null, collaborations = [], imageLikes = {}, myImageLikes = [] }: { profile: UserProfile; isOwner: boolean; projectCredits: ProjectCredit[]; companyMembership: CompanyMembership; externalProfiles: ExternalProfileRow[]; listings?: PublicListing[]; blockStatus?: { youBlocked: boolean; theyBlocked: boolean } | null; collaborations?: PublicCollab[]; imageLikes?: Record<string, number>; myImageLikes?: string[] }) {
  const tc = useTranslations("common");
  const canContact = !blockStatus?.youBlocked && !blockStatus?.theyBlocked;
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
    const controller = new AbortController();
    fetch(`/api/friendships?userId=${profile.user_id}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        const friendship = data?.friendship;
        if (!friendship) return;
        setFriendshipId(friendship.id);
        if (friendship.status === "accepted") {
          setFriendStatus("friends");
        } else if (friendship.status === "pending") {
          setFriendStatus(friendship.sender_id === user.id ? "pending_sent" : "pending_received");
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isOwner, user, profile.user_id]);

  async function handleFriendAction() {
    if (friendLoading) return;
    setFriendLoading(true);
    try {
      if (!friendStatus) {
        const res = await fetch("/api/friendships", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiver_id: profile.user_id }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setFriendshipId(data.id);
        setFriendStatus("pending_sent");
      } else if (friendStatus === "pending_received" && friendshipId) {
        const res = await fetch(`/api/friendships/${friendshipId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "accepted" }),
        });
        if (res.ok) setFriendStatus("friends");
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

  // Filmografie shows only manual entries — linked project credits appear as visual cards in "Projekte"
  const films: FilmographyEntry[] = manualFilms
    .filter((f) => !creditTitles.has(f.title.toLowerCase().trim()))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  const visibleFilms = showAllFilms ? films : films.slice(0, 6);
  const awards: ProfileAward[] = profile.awards ?? [];
  const skills: string[] = profile.skills ?? [];
  const memberships: string[] = (profile as any).memberships ?? [];
  const languages = profile.languages ?? [];

  const playingAge = p.playing_age_min || p.playing_age_max
    ? [p.playing_age_min, p.playing_age_max].filter(Boolean).join("–") + " J."
    : null;

  const pContact = profile as unknown as { tiktok_url?: string; vimeo_url?: string; phone?: string; contact_email?: string };
  const socialLinks = ([
    { label: "Instagram", url: safeLink(profile.instagram_url) },
    { label: "TikTok",    url: safeLink(pContact.tiktok_url) },
    { label: "YouTube",   url: safeLink(profile.youtube_url) },
    { label: "Vimeo",     url: safeLink(pContact.vimeo_url) },
    { label: "LinkedIn",  url: safeLink(profile.linkedin_url) },
    { label: "Website",   url: safeLink(profile.website_url), icon: true },
    pContact.phone?.trim()         ? { label: pContact.phone.trim(),         url: `tel:${pContact.phone.trim()}`,             contactIcon: "phone" as const } : null,
    pContact.contact_email?.trim() ? { label: pContact.contact_email.trim(), url: `mailto:${pContact.contact_email.trim()}`, contactIcon: "mail" as const } : null,
  ] as const).filter((l): l is NonNullable<typeof l> & { url: string } => l !== null && !!l.url) as { label: string; url: string; icon?: boolean; contactIcon?: "phone" | "mail" }[];

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
              <div className="flex flex-col sm:flex-row items-start gap-3">
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${profile.available ? "bg-emerald-400" : "bg-red-400"}`} />
                    <span className="text-xs font-medium text-text-muted">
                      {profile.available ? tc("available") : tc("unavailable")}
                    </span>
                    {/* Availability config chips */}
                    {(() => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const ac = profile.availability_config as any;
                      if (!ac) return null;
                      const chips = [
                        ac.weekends    && { label: "Wochenenden" },
                        ac.night_shoots && { label: "Nachtdrehs" },
                        ac.short_notice && { label: "Kurzfristig" },
                        ac.work_radius_km && { label: `${ac.work_radius_km} km` },
                      ].filter(Boolean) as { label: string }[];
                      if (!chips.length) return null;
                      return chips.map((c) => (
                        <span key={c.label} className="px-1.5 py-0.5 rounded-md bg-bg-elevated border border-border text-[10px] text-text-muted font-medium">
                          {c.label}
                        </span>
                      ));
                    })()}
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
                <div className="flex items-center gap-2 flex-wrap sm:shrink-0 sm:mt-1">
                  {!isOwner ? (
                    <>
                      {canContact && (
                        <>
                          <Link href={`/booking?profile=${profile.user_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors text-xs">
                            Anfrage
                          </Link>
                          <Link href={`/messages?to=${profile.user_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-text-primary text-bg-primary font-semibold rounded-lg hover:opacity-90 transition-opacity text-xs">
                            <MessageSquare size={12} /> Nachricht
                          </Link>
                        </>
                      )}
                      <BlockReportBar targetId={profile.user_id} initialYouBlocked={blockStatus?.youBlocked ?? false} />
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
                  {socialLinks.map(({ label, url, icon, contactIcon }) => (
                    <a key={label} href={url!} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-xs text-text-secondary hover:border-gold/50 hover:text-gold transition-all">
                      {contactIcon === "phone" && <Phone size={11} />}
                      {contactIcon === "mail"  && <Mail size={11} />}
                      {icon && !contactIcon    && <Globe size={11} />}
                      {label}
                    </a>
                  ))}
                </div>
              )}

              {/* Externe Profile */}
              {externalProfiles.length > 0 && (
                <ExternalProfilesDisplay profiles={externalProfiles} />
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

        {/* ── FILMOGRAFIE — manual entries only ────────────────────────── */}
        {films.length > 0 && (
          <>
            <Divider />
            <SectionLabel>Filmografie</SectionLabel>
            <div className="border border-border rounded-lg overflow-hidden bg-bg-secondary">
              {visibleFilms.map((film, i) => {
                const isOpen = expandedFilm === i;
                const hasDetails = !!(film.director || film.festival || film.type || film.production);
                return (
                  <div key={`film-${i}`} className="border-b border-border last:border-b-0">
                    <div className="flex items-center gap-3 px-3 py-1.5 hover:bg-bg-elevated transition-colors">
                      <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8">{film.year || "—"}</span>
                      <div className="flex-1 min-w-0">
                        {film.imdb_url && safeLink(film.imdb_url) ? (
                          <a href={safeLink(film.imdb_url)!} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-text-primary hover:text-gold transition-colors inline-flex items-center gap-1">
                            {film.title} <ExternalLink size={9} className="text-text-muted shrink-0" />
                          </a>
                        ) : (
                          <span className="text-xs text-text-primary">{film.title}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {film.role && <span className="text-[10px] text-text-primary truncate max-w-[120px]">{film.role}</span>}
                        {film.festival && <span className="text-[10px] text-gold">★</span>}
                        {hasDetails && (
                          <button type="button" onClick={() => setExpandedFilm(isOpen ? null : i)}
                            className="text-text-muted hover:text-text-primary transition-colors">
                            <ChevronDown size={11} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </div>
                    </div>
                    {isOpen && hasDetails && (
                      <div className="px-3 pb-1.5 pl-14 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-text-muted border-t border-border pt-1">
                        {normType(film.type) && <span>Typ: <span className="text-text-secondary">{normType(film.type)}</span></span>}
                        {film.director && <span>Regie: <span className="text-text-secondary">{film.director}</span></span>}
                        {film.production && <span>Prod.: <span className="text-text-secondary">{film.production}</span></span>}
                        {film.festival && <span className="text-gold">★ {film.festival}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {films.length > 6 && (
              <button onClick={() => setShowAllFilms(!showAllFilms)}
                className="mt-4 flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors">
                {showAllFilms ? <><ChevronUp size={13} /> Weniger</> : <><ChevronDown size={13} /> Alle {films.length} Einträge</>}
              </button>
            )}
          </>
        )}

        {/* ── PROJEKTE — grouped by profile position, rest in Sonstiges ── */}
        {projectCredits.filter(c => c.projects).length > 0 && (() => {
          const credits = projectCredits.filter(c => c.projects);
          const positions: string[] = profile.positions ?? [];
          // Matched = role matches a profile position (case-insensitive)
          const matched: Record<string, typeof credits> = {};
          const unmatched: typeof credits = [];
          for (const c of credits) {
            const role = c.role?.trim() ?? "";
            const rl = role.toLowerCase();
            const posIdx = positions.findIndex(p => { const pl = p.toLowerCase(); return pl === rl || pl.includes(rl) || rl.includes(pl); });
            if (posIdx !== -1) {
              const key = positions[posIdx]; // use canonical casing from positions
              (matched[key] = matched[key] ?? []).push(c);
            } else {
              unmatched.push(c);
            }
          }
          // Groups: positions in order (only those with credits), then Sonstiges if any unmatched
          const groups: { label: string; items: typeof credits; isPosition: boolean }[] = [
            ...positions.filter(p => matched[p]?.length).map(p => ({ label: p, items: matched[p], isPosition: true })),
            ...(unmatched.length ? [{ label: "Weitere", items: unmatched, isPosition: false }] : []),
          ];
          if (!groups.length) return null;
          return (
            <>
              <Divider />
              <SectionLabel>Projekte</SectionLabel>
              <div className="space-y-5">
                {groups.map(({ label, items }) => (
                  <div key={label}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-lime mb-2">{label}</p>
                    <div className="border border-border rounded-lg overflow-hidden">
                      {[...items].sort((a, b) => (b.projects?.year ?? 0) - (a.projects?.year ?? 0)).map((credit) => {
                        const proj = credit.projects!;
                        const collaborator = credit.role?.split("||")[1]?.trim() ?? null;
                        return (
                          <Link key={credit.id} href={`/projects/${credit.project_id}`}
                            className="group flex items-center gap-3 px-3 py-2 border-b border-border/60 last:border-b-0 hover:bg-bg-elevated/60 transition-colors">
                            <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8">{proj.year ?? "—"}</span>
                            <span className="text-xs text-text-primary truncate flex-1 group-hover:text-gold transition-colors">{proj.title}</span>
                            {collaborator && <span className="text-[10px] text-text-muted shrink-0 truncate max-w-[25%] hidden sm:inline">{collaborator}</span>}
                            {normType(proj.type) && <span className="text-[10px] text-text-muted shrink-0 hidden sm:inline">{normType(proj.type)}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          );
        })()}

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

        {/* ── MITGLIEDSCHAFTEN ──────────────────────────────────────────── */}
        {memberships.length > 0 && (
          <>
            <Divider />
            <SectionLabel>Mitgliedschaften</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {memberships.map((m) => (
                <span key={m} className="px-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:border-gold/40 transition-colors">
                  {m}
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

        <CollaborationsSection collaborations={collaborations} />

        <ListingsSection listings={listings} />

        <Divider />
        <ReviewsSection
          targetId={profile.user_id}
          targetType="profile"
          targetName={profile.display_name ?? "Profil"}
        />

        <div className="h-16" />
      </div>

      {/* ── FOTO-GRID ─────────────────────────────────────────────────── */}
      {stripImages.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <PhotoGrid images={stripImages} profileId={profile.user_id} isOwner={isOwner} imageLikes={imageLikes} myImageLikes={myImageLikes} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

function ModelProfile({ profile, isOwner, companyMembership, listings = [], blockStatus = null, collaborations = [], imageLikes = {}, myImageLikes = [] }: { profile: UserProfile; isOwner: boolean; companyMembership: CompanyMembership; listings?: PublicListing[]; blockStatus?: { youBlocked: boolean; theyBlocked: boolean } | null; collaborations?: PublicCollab[]; imageLikes?: Record<string, number>; myImageLikes?: string[] }) {
  const canContact = !blockStatus?.youBlocked && !blockStatus?.theyBlocked;
  const [lightbox, setLightbox] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (profile.physical ?? {}) as any;
  const images: ProfileImage[] = profile.profile_images ?? [];
  const heroImg = images.find((i) => i.featured) ?? images[0];
  const galleryImgs = heroImg ? images.filter((i) => i !== heroImg) : images.slice(1);
  // Best available cover: featured profile_image → first profile_image → first portfolio_image → avatar
  const portfolioImages: string[] = (profile as unknown as { portfolio_images?: string[] }).portfolio_images ?? [];
  const heroCoverUrl: string | null = heroImg?.url ?? portfolioImages[0] ?? null;

  const reelUrl = profile.showreel_url ?? profile.reel_url;
  const reelEmbed = reelUrl ? getVideoEmbed(reelUrl) : null;
  const skills: string[] = profile.skills ?? [];
  const memberships: string[] = (profile as any).memberships ?? [];
  const languages = profile.languages ?? [];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* ── HERO (full editorial) ──────────────────────────────────────── */}
      <section className="relative h-[90vh] min-h-[560px] bg-black">
        {heroCoverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroCoverUrl}
            alt={profile.display_name ?? ""}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: (profile as any).focal_point ? `${(profile as any).focal_point.x}% ${(profile as any).focal_point.y}%` : "50% 33%" }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-bg-elevated via-bg-primary to-black" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/88" />

        {/* Top bar — only badges + edit */}
        <div className="absolute top-0 left-0 right-0 pt-20 px-6 sm:px-10 flex items-start justify-between">
          {profile.verified && (
            <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md text-white text-[10px] font-semibold px-3 py-1.5 rounded-full border border-white/20">
              <Check size={10} /> Verified
            </span>
          )}
          {isOwner && (
            <Link href="/profile" className="ml-auto flex items-center gap-1.5 bg-white/10 backdrop-blur-md text-white text-[10px] font-semibold px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-colors">
              <Pencil size={10} /> Bearbeiten
            </Link>
          )}
        </div>

        {/* Bottom info — pb-20 on mobile to clear the 56px BottomNav */}
        <div className="absolute bottom-0 left-0 right-0 px-6 sm:px-10 pb-20 lg:pb-10">
          <p className="text-white/80 text-xs uppercase tracking-[0.2em] mb-2 drop-shadow">
            {(profile.positions?.[0] ?? profile.role) ?? "Model"}
          </p>
          <h1 className="font-display text-5xl sm:text-7xl font-bold text-white leading-none tracking-tight mb-3 drop-shadow-lg">
            {profile.display_name ?? "Unbekannt"}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            {profile.location && (
              <p className="text-white/80 text-sm flex items-center gap-1.5 drop-shadow">
                <MapPin size={12} /> {profile.location}
              </p>
            )}
            {!isOwner && canContact && (
              <div className="flex items-center gap-2 ml-auto">
                <Link href={`/messages?to=${profile.user_id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-md border border-white/25 text-white rounded-lg hover:bg-white/25 transition-colors text-xs font-medium">
                  <MessageSquare size={11} /> Nachricht
                </Link>
                <Link href={`/booking?profile=${profile.user_id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-md border border-white/25 text-white rounded-lg hover:bg-white/25 transition-colors text-xs font-medium">
                  Anfrage <ExternalLink size={11} />
                </Link>
                <BlockReportBar targetId={profile.user_id} initialYouBlocked={blockStatus?.youBlocked ?? false} />
              </div>
            )}
          </div>
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
              {memberships.length > 0 && (
                <div>
                  <SectionLabel>Mitgliedschaften</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {memberships.map((m) => (
                      <span key={m} className="px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary">
                        {m}
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
          const gp = profile as unknown as { tiktok_url?: string; vimeo_url?: string; phone?: string; contact_email?: string };
          const links = ([
            { label: "Instagram", url: safeLink(profile.instagram_url) },
            { label: "TikTok",    url: safeLink(gp.tiktok_url) },
            { label: "YouTube",   url: safeLink(profile.youtube_url) },
            { label: "Vimeo",     url: safeLink(gp.vimeo_url) },
            { label: "LinkedIn",  url: safeLink(profile.linkedin_url) },
            { label: "Website",   url: safeLink(profile.website_url) },
            gp.phone?.trim()         ? { label: gp.phone.trim(),         url: `tel:${gp.phone.trim()}`,             contactIcon: "phone" as const } : null,
            gp.contact_email?.trim() ? { label: gp.contact_email.trim(), url: `mailto:${gp.contact_email.trim()}`, contactIcon: "mail" as const } : null,
          ] as const).filter((l): l is NonNullable<typeof l> & { url: string } => l !== null && !!l.url) as { label: string; url: string; contactIcon?: "phone" | "mail" }[];
          if (links.length === 0) return null;
          return (
            <>
              <Divider />
              <SectionLabel>Links</SectionLabel>
              <div className="flex flex-wrap gap-2 pb-4">
                {links.map(({ label, url, contactIcon }) => (
                  <a key={label} href={url!} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
                    {contactIcon === "phone" && <Phone size={11} />}
                    {contactIcon === "mail"  && <Mail size={11} />}
                    {label}
                    {!contactIcon && <ExternalLink size={9} className="opacity-50" />}
                  </a>
                ))}
              </div>
            </>
          );
        })()}

        <CollaborationsSection collaborations={collaborations} />

        <ListingsSection listings={listings} />

        <div className="py-12">
          <ReviewsSection
            targetId={profile.user_id}
            targetType="profile"
            targetName={profile.display_name ?? "Profil"}
          />
        </div>

        <div className="h-16" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC PROFILE (Crew, Creative, Vendor etc.)
// ═══════════════════════════════════════════════════════════════════════════════

function GenericProfile({ profile, isOwner, projectCredits, companyMembership, externalProfiles, listings = [], blockStatus = null, collaborations = [], imageLikes = {}, myImageLikes = [] }: { profile: UserProfile; isOwner: boolean; projectCredits: ProjectCredit[]; companyMembership: CompanyMembership; externalProfiles: ExternalProfileRow[]; listings?: PublicListing[]; blockStatus?: { youBlocked: boolean; theyBlocked: boolean } | null; collaborations?: PublicCollab[]; imageLikes?: Record<string, number>; myImageLikes?: string[] }) {
  const tc = useTranslations("common");
  const canContact = !blockStatus?.youBlocked && !blockStatus?.theyBlocked;
  const { user } = useUser();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [expandedFilm, setExpandedFilm] = useState<number | null>(null);
  const [friendStatus, setFriendStatus] = useState<null | "pending_sent" | "pending_received" | "friends">(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendLoading, setFriendLoading] = useState(false);

  useEffect(() => {
    if (isOwner || !user) return;
    const controller = new AbortController();
    fetch(`/api/friendships?userId=${profile.user_id}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        const friendship = data?.friendship;
        if (!friendship) return;
        setFriendshipId(friendship.id);
        if (friendship.status === "accepted") setFriendStatus("friends");
        else if (friendship.status === "pending")
          setFriendStatus(friendship.sender_id === user.id ? "pending_sent" : "pending_received");
      }).catch(() => {});
    return () => controller.abort();
  }, [isOwner, user, profile.user_id]);

  async function handleFriendAction() {
    if (friendLoading) return;
    setFriendLoading(true);
    try {
      if (!friendStatus) {
        const res = await fetch("/api/friendships", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiver_id: profile.user_id }) });
        if (!res.ok) return;
        const data = await res.json();
        setFriendshipId(data.id);
        setFriendStatus("pending_sent");
      } else if (friendStatus === "pending_received" && friendshipId) {
        const res = await fetch(`/api/friendships/${friendshipId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "accepted" }) });
        if (res.ok) setFriendStatus("friends");
      }
    } finally { setFriendLoading(false); }
  }

  const images: ProfileImage[] = profile.profile_images ?? [];
  const reelUrl = profile.showreel_url ?? profile.reel_url;
  const reelEmbed = reelUrl ? getVideoEmbed(reelUrl) : null;
  const films: FilmographyEntry[] = profile.filmography ?? [];
  const awards: ProfileAward[] = profile.awards ?? [];
  const skills: string[] = profile.skills ?? [];
  const memberships: string[] = (profile as any).memberships ?? [];
  const languages = profile.languages ?? [];
  const certificates: string[] = profile.crew?.certificates ?? [];
  const software: string[] = profile.crew?.software ?? [];
  const bgImage = profile.cover_image_url ?? (images.find((i) => i.featured)?.url);

  // Filmografie shows only manual entries — linked project credits appear as visual cards in "Projekte"
  const creditTitles = new Set(
    projectCredits.filter((c) => c.projects).map((c) => c.projects!.title.toLowerCase().trim())
  );

  const filmRows: FilmographyEntry[] = films
    .filter((f) => !creditTitles.has(f.title.toLowerCase().trim()))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* Hero */}
      <section className="relative overflow-hidden">
        {bgImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-bg-primary" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-bg-elevated to-bg-primary" />
        )}

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-14">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="flex-1 min-w-0 w-full">
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight drop-shadow-lg">
                {profile.display_name ?? "Unbekannt"}
                <span className="block h-0.5 w-12 bg-gold mt-3 rounded-full" />
              </h1>
              {(profile.positions?.[0] ?? profile.role) && (() => {
                const allPos = (profile.positions ?? [profile.role]).filter(Boolean) as string[];
                const [primary, ...rest] = allPos;
                return (
                  <div className="mt-3">
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-gold/20 text-gold border border-gold/30 drop-shadow-md">
                      {primary}
                    </span>
                    {rest.length > 0 && (
                      <p className="text-white/70 text-sm mt-2 font-light tracking-wide drop-shadow-md" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                        {rest.map((pos, i) => (
                          <span key={i}>{pos}{i < rest.length - 1 && <span className="text-gold/60 mx-2">·</span>}</span>
                        ))}
                      </p>
                    )}
                  </div>
                );
              })()}
              {profile.location && (
                <p className="text-white/60 text-xs mt-2.5 flex items-center gap-1 drop-shadow-md" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
                  <MapPin size={10} />{profile.location}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:shrink-0 sm:mt-1">
              {!isOwner ? (
                <>
                  {canContact && (
                    <>
                      <Link href={`/messages?to=${profile.user_id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-md border border-white/25 text-white font-medium rounded-lg hover:bg-white/25 transition-colors text-xs">
                        <MessageSquare size={11} /> Nachricht
                      </Link>
                      <button onClick={handleFriendAction} disabled={friendLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-md border border-white/25 text-white font-medium rounded-lg hover:bg-white/25 transition-colors text-xs disabled:opacity-50">
                        {friendStatus === "friends" ? <><Check size={11} /> Vernetzt</> : friendStatus === "pending_sent" ? "Gesendet" : friendStatus === "pending_received" ? <><UserPlus size={11} /> Annehmen</> : <><UserPlus size={11} /> Vernetzen</>}
                      </button>
                      <Link href={`/booking?profile=${profile.user_id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-md border border-white/25 text-white font-medium rounded-lg hover:bg-white/25 transition-colors text-xs">
                        Anfrage <ExternalLink size={11} />
                      </Link>
                    </>
                  )}
                  <BlockReportBar targetId={profile.user_id} initialYouBlocked={blockStatus?.youBlocked ?? false} />
                </>
              ) : (
                <Link href="/profile" className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md text-white text-[10px] font-semibold px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-colors">
                  <Pencil size={10} /> Bearbeiten
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* Two-column: avatar + compact info */}
        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-8 mb-10">
          {/* Avatar */}
          <div className="shrink-0">
            {profile.avatar_url ? (
              <div className="relative">
                <Image src={profile.avatar_url} alt={profile.display_name ?? ""} width={200} height={200}
                  className="w-full aspect-square rounded-2xl object-cover ring-1 ring-white/8 shadow-2xl" />
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${profile.available ? "bg-gold" : "bg-red-400"}`} />
                  <span className={`text-[10px] font-medium ${profile.available ? "text-gold/90" : "text-white/60"}`}>{profile.available ? "Verfügbar" : "Nicht verfügbar"}</span>
                </div>
              </div>
            ) : (
              <div className="w-full aspect-square rounded-2xl bg-bg-elevated border border-border flex items-center justify-center text-4xl font-bold text-text-muted">
                {(profile.display_name ?? "?")[0]}
              </div>
            )}
          </div>

          {/* Compact info */}
          <div className="flex gap-5 pt-1">
            <div className="flex-1 space-y-5 min-w-0">

            {profile.bio && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                  <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Über mich</p>
                </div>
                <p className="text-text-secondary text-[13px] leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {(languages.length > 0 || profile.day_rate || profile.travel_ready || profile.crew?.experience_years) && (
              <div className="flex flex-wrap gap-x-6 gap-y-3 pl-3 border-l border-gold/20">
                {languages.length > 0 && <StatPill label="Sprachen" value={languages.join(", ")} />}
                {profile.day_rate && <StatPill label="Tagesgage" value={`${profile.day_rate} €`} />}
                {profile.travel_ready && <StatPill label="Reisen" value="Reisebereit" />}
                {profile.crew?.experience_years && <StatPill label="Erfahrung" value={`${profile.crew.experience_years} Jahre`} />}
              </div>
            )}

            {skills.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                  <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Skills</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-bg-elevated border border-border rounded-md text-xs text-text-primary hover:border-gold/30 transition-colors">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {memberships.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                  <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Mitgliedschaften</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {memberships.map((m) => (
                    <span key={m} className="px-2.5 py-1 bg-bg-elevated border border-border rounded-md text-xs text-text-primary hover:border-gold/30 transition-colors">{m}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Links & Kontakt — moved above certificates */}
            {(() => {
              const gp2 = profile as unknown as { tiktok_url?: string; vimeo_url?: string; phone?: string; contact_email?: string };
              const links = ([
                { label: "Instagram", url: safeLink(profile.instagram_url) },
                { label: "TikTok",    url: safeLink(gp2.tiktok_url) },
                { label: "YouTube",   url: safeLink(profile.youtube_url) },
                { label: "Vimeo",     url: safeLink(gp2.vimeo_url) },
                { label: "LinkedIn",  url: safeLink(profile.linkedin_url) },
                { label: "Website",   url: safeLink(profile.website_url) },
                gp2.phone?.trim()         ? { label: gp2.phone.trim(),         url: `tel:${gp2.phone.trim()}`,             contactIcon: "phone" as const } : null,
                gp2.contact_email?.trim() ? { label: gp2.contact_email.trim(), url: `mailto:${gp2.contact_email.trim()}`, contactIcon: "mail" as const } : null,
              ] as const).filter((l): l is NonNullable<typeof l> & { url: string } => l !== null && !!l.url) as { label: string; url: string; contactIcon?: "phone" | "mail" }[];
              if (links.length === 0) return null;
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                    <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Links & Kontakt</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {links.map(({ label, url, contactIcon }) => (
                      <a key={label} href={url!} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-bg-elevated border border-border rounded-lg text-xs text-text-primary hover:border-gold/40 hover:text-gold transition-colors">
                        {contactIcon === "phone" && <Phone size={11} className="shrink-0" />}
                        {contactIcon === "mail"  && <Mail size={11} className="shrink-0" />}
                        {label}
                        {!contactIcon && <ExternalLink size={9} className="shrink-0 opacity-40" />}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Externe Profile */}
            {externalProfiles.length > 0 && (
              <ExternalProfilesDisplay profiles={externalProfiles} />
            )}

            {software.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                  <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Software</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {software.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-bg-elevated border border-border rounded-md text-xs text-text-primary">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Lizenzen & Zertifikate — moved below links */}
            {certificates.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                  <p className="text-[10px] uppercase tracking-widest text-gold font-bold">Lizenzen & Zertifikate</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {certificates.map((c) => (
                    <span key={c} className="px-2.5 py-1 bg-bg-elevated border border-border rounded-md text-xs text-text-primary">{c}</span>
                  ))}
                </div>
              </div>
            )}

            </div>{/* end flex-1 info */}
            {companyMembership?.companies && (
              <div className="hidden sm:block w-44 shrink-0">
                <CompanyBadge membership={companyMembership} />
              </div>
            )}
          </div>{/* end flex row */}

          {/* Company on mobile — shown below info */}
          {companyMembership?.companies && (
            <div className="sm:hidden mt-4">
              <CompanyBadge membership={companyMembership} />
            </div>
          )}
        </div>

        <Divider />

        {/* Projekte — grouped by profile position, rest in Weitere */}
        {projectCredits.filter(c => c.projects).length > 0 && (() => {
          const credits = projectCredits.filter(c => c.projects);
          const positions: string[] = profile.positions ?? [];
          const matched: Record<string, typeof credits> = {};
          const unmatched: typeof credits = [];
          for (const c of credits) {
            const role = c.role?.trim() ?? "";
            const rl = role.toLowerCase();
            const posIdx = positions.findIndex(p => { const pl = p.toLowerCase(); return pl === rl || pl.includes(rl) || rl.includes(pl); });
            if (posIdx !== -1) {
              const key = positions[posIdx];
              (matched[key] = matched[key] ?? []).push(c);
            } else {
              unmatched.push(c);
            }
          }
          const groups: { label: string; items: typeof credits }[] = [
            ...positions.filter(p => matched[p]?.length).map(p => ({ label: p, items: matched[p] })),
            ...(unmatched.length ? [{ label: "Weitere", items: unmatched }] : []),
          ];
          if (!groups.length) return null;
          return (
            <div className="mb-12">
              <SectionLabel>Projekte</SectionLabel>
              <div className="space-y-5">
                {groups.map(({ label, items }) => (
                  <div key={label}>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-lime mb-1.5">{label}</p>
                    <div className="border border-border rounded-lg overflow-hidden bg-bg-secondary">
                      {[...items].sort((a, b) => (b.projects?.year ?? 0) - (a.projects?.year ?? 0)).map((credit) => {
                        const proj = credit.projects!;
                        const collaborator = credit.role?.split("||")[1]?.trim() ?? null;
                        return (
                          <Link key={credit.id} href={`/projects/${credit.project_id}`}
                            className="group flex items-center gap-3 px-3 py-2 border-b border-border/60 last:border-b-0 hover:bg-bg-elevated/60 transition-colors">
                            <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8">{proj.year ?? "—"}</span>
                            <span className="text-xs text-text-primary truncate flex-1 group-hover:text-gold transition-colors">{proj.title}</span>
                            {collaborator && <span className="text-[10px] text-text-muted shrink-0 truncate max-w-[25%]">{collaborator}</span>}
                            {normType(proj.type) && <span className="text-[10px] text-text-muted shrink-0 hidden sm:inline">{normType(proj.type)}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Filmografie — manual entries only */}
        {filmRows.length > 0 && (
          <div className="mb-12">
            <SectionLabel>Filmografie</SectionLabel>
            <div className="border border-border rounded-lg overflow-hidden bg-bg-secondary">
              {filmRows.map((film, i) => {
                const isOpen = expandedFilm === i;
                const hasDetails = !!(film.director || film.festival || film.type || film.production);
                return (
                  <div key={`film-${i}`} className="border-b border-border/60 last:border-b-0">
                    <div className="flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated/60 transition-colors">
                      <span className="text-[10px] tabular-nums text-gold font-bold shrink-0 w-8">{film.year || "—"}</span>
                      <div className="flex-1 min-w-0">
                        {film.imdb_url && safeLink(film.imdb_url) ? (
                          <a href={safeLink(film.imdb_url)!} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-text-primary hover:text-gold transition-colors inline-flex items-center gap-1">
                            {film.title} <ExternalLink size={9} className="text-text-muted shrink-0" />
                          </a>
                        ) : (
                          <span className="text-xs text-text-primary">{film.title}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {film.role && <span className="text-[10px] text-text-primary truncate max-w-[120px]">{film.role}</span>}
                        {film.festival && <span className="text-[10px] text-gold">★</span>}
                        {hasDetails && (
                          <button type="button" onClick={() => setExpandedFilm(isOpen ? null : i)}
                            className="text-text-muted hover:text-text-primary transition-colors">
                            <ChevronDown size={11} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </div>
                    </div>
                    {isOpen && hasDetails && (
                      <div className="px-3 pb-1.5 pl-14 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-text-muted border-t border-border pt-1">
                        {normType(film.type) && <span>Typ: <span className="text-text-secondary">{normType(film.type)}</span></span>}
                        {film.director && <span>Regie: <span className="text-text-secondary">{film.director}</span></span>}
                        {film.production && <span>Prod.: <span className="text-text-secondary">{film.production}</span></span>}
                        {film.festival && <span className="text-gold">★ {film.festival}</span>}
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

        <CollaborationsSection collaborations={collaborations} />

        <ListingsSection listings={listings} />

        <div className="mt-12 mb-8">
          <ReviewsSection
            targetId={profile.user_id}
            targetType="profile"
            targetName={profile.display_name ?? "Profil"}
          />
        </div>

      </div>

      {/* ── FOTO-GRID ─────────────────────────────────────────────────── */}
      {images.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <PhotoGrid images={images} profileId={profile.user_id} isOwner={isOwner} imageLikes={imageLikes} myImageLikes={myImageLikes} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — type-based routing
// ═══════════════════════════════════════════════════════════════════════════════

type PublicListing = { id: string; type: string; title: string; category: string | null; price: number | null; city: string; image_url: string | null; focal_point?: { x: number; y: number } | null };

// ─── Photo grid with likes ────────────────────────────────────────────────────
function StarRating({ value, max = 5, size = 14 }: { value: number; max?: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ fontSize: size, lineHeight: 1 }} className={i < Math.round(value) ? "text-gold" : "text-white/30"}>★</span>
      ))}
    </span>
  );
}

type ImageComment = { id: string; author_id: string; author_name: string; author_avatar: string | null; text: string; created_at: string };

function ImageModal({
  image,
  profileId,
  liked,
  likeCount,
  isOwner,
  onToggleLike,
  onClose,
}: {
  image: ProfileImage;
  profileId: string;
  liked: boolean;
  likeCount: number;
  isOwner: boolean;
  onToggleLike: () => void;
  onClose: () => void;
}) {
  const { isSignedIn, user } = useUser();
  const [comments, setComments] = useState<ImageComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch(`/api/profile-image-comments?profile_id=${profileId}&image_url=${encodeURIComponent(image.url)}`)
      .then(r => r.json())
      .then(({ comments: c }) => setComments(c ?? []))
      .catch(() => {});
  }, [image.url, profileId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const postComment = async () => {
    const text = commentText.trim();
    if (!text || !isSignedIn) return;
    setPosting(true);
    const temp: ImageComment = { id: `temp-${Date.now()}`, author_id: user?.id ?? "", author_name: user?.fullName ?? "Du", author_avatar: null, text, created_at: new Date().toISOString() };
    setComments(c => [...c, temp]);
    setCommentText("");
    try {
      const res = await fetch("/api/profile-image-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, image_url: image.url, text }),
      });
      const { comment } = await res.json();
      if (comment) setComments(c => c.map(x => x.id === temp.id ? comment : x));
    } catch {
      setComments(c => c.filter(x => x.id !== temp.id));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative w-full max-w-4xl flex flex-col md:flex-row rounded-2xl overflow-hidden bg-bg-secondary border border-border shadow-2xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Image */}
        <div className="md:w-3/5 bg-black flex items-center justify-center min-h-[240px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={image.caption ?? ""} className="w-full h-full max-h-[90vh] md:max-h-[90vh] object-contain" />
        </div>
        {/* Side panel */}
        <div className="md:w-2/5 flex flex-col max-h-[60vh] md:max-h-[90vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <p className="text-sm font-medium text-text-primary truncate">{image.caption || "Foto"}</p>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary ml-2 shrink-0"><X size={18} /></button>
          </div>
          {/* Comments scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {comments.length === 0 && (
              <p className="text-xs text-text-muted text-center py-6">Noch keine Kommentare. Sei der Erste!</p>
            )}
            {comments.map(c => (
              <div key={c.id} className="flex gap-2.5">
                {c.author_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.author_avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-gold text-[10px] font-bold">{c.author_name[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div className="text-xs leading-relaxed">
                  <span className="font-semibold text-text-primary">{c.author_name}</span>
                  <span className="text-text-secondary ml-1.5">{c.text}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Hearts row */}
          <div className="px-4 py-3 border-t border-border flex items-center gap-2.5 shrink-0">
            {!isOwner && isSignedIn ? (
              <button onClick={onToggleLike}
                className={`transition-transform active:scale-125 ${liked ? "text-red-400" : "text-text-muted hover:text-red-400"}`}>
                <Heart size={22} className={liked ? "fill-current" : ""} />
              </button>
            ) : (
              <Heart size={22} className="text-text-muted/30" />
            )}
            <span className="text-sm font-semibold text-text-primary">{likeCount} {likeCount === 1 ? "Herz" : "Herzen"}</span>
          </div>
          {/* Comment input */}
          {isSignedIn && (
            <div className="px-3 pb-3 flex gap-2 border-t border-border pt-3 shrink-0">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void postComment(); } }}
                placeholder="Kommentar hinzufügen…"
                className="flex-1 bg-bg-elevated border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold/50"
              />
              <button onClick={() => void postComment()} disabled={!commentText.trim() || posting}
                className="px-3 py-2 bg-gold text-bg-primary rounded-xl disabled:opacity-40 hover:bg-gold-light transition-colors">
                <Send size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoGrid({
  images,
  profileId,
  isOwner,
  imageLikes,
  myImageLikes,
}: {
  images: ProfileImage[];
  profileId: string;
  isOwner: boolean;
  imageLikes: Record<string, number>;
  myImageLikes: string[];
}) {
  const { isSignedIn } = useUser();
  const [likes, setLikes] = useState(imageLikes);
  const [myLikedSet, setMyLikedSet] = useState(() => new Set(myImageLikes));
  const [selectedImage, setSelectedImage] = useState<ProfileImage | null>(null);

  const sorted = [...images].sort((a, b) => (likes[b.url] ?? 0) - (likes[a.url] ?? 0));
  const topUrl = sorted[0]?.url;
  const topHasLikes = (likes[topUrl] ?? 0) > 0;

  const toggleLike = async (imageUrl: string) => {
    if (!isSignedIn || isOwner) return;
    const wasLiked = myLikedSet.has(imageUrl);
    setMyLikedSet(prev => { const next = new Set(prev); wasLiked ? next.delete(imageUrl) : next.add(imageUrl); return next; });
    setLikes(prev => ({ ...prev, [imageUrl]: Math.max(0, (prev[imageUrl] ?? 0) + (wasLiked ? -1 : 1)) }));
    try {
      await fetch("/api/profile-image-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, image_url: imageUrl }),
      });
    } catch {
      setMyLikedSet(prev => { const next = new Set(prev); wasLiked ? next.add(imageUrl) : next.delete(imageUrl); return next; });
      setLikes(prev => ({ ...prev, [imageUrl]: Math.max(0, (prev[imageUrl] ?? 0) + (wasLiked ? 1 : -1)) }));
    }
  };

  return (
    <>
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          profileId={profileId}
          liked={myLikedSet.has(selectedImage.url)}
          likeCount={likes[selectedImage.url] ?? 0}
          isOwner={isOwner}
          onToggleLike={() => void toggleLike(selectedImage.url)}
          onClose={() => setSelectedImage(null)}
        />
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {sorted.map((img) => {
          const count = likes[img.url] ?? 0;
          const isTop = img.url === topUrl && topHasLikes;
          return (
            <button key={img.url} type="button" onClick={() => setSelectedImage(img)}
              className="relative aspect-[4/3] overflow-hidden rounded-xl group border border-border/50 bg-bg-elevated">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption ?? ""} className="w-full h-full object-cover transition-all duration-500 group-hover:brightness-110 group-hover:scale-[1.03]" loading="lazy" />
              {isTop && (
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-gold/90 rounded-full text-bg-primary text-[10px] font-bold">♥ Top</div>
              )}
              {count > 0 && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 rounded-full backdrop-blur-sm">
                  <Heart size={10} className="text-red-400 fill-current" />
                  <span className="text-white text-[10px] font-semibold">{count}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}


type SimilarProfile = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  slug: string;
  role: string | null;
  profile_type: string;
  location: string | null;
  tagline: string | null;
  verified: boolean;
  day_rate: number | null;
};

function SimilarProfilesSection({ profiles }: { profiles: SimilarProfile[] }) {
  if (profiles.length === 0) return null;
  return (
    <section className="border-t border-border bg-bg-secondary py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-text-primary">Ähnliche Profile</h2>
          <Link href="/creators" className="text-xs text-gold hover:text-gold-light transition-colors font-semibold">
            Alle entdecken →
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible scrollbar-hide">
          {profiles.map((p) => {
            const city = typeof p.location === "string" ? p.location.split(",")[0]?.trim() : null;
            return (
              <Link
                key={p.user_id}
                href={`/profile/${p.slug}`}
                className="group shrink-0 w-36 sm:w-auto flex flex-col items-center text-center p-3 rounded-xl border border-border bg-bg-elevated hover:border-gold/40 transition-all"
              >
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-bg-hover border border-border mb-2.5">
                  {p.avatar_url ? (
                    <Image src={p.avatar_url} alt={p.display_name} fill className="object-cover" sizes="56px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted text-lg font-bold">
                      {p.display_name[0]?.toUpperCase()}
                    </div>
                  )}
                  {p.verified && (
                    <span className="absolute bottom-0 right-0 w-4 h-4 bg-gold rounded-full border-2 border-bg-elevated flex items-center justify-center">
                      <Check size={8} className="text-bg-primary stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-text-primary leading-tight line-clamp-1 group-hover:text-gold transition-colors">{p.display_name}</p>
                {(p.role ?? p.tagline) && (
                  <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{p.role ?? p.tagline}</p>
                )}
                {city && (
                  <p className="text-[10px] text-text-muted/60 mt-0.5 flex items-center gap-0.5">
                    <MapPin size={7} />{city}
                  </p>
                )}
                {p.day_rate && p.day_rate > 0 && (
                  <p className="text-[10px] text-gold font-semibold mt-1">{p.day_rate} €/Tag</p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function ProfileView({
  profile,
  isOwner,
  projectCredits = [],
  companyMembership = null,
  externalProfiles = [],
  listings = [],
  blockStatus = null,
  collaborations = [],
  imageLikes = {},
  myImageLikes = [],
  similarProfiles = [],
}: {
  profile: UserProfile;
  isOwner: boolean;
  projectCredits?: ProjectCredit[];
  companyMembership?: CompanyMembership;
  externalProfiles?: ExternalProfileRow[];
  listings?: PublicListing[];
  blockStatus?: { youBlocked: boolean; theyBlocked: boolean } | null;
  collaborations?: PublicCollab[];
  imageLikes?: Record<string, number>;
  myImageLikes?: string[];
  similarProfiles?: SimilarProfile[];
}) {
  const category = PROFILE_CATEGORY_MAP[profile.profile_type] ?? "crew";

  const similarSection = !isOwner && similarProfiles.length > 0
    ? <SimilarProfilesSection profiles={similarProfiles} />
    : null;

  // Model types get editorial layout
  if (profile.profile_type === "model") {
    return <><ModelProfile profile={profile} isOwner={isOwner} companyMembership={companyMembership} listings={listings} blockStatus={blockStatus} collaborations={collaborations} imageLikes={imageLikes} myImageLikes={myImageLikes} />{similarSection}</>;
  }

  // Actor/talent types get casting-ready layout
  if (category === "talent") {
    return <><ActorProfile profile={profile} isOwner={isOwner} projectCredits={projectCredits} companyMembership={companyMembership} externalProfiles={externalProfiles} listings={listings} blockStatus={blockStatus} collaborations={collaborations} imageLikes={imageLikes} myImageLikes={myImageLikes} />{similarSection}</>;
  }

  // Crew, creative, vendor get generic layout
  return <><GenericProfile profile={profile} isOwner={isOwner} projectCredits={projectCredits} companyMembership={companyMembership} externalProfiles={externalProfiles} listings={listings} blockStatus={blockStatus} collaborations={collaborations} imageLikes={imageLikes} myImageLikes={myImageLikes} />{similarSection}</>;
}
