"use client";

import { profileTraitLabel, profileTravelValue } from "@/lib/profile-trait-labels";
import { listingPriceLabel } from "@/lib/listing-price";
import { marketplaceCategoryLabel } from "@/lib/marketplace-offer";
import Image from "@/components/MediaImage";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  MapPin, MessageSquare, Award, ChevronDown, ChevronUp,
  Pencil, ExternalLink, X, Check, Globe,
  Ban, Users2, MoreHorizontal, Phone, Mail, Send,
} from "lucide-react";
import type { UserProfile, ProfileImage, FilmographyEntry, ProfileAward, ProjectCredit } from "@/lib/profile-types";
import ReviewsSection from "@/components/ReviewsSection";
import { PROFILE_CATEGORY_MAP, PROFILE_TYPE_LABELS } from "@/lib/profile-types";
import { cleanProfileBio, getProfileDisplayPositions, normalizeProfileTypes } from "@/lib/profile-display";
import { getPlatform, type ExternalProfileRow } from "@/lib/external-platforms";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import PhotoLikeButton from "@/components/PhotoLikeButton";
import { markPhotoNavigation, photoHref } from "@/lib/photo-link";
import CompanyLogo from "@/components/CompanyLogo";
import ProfileRoles from "./ProfileRoles";
import ProfileCardPhoto from "@/components/ProfileCardPhoto";
import ResilientPublicImage from "@/components/ResilientPublicImage";
import { profileCoverStyle } from "@/lib/profile-cover";
import FloatingPanel from "@/components/FloatingPanel";
import ConnectButton from "@/components/ConnectButton";
import { taxonomyLabel } from "@/lib/departments";


// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the URL only if it is non-empty and parseable — prevents dead links */


function getLocalizedProfileTypeLabels(translate: (key: string) => string): typeof PROFILE_TYPE_LABELS { return { actor: translate("menu.crewActors"), model: translate("MarketplaceOffer.fields.model"), extra: translate("Ui.text_359b6b495d37ee"), host: translate("Ui.text_0a95f0e5c8dfe9"), dancer: translate("Ui.text_edbf4c8ebb46d7"), stunt: translate("Ui.text_b84275027d70dc"), voiceover: translate("Ui.text_ecd65813175a41"), creator: translate("Ui.text_d952b2e69292db"), camera: translate("menu.crewCamera"), lighting: translate("Ui.text_df58636dc4a76c"), sound: translate("menu.crewSound"), director_of_photography: translate("Ui.text_e0e64895eb6431"), director: translate("menu.crewDirection"), production: translate("menu.crewProduction"), makeup: translate("Ui.text_93c744e1d17b9a"), costume: translate("Ui.text_a21ae87ef519df"), postproduction: translate("Ui.text_212f3b80ce86c2"), vfx: translate("Ui.text_23d20474305ac3"), sfx: translate("menu.marketSfx"), art_department: translate("Ui.text_a92fc587a90c16"), broadcast: translate("Ui.text_17bc9178343601"), filmmaker: translate("Ui.text_93ecd734fdc054"), writer: translate("Ui.text_fec099ea8a39bd"), photographer: translate("menu.crewPhotographer"), editor: translate("Ui.text_0e4eb4156e02e7"), motion_designer: translate("Ui.text_8213a51cdbc986"), art_director: translate("Ui.text_2d3b48143ed2b9"), location: translate("locations.vendorSection"), equipment: translate("props.vendorSection"), vehicle: translate("Ui.text_758a6eefc6f22f"), studio: translate("Ui.text_3e35f07c14a89e"), props: translate("Ui.text_54d1cc854cc30d") }; }

function getLocalizedREPORT_REASONS(translate: (key: string) => string): Record<string, string> { return ({
  spam: translate("Ui.text_94a9eac404c8c6"),
  harassment: translate("Ui.text_0392938fdb775e"),
  fake_profile: translate("Ui.text_6a614a7d2985d7"),
  inappropriate_content: translate("Ui.text_3a6f6d61b35e21"),
  scam: translate("Ui.text_0b3150008de153"),
  other: translate("Ui.text_6e2ae34293c61b"),
}); }

function getLocalizedLISTING_TYPE_META(translate: (key: string) => string): Record<string, { label: string; color: string; href: (id: string) => string }> {
  return ({
  job:      { label: translate("AdminAccounts.contentKinds.job"),        color: "text-gold",         href: (id) => `/jobs/${id}` },
  prop:     { label: translate("nav.marketplace"), color: "text-violet-400",   href: (id) => `/props/${id}` },
  location: { label: translate("profile.labelLocation"),   color: "text-emerald-400",  href: (id) => `/locations/${id}` },
  vehicle:  { label: translate("AdminAccounts.contentKinds.vehicle"),   color: "text-sky-400",      href: (id) => `/vehicles/${id}` },
  creator:  { label: translate("Ui.text_88447b83090cde"),    color: "text-rose-400",     href: (id) => `/creators/${id}` },
  animal:   { label: translate("Ui.text_cb9e8664edea8c"),       color: "text-amber-400",    href: (id) => `/tiere/${id}` },
});
}

function safeLink(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const u = new URL(normalized);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return normalized;
  } catch { return null; }
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
    <div className="flex min-w-0 max-w-full flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-[0.15em] text-gold font-bold">{label}</span>
      <span className="min-w-0 max-w-full break-words text-sm font-semibold text-text-primary leading-snug [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

function ProfileBio({ value, limit = 360 }: { value: string | null | undefined; limit?: number }) {
  const uiText = useTranslations();

  const [expanded, setExpanded] = useState(false);
  const text = cleanProfileBio(value);
  if (!text) return null;
  const shortened = text.length > limit && !expanded;
  const visibleText = shortened ? uiText("Ui.text_06fd28c4e0e314", { value1: String(text.slice(0, limit).trimEnd()) }) : text;
  return (
    <div>
      <p className="whitespace-pre-line break-words text-text-secondary text-sm leading-relaxed">{visibleText}</p>
      {text.length > limit && (
        <button type="button" onClick={() => setExpanded((current) => !current)}
          className="mt-2 min-h-11 text-xs font-semibold text-gold hover:text-gold-light">
          {expanded ? uiText("Ui.text_2f11e0e6d3c3c5") : uiText("Ui.text_2971cf6bdd5f19")}
        </button>
      )}
    </div>
  );
}

function displayPositions(profile: UserProfile, labels: typeof PROFILE_TYPE_LABELS): string[] {
  return getProfileDisplayPositions({
    positions: profile.positions,
    role: profile.role,
    profileTypes: profile.profile_types,
    primaryType: profile.profile_type,
    labels: labels,
  });
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

function ContactSignInPrompt({ profile }: { profile: UserProfile }) {
  const uiText = useTranslations();

  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded || isSignedIn || !profile.contact_requires_sign_in) return null;
  const destination = `/profile/${profile.slug || profile.user_id}`;
  return (
    <p className="mt-2 text-xs text-text-muted">{uiText.rich("Ui.text_83d4adfe076fb9", { part1: chunks => (<Link href={`/sign-in?redirect_url=${encodeURIComponent(destination)}`} className="font-medium text-gold hover:text-gold-light underline underline-offset-2">{chunks}</Link>) })}</p>
  );
}

// ─── Block / Report Bar ───────────────────────────────────────────────────────



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
  const uiText = useTranslations();
  const { user } = useUser();
  const router = useRouter();
  const REPORT_REASONS = getLocalizedREPORT_REASONS(uiText);
  const blockScope = `${user?.id ?? ""}:${targetId}`;
  const blockOwner = useRef<string | null>(blockScope);
  const blockPending = useRef<object | null>(null);
  useLayoutEffect(() => {
    blockOwner.current = blockScope;
    return () => { blockOwner.current = null; blockPending.current = null; };
  }, [blockScope]);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [blockState, setBlockState] = useState({ scope: blockScope, blocked: initialYouBlocked });
  const youBlocked = blockState.scope === blockScope ? blockState.blocked : initialYouBlocked;
  const [blockLoading, setBlockLoading] = useState(false);
  const [blockError, setBlockError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState("");

  async function toggleBlock() {
    if (!user?.id || blockPending.current) return;
    const own = {};
    blockPending.current = own;
    setBlockLoading(true);
    setBlockError("");
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store", signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ blocked_id: targetId, blocked: !youBlocked, accountId: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (blockOwner.current !== blockScope) return;
      if (res.ok && typeof data.blocked === "boolean") {
        setBlockState({ scope: blockScope, blocked: data.blocked });
        router.refresh();
      } else {
        setBlockError(uiText("Ui.text_37c7cf209c791e"));
      }
    } catch {
      if (blockOwner.current === blockScope) setBlockError(uiText("Ui.text_e232416aafa1dc"));
    } finally {
      if (blockPending.current === own) blockPending.current = null;
      if (blockOwner.current === blockScope) setBlockLoading(false);
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
      setReportError(uiText("Ui.text_480641557523c2"));
    }
  }

  return (
    <div className="relative">
      <button
        ref={menuTriggerRef}
        type="button"
        aria-expanded={reportOpen}
        onClick={() => setReportOpen((o) => !o)}
        className="h-11 w-11 flex items-center justify-center rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white/70 hover:text-white hover:bg-white/20 transition-all"
        aria-label={uiText("Ui.text_77f6895995c868")}
      >
        <MoreHorizontal size={15} />
      </button>

      {reportOpen && (
        <FloatingPanel anchorRef={menuTriggerRef} onClose={() => setReportOpen(false)} className="bg-[#1e2028] border border-white/10 rounded-xl shadow-2xl py-1">
          <button
            onClick={() => { toggleBlock(); setReportOpen(false); }}
            disabled={blockLoading || !user?.id}
            className={`w-full min-h-11 flex items-center gap-2 px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
              youBlocked ? "text-red-400 hover:bg-red-500/10" : "text-white/70 hover:bg-white/5 hover:text-red-400"
            }`}
          >
            <Ban size={12} /> {youBlocked ? uiText("Ui.text_667b3b5f741b3a") : uiText("Ui.text_f0fc0d8ae9b598")}
          </button>
          {reportSent ? (
            <span className="flex items-center gap-2 px-3 py-2 text-xs text-emerald-400">{uiText.rich("Ui.text_ccdbcd6f8ebe77", { part1: () => (<Check size={12} />) })}</span>
          ) : (
            <>
              <div className="h-px bg-white/10 mx-2 my-1" />
              <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-widest text-white/40 font-semibold">{uiText("Ui.text_723a95c949eaba")}</p>
              {Object.entries(REPORT_REASONS).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setReportReason(value)}
                  className={`w-full min-h-11 flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
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
                    className="min-h-11 w-full px-3 py-2 bg-gold text-bg-primary font-semibold rounded-lg text-xs hover:bg-gold-light transition-colors"
                  >{uiText("Ui.text_8572d639a935e8")}</button>
                </div>
              )}
            </>
          )}
          {reportError && <p className="px-3 py-1 text-xs text-red-400">{reportError}</p>}
        </FloatingPanel>
      )}
      {blockError && <div role="alert" className="mt-1 max-w-xs break-words text-xs text-red-400">
        <p>{blockError}</p><button type="button" disabled={blockLoading} onClick={() => void toggleBlock()} className="inline-flex min-h-11 items-center text-gold underline">{uiText("Contacts.retry")}</button>
      </div>}
    </div>
  );
}

// ─── Collaborations Section ───────────────────────────────────────────────────

type PublicCollab = { label: string; display_name: string; avatar_url: string | null; slug: string; role: string | null };

function CollaborationsSection({ collaborations }: { collaborations: PublicCollab[] }) {
  const uiText = useTranslations();

  if (!collaborations.length) return null;
  return (
    <>
      <Divider />
      <SectionLabel>{uiText("Ui.text_bba4bfa84336fb")}</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {collaborations.map((c) => (
          <Link
            key={c.slug}
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



function ListingsSection({ listings }: { listings: PublicListing[] }) {
  const uiText = useTranslations();
  const LISTING_TYPE_META = getLocalizedLISTING_TYPE_META(uiText);


  const market=useTranslations("MarketplaceOffer"),catalog=useTranslations("MarketplaceCatalog"),locale=useLocale();
  if (!listings.length) return null;
  const grouped = listings.reduce<Record<string, PublicListing[]>>((acc, l) => {
    (acc[l.type] = acc[l.type] ?? []).push(l);
    return acc;
  }, {});
  return (
    <>
      <Divider />
      <SectionLabel>{uiText("profile.tabListings")}</SectionLabel>
      <div className="space-y-3">
        {Object.entries(grouped).map(([type, items]) => {
          const meta = LISTING_TYPE_META[type] ?? { label: type, color: "text-text-muted", href: (id: string) => `/${type}/${id}` };
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
                      {l.category && <span className="text-[10px] text-text-primary shrink-0 hidden sm:inline">{["prop","vehicle"].includes(l.type)?marketplaceCategoryLabel(l.category,catalog):l.category}</span>}
                      {l.city && <span className="text-[10px] text-text-primary shrink-0">{l.city}</span>}
                      {l.type !== "animal" && (l.price != null || l.pricing) && (
                        <span className="max-w-full break-words text-[10px] font-semibold text-gold">{listingPriceLabel(l.price,l.pricing,"/Tag",locale,market)}</span>
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
  const t = useTranslations("profileHeader");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={dialogRef} aria-label={t("imageView")} onCancel={onClose}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-black/95 p-4 text-white backdrop:bg-black/80"
      onClick={onClose}>
      <div className="flex h-full w-full items-center justify-center">
        <button type="button" aria-label={t("closeImage")} onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-white hover:bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
          <X size={24} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={t("imageView")}
          className="max-h-[calc(100dvh-5rem)] max-w-full rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()} />
      </div>
    </dialog>
  );
}

// ─── External Profiles Display ───────────────────────────────────────────────

function ExternalProfilesDisplay({ profiles }: { profiles: ExternalProfileRow[] }) {
  const uiText = useTranslations();

  const visible = profiles.filter((p) => p.is_public);
  if (!visible.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
        <p className="text-[10px] uppercase tracking-widest text-gold font-bold">{uiText("Ui.text_08a9689d0d6b13")}</p>
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
          return (
            <a
              key={entry.id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 px-2.5 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-text-secondary hover:border-gold/40 hover:text-gold transition-all group"
            >
              {/* Existing platform initials avoid third-party favicon redirects and preserve the fallback style. */}
              <span className={`text-[10px] font-bold shrink-0 ${plat.textCls}`} aria-hidden="true">{plat.abbr}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{displayName}{entry.custom_label ? uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(entry.custom_label) }) : ""}</span>
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
  title: string | null;
  public_titles: string[];
  is_company_owner: boolean;
  companies: { id: string; slug: string; name: string; logo_url: string | null; categories: string[] | null };
};
type CompanyMemberships = CompanyMembership[] | null;

function CompanyBadge({ membership }: { membership: CompanyMemberships }) {
  const uiText = useTranslations();

  if (!membership?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
        <p className="text-[10px] uppercase tracking-widest text-gold font-bold">{uiText("footer.col3")}</p>
      </div>
      <div className="space-y-2.5">
        {membership.map((entry) => {
          const co = entry.companies;
          const roleLabel = entry.public_titles.join(" · ") || (entry.is_company_owner ? "Inhaber/in" : uiText("Ui.text_46a19d00aadaa0"));
          const categoryLabel = co.categories?.[0]
            ? COMPANY_CATEGORIES.find(c => c.id === co.categories![0])?.label ?? null
            : null;
          return (
            <Link key={entry.id} href={`/companies/${co.slug}`} className="block bg-bg-elevated border border-border rounded-xl overflow-hidden hover:border-gold/40 transition-all group">
              <CompanyLogo src={co.logo_url} name={co.name} className="h-28 w-full" />
              <div className="space-y-1 px-4 py-3 text-center">
                <p className="break-words text-sm font-semibold text-text-primary group-hover:text-gold [overflow-wrap:anywhere]">{co.name}</p>
                {categoryLabel && <p className="text-[11px] text-gold/70">{categoryLabel}</p>}
                <p className="break-words text-xs leading-relaxed text-text-muted [overflow-wrap:anywhere]">{roleLabel}</p>
                <p className="flex items-center justify-center gap-1 pt-1 text-[10px] text-gold/70">{uiText.rich("Ui.text_f797cb26e674d2", { part1: () => (<ExternalLink size={10} />) })}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTOR PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

function ActorProfile({ organizationSection, profile, isOwner, projectCredits, companyMembership, externalProfiles, listings = [], blockStatus = null, collaborations = [], imageLikes = {}, myImageLikes = [] }: { organizationSection?: React.ReactNode; profile: UserProfile; isOwner: boolean; projectCredits: ProjectCredit[]; companyMembership: CompanyMemberships; externalProfiles: ExternalProfileRow[]; listings?: PublicListing[]; blockStatus?: { youBlocked: boolean; theyBlocked: boolean } | null; collaborations?: PublicCollab[]; imageLikes?: Record<string, number>; myImageLikes?: string[] }) {
  const uiText = useTranslations();

  const tc = useTranslations("common");
  const profileText = useTranslations("profile");
  const creatorText = useTranslations("creators");
  const travel = profileTravelValue(profile);
  const canContact = !blockStatus?.youBlocked && !blockStatus?.theyBlocked;
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showAllFilms, setShowAllFilms] = useState(false);
  const [expandedFilm, setExpandedFilm] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (profile.physical ?? {}) as any;
  const roleLabels = displayPositions(profile, getLocalizedProfileTypeLabels(uiText)).map(label => taxonomyLabel(label, uiText));
  const performance = profile.performance ?? {};
  const dialects: string[] = performance.dialects ?? [];
  const drivingLicenses: string[] = performance.driving_licenses ?? [];
  const crewData = profile.crew ?? {};
  const crewEquipment = crewData.equipment_known ?? [];
  const crewSoftware = crewData.software ?? [];
  const crewCertificates = crewData.certificates ?? [];

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
  const memberships: string[] = profile.memberships ?? [];
  const languages = profile.languages ?? [];

  const playingAge = p.playing_age_min || p.playing_age_max
    ? [p.playing_age_min, p.playing_age_max].filter(Boolean).join("–") + " J."
    : null;

  const pContact = profile as unknown as { tiktok_url?: string; vimeo_url?: string; phone?: string; contact_email?: string };
  const socialLinks = ([
    { label: uiText("Ui.text_bad57ef7837c8e"), url: safeLink(profile.instagram_url) },
    { label: uiText("Ui.text_1bb6fcfbf1368a"),    url: safeLink(pContact.tiktok_url) },
    { label: uiText("Ui.text_fb7accfff8c6f8"),   url: safeLink(profile.youtube_url) },
    { label: uiText("Ui.text_a7a93fd1930a61"),     url: safeLink(pContact.vimeo_url) },
    { label: uiText("Ui.text_dd84425b72da12"),  url: safeLink(profile.linkedin_url) },
    { label: uiText("AdminReview.fields.website"),   url: safeLink(profile.website_url), icon: true },
    pContact.phone?.trim()         ? { label: pContact.phone.trim(),         url: `tel:${pContact.phone.trim()}`,             contactIcon: "phone" as const } : null,
    pContact.contact_email?.trim() ? { label: pContact.contact_email.trim(), url: `mailto:${pContact.contact_email.trim()}`, contactIcon: "mail" as const } : null,
  ] as const).filter((l): l is NonNullable<typeof l> & { url: string } => l !== null && !!l.url) as { label: string; url: string; icon?: boolean; contactIcon?: "phone" | "mail" }[];

  return (
    <div className="min-h-screen min-w-0 max-w-full bg-bg-primary text-text-primary [overflow-wrap:anywhere]">
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
                  {/* Blurred fill keeps the source photo visible without cropping the foreground. */}
                  <ResilientPublicImage src={mainShot} alt="" className="absolute inset-0 scale-110 blur-2xl opacity-55" imageClassName="h-full w-full object-cover" />
                  <ResilientPublicImage src={mainShot} alt={profile.display_name ?? ""} className="relative z-10" imageClassName="h-full w-full object-contain object-center" loading="eager" />
                  {profile.verified && (
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">{uiText.rich("Ui.text_df2917b02bd42a", { part1: () => (<Check size={9} />) })}</div>
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
                        ac.weekends    && { label: uiText("Ui.text_fe3dd00105d06a") },
                        ac.night_shoots && { label: uiText("Ui.text_94c1be269db94c") },
                        ac.short_notice && { label: uiText("Ui.text_da452aeb15b5c6") },
                        ac.work_radius_km && { label: uiText("Ui.text_9b0f0d8a886f44", { value1: String(ac.work_radius_km) }) },
                      ].filter(Boolean) as { label: string }[];
                      if (!chips.length) return null;
                      return chips.map((c) => (
                        <span key={c.label} className="px-1.5 py-0.5 rounded-md bg-bg-elevated border border-border text-[10px] text-text-muted font-medium">
                          {c.label}
                        </span>
                      ));
                    })()}
                  </div>
                  <h1 className="min-w-0 max-w-full break-words font-display text-4xl sm:text-5xl font-bold text-text-primary leading-tight tracking-tight [overflow-wrap:anywhere]">
                    {profile.display_name ?? uiText("Ui.text_276ffa1fb4f970")}
                  </h1>
                  <ProfileRoles positions={roleLabels} />
                  {profile.tagline && (
                    <p className="min-w-0 max-w-full break-words text-text-secondary text-sm mt-1 italic [overflow-wrap:anywhere]">
                      {profile.tagline}
                    </p>
                  )}
                  {profile.location && (
                    <p className="min-w-0 max-w-full break-words text-text-muted/60 text-xs mt-1 flex items-center gap-1 [overflow-wrap:anywhere]">
                      <MapPin size={10} /> {profile.location}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:shrink-0 sm:mt-1">
                  {!isOwner ? (
                    <>
                      {canContact && (
                        <>{uiText.rich("Ui.text_6f27c4495b9aa0", { part1: chunks => (<Link href={`/booking?profile=${profile.user_id}`}
                            className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors text-xs">{chunks}</Link>), part3: () => (<MessageSquare size={12} />), part2: chunks => (<Link href={`/messages?to=${profile.user_id}`}
                            className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2 bg-text-primary text-bg-primary font-semibold rounded-lg hover:opacity-90 transition-opacity text-xs">{chunks}</Link>) })}</>
                      )}
                      <BlockReportBar targetId={profile.user_id} initialYouBlocked={blockStatus?.youBlocked ?? false} />
                      <ConnectButton targetUserId={profile.user_id} disabled={!canContact} />
                    </>
                  ) : (
                    <Link href="/profile" className="flex items-center gap-1 text-xs text-text-muted hover:text-gold transition-colors">{uiText.rich("Ui.text_603ead2ae843f0", { part1: () => (<Pencil size={11} />) })}</Link>
                  )}
                </div>
              </div>

              {/* Stats grid — only non-null values */}
              {(playingAge || p.height_cm || p.clothing_size || p.shoe_size || p.hair_color || p.eye_color || languages.length > 0 || dialects.length > 0 || drivingLicenses.length > 0 || p.body_type || profile.day_rate || travel) && (
                <div className="grid grid-cols-3 gap-x-4 gap-y-4 py-5 border-y border-border">
                  {playingAge        && <StatPill label={uiText("creators.filterAge")} value={playingAge} />}
                  {p.height_cm       && <StatPill label={uiText("MarketplaceOffer.fields.size")}      value={`${p.height_cm} cm`} />}
                  {p.clothing_size   && <StatPill label={uiText("Ui.text_4d0a63d41fbd12")} value={p.clothing_size} />}
                  {p.shoe_size       && <StatPill label={uiText("Ui.text_edccd3bba39b7b")} value={p.shoe_size} />}
                  {p.hair_color      && <StatPill label={profileText("castingHair")} value={profileTraitLabel("hair", p.hair_color, profileText)} />}
                  {p.eye_color       && <StatPill label={profileText("castingEyes")} value={profileTraitLabel("eyes", p.eye_color, profileText)} />}
                  {p.body_type       && <StatPill label={profileText("castingBody")} value={profileTraitLabel("body", p.body_type, profileText)} />}
                  {languages.length > 0 && <StatPill label={uiText("profile.sectionLanguages")} value={languages.join(", ")} />}
                  {dialects.length > 0 && <StatPill label={uiText("Ui.text_c36026be4f20c4")} value={dialects.join(", ")} />}
                  {drivingLicenses.length > 0 && <StatPill label={uiText("Ui.text_b64c9c6e5a0fcd")} value={drivingLicenses.join(", ")} />}
                  {profile.day_rate  && <StatPill label={uiText("Ui.text_e43c71342ddc3d")}  value={`${profile.day_rate} €`} />}
                  {travel && <StatPill label={creatorText("filterTravel")} value={profileTraitLabel("travel", travel, profileText)} />}
                </div>
              )}

              {/* Bio */}
              {profile.bio && <ProfileBio value={profile.bio} />}

              {(crewData.experience_years || crewData.department || crewEquipment.length > 0 || crewSoftware.length > 0 || crewCertificates.length > 0) && (
                <div className="rounded-xl border border-border bg-bg-secondary/70 p-4 space-y-3">
                  <SectionLabel>{uiText("Ui.text_55c2ce6e71e4f8")}</SectionLabel>
                  {(crewData.department || crewData.experience_years) && (
                    <div className="flex flex-wrap gap-x-5 gap-y-3">
                      {crewData.department && <StatPill label={uiText("setup.copy78")} value={crewData.department} />}
                      {crewData.experience_years && <StatPill label={uiText("Ui.text_dfe794929179b3")} value={uiText("PageCopy.years", {count: crewData.experience_years})} />}
                    </div>
                  )}
                  {crewEquipment.length > 0 && <p className="text-xs text-text-secondary">{uiText.rich("Ui.text_155eacd9aefbad", { part1: chunks => (<span className="text-text-muted">{chunks}</span>), value2: () => (crewEquipment.join(", ")) })}</p>}
                  {crewSoftware.length > 0 && <p className="text-xs text-text-secondary">{uiText.rich("Ui.text_8c53e376abeba4", { part1: chunks => (<span className="text-text-muted">{chunks}</span>), value2: () => (crewSoftware.join(", ")) })}</p>}
                  {crewCertificates.length > 0 && <p className="text-xs text-text-secondary">{uiText.rich("Ui.text_740514ba7e9c64", { part1: chunks => (<span className="text-text-muted">{chunks}</span>), value2: () => (crewCertificates.join(", ")) })}</p>}
                </div>
              )}


              {/* Company badge */}
              <CompanyBadge membership={companyMembership} />
              {organizationSection}

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
              <ContactSignInPrompt profile={profile} />

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
            <SectionLabel>{uiText("Ui.text_c9a9639463c219")}</SectionLabel>
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
            <SectionLabel>{uiText("Ui.text_1853eb2e9e5ed2")}</SectionLabel>
            <div id="portfolio" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 scroll-mt-24">
              {stripImages.map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer group bg-bg-elevated"
                  onClick={() => setLightbox(img.url)}
                >
                  <ResilientPublicImage
                    src={img.url}
                    alt={img.caption ?? uiText("Ui.text_31b5322f7aaa57", { value1: String(i + 1) })}
                    className="absolute inset-0"
                    imageClassName="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
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
            <SectionLabel>{uiText("profile.sectionFilmography")}</SectionLabel>
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
                        {normType(film.type) && <span>{uiText.rich("Ui.text_c70f2b0c3dd668", { value2: () => (normType(film.type)), part1: chunks => (<span className="text-text-secondary">{chunks}</span>) })}</span>}
                        {film.director && <span>{uiText.rich("Ui.text_31f12dabe7133b", { value2: () => (film.director), part1: chunks => (<span className="text-text-secondary">{chunks}</span>) })}</span>}
                        {film.production && <span>{uiText.rich("Ui.text_325b6b0ece32ff", { value2: () => (film.production), part1: chunks => (<span className="text-text-secondary">{chunks}</span>) })}</span>}
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
                {showAllFilms ? <>{uiText.rich("Ui.text_6a6268d4d5094c", { part1: () => (<ChevronUp size={13} />) })}</> : <>{uiText.rich("Ui.text_d7b90931ebc1ff", { part1: () => (<ChevronDown size={13} />), value2: () => (films.length) })}</>}
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
            const role = c.role?.split("||")[0]?.trim() ?? "";
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
            ...(unmatched.length ? [{ label: uiText("Ui.text_aa61ce5c8994fa"), items: unmatched, isPosition: false }] : []),
          ];
          if (!groups.length) return null;
          return (
            <>
              <Divider />
              <SectionLabel>{uiText("nav.projects")}</SectionLabel>
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
                            {collaborator && <span className="text-[10px] text-text-muted shrink-0 truncate max-w-[35%]">{uiText.rich("Ui.text_67b5a0f0600ce9", { value1: () => (collaborator) })}</span>}
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
            <SectionLabel>{uiText("Ui.text_837be8090856cf")}</SectionLabel>
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
            <SectionLabel>{uiText("Ui.text_f96bf692d5a4c5")}</SectionLabel>
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
            <SectionLabel>{uiText("Ui.text_02edd4a5599ae4")}</SectionLabel>
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

function ModelProfile({ organizationSection, profile, isOwner, projectCredits = [], companyMembership, listings = [], blockStatus = null, collaborations = [] }: { organizationSection?: React.ReactNode; profile: UserProfile; isOwner: boolean; projectCredits?: ProjectCredit[]; companyMembership: CompanyMemberships; listings?: PublicListing[]; blockStatus?: { youBlocked: boolean; theyBlocked: boolean } | null; collaborations?: PublicCollab[] }) {
  const uiText = useTranslations();

  const profileText = useTranslations("profile");
  const canContact = !blockStatus?.youBlocked && !blockStatus?.theyBlocked;
  const [lightbox, setLightbox] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (profile.physical ?? {}) as any;
  const images: ProfileImage[] = profile.profile_images ?? [];
  const heroImg = images.find((i) => i.featured) ?? images[0];
  const mainPhotoUrl = profile.avatar_url ?? heroImg?.url ?? null;
  const galleryImgs = images.filter((image) => image.url !== mainPhotoUrl);
  // Prefer the square profile portrait and use a gallery photo only when no avatar exists.
  const portfolioImages: string[] = (profile as unknown as { portfolio_images?: string[] }).portfolio_images ?? [];
  const resolvedMainPhotoUrl: string | null = mainPhotoUrl ?? portfolioImages[0] ?? null;
  const galleryPhotos: { url: string; caption?: string | null }[] = galleryImgs.length > 0
    ? galleryImgs
    : portfolioImages.filter((url) => url !== resolvedMainPhotoUrl).map((url) => ({ url }));

  const reelUrl = profile.showreel_url ?? profile.reel_url;
  const reelEmbed = reelUrl ? getVideoEmbed(reelUrl) : null;
  const skills: string[] = profile.skills ?? [];
  const memberships: string[] = profile.memberships ?? [];
  const languages = profile.languages ?? [];
  const performance = profile.performance ?? {};
  const roleLabels = displayPositions(profile, getLocalizedProfileTypeLabels(uiText)).map(label => taxonomyLabel(label, uiText));
  const manualFilms: FilmographyEntry[] = profile.filmography ?? [];
  const creditedTitles = new Set(projectCredits.filter((credit) => credit.projects).map((credit) => credit.projects!.title.trim().toLocaleLowerCase("de")));
  const films = manualFilms.filter((film) => film.title?.trim() && !creditedTitles.has(film.title.trim().toLocaleLowerCase("de")));
  const credits = projectCredits.filter((credit) => credit.projects);
  const specialSkills: string[] = performance.special_skills ?? [];
  const playingAge = p.playing_age_min || p.playing_age_max
    ? `${p.playing_age_min ?? "?"}–${p.playing_age_max ?? "?"} J.`
    : null;
  const castingFacts: [string, string | number | null | undefined][] = [
    [uiText("creators.filterAge"), playingAge],
    [uiText("MarketplaceOffer.fields.size"), p.height_cm ? `${p.height_cm} cm` : null],
    [uiText("Ui.text_4d0a63d41fbd12"), p.clothing_size],
    [uiText("Ui.text_edccd3bba39b7b"), p.shoe_size],
    [profileText("castingHair"), p.hair_color ? profileTraitLabel("hair", p.hair_color, profileText) : null],
    [profileText("castingEyes"), p.eye_color ? profileTraitLabel("eyes", p.eye_color, profileText) : null],
    [uiText("profile.sectionLanguages"), languages.length ? languages.join(", ") : null],
    [uiText("Ui.text_c36026be4f20c4"), performance.dialects?.length ? performance.dialects.join(", ") : null],
    [uiText("Ui.text_b64c9c6e5a0fcd"), performance.driving_licenses?.length ? performance.driving_licenses.join(", ") : null],
  ].filter((entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== undefined && entry[1] !== "");

  return (
    <div className="min-h-screen min-w-0 max-w-full bg-bg-primary text-text-primary [overflow-wrap:anywhere]">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      <section className="border-b border-border bg-bg-primary pt-16 sm:pt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5 sm:gap-8 lg:gap-12 items-start">
            <div className="relative mx-auto w-full max-w-[520px] lg:max-w-none">
              <button type="button" onClick={() => resolvedMainPhotoUrl && setLightbox(resolvedMainPhotoUrl)} disabled={!resolvedMainPhotoUrl}
                aria-label={resolvedMainPhotoUrl ? uiText("Ui.text_7418b51c63879f") : undefined}
                className="relative block w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3] max-h-[420px] overflow-hidden rounded-2xl border border-border bg-bg-secondary disabled:cursor-default">
                {resolvedMainPhotoUrl ? (
                  <ResilientPublicImage
                    src={resolvedMainPhotoUrl}
                    alt={profile.display_name ?? ""}
                    className="absolute inset-0"
                    imageClassName="h-full w-full object-cover"
                    loading="eager"
                    style={{ objectPosition: profile.focal_point ? `${profile.focal_point.x}% ${profile.focal_point.y}%` : "50% 38%" }}
                  />
                ) : <span className="flex h-full items-center justify-center font-display text-5xl font-bold text-text-muted/30">{(profile.display_name ?? "?")[0]}</span>}
                {profile.verified && <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white">{uiText.rich("Ui.text_712de43869af36", { part1: () => (<Check size={10} />) })}</span>}
              </button>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 text-xs font-medium ${profile.available ? "text-emerald-400" : "text-text-muted"}`}>
                  <span className={`h-2 w-2 rounded-full ${profile.available ? "bg-emerald-400" : "bg-text-muted"}`} />
                  {profile.available ? uiText("common.available") : uiText("Ui.text_fd1ad60de9424b")}
                </span>
                {profile.verified && <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold text-gold">{uiText("common.verified")}</span>}
                {isOwner && <Link href="/profile" className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-text-secondary hover:border-gold/40 hover:text-gold">{uiText.rich("Ui.text_603ead2ae843f0", { part1: () => (<Pencil size={12} />) })}</Link>}
              </div>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">{profile.display_name ?? uiText("Ui.text_276ffa1fb4f970")}</h1>
                <ProfileRoles positions={roleLabels} />
                {profile.location && <p className="mt-3 flex items-center gap-1.5 text-sm text-text-muted"><MapPin size={13} /> {profile.location}</p>}
                {profile.tagline && <p className="mt-2 text-sm italic text-text-secondary">{cleanProfileBio(profile.tagline)}</p>}
              </div>

              {!isOwner && canContact && <div className="flex flex-wrap gap-2">{uiText.rich("Ui.text_7b21662e97de90", { part2: () => (<ExternalLink size={12} />), part1: chunks => (<Link href={`/booking?profile=${profile.user_id}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-4 text-xs font-semibold text-bg-primary hover:bg-gold-light">{chunks}</Link>), part4: () => (<MessageSquare size={13} />), part3: chunks => (<Link href={`/messages?to=${profile.user_id}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-bg-secondary px-4 text-xs font-medium text-text-primary hover:border-gold/40">{chunks}</Link>), part5: () => (<BlockReportBar targetId={profile.user_id} initialYouBlocked={blockStatus?.youBlocked ?? false} />) })}</div>}

              {castingFacts.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 rounded-xl border border-border bg-bg-secondary p-4 sm:p-5">
                {castingFacts.map(([label, value]) => <StatPill key={label} label={label} value={value} />)}
              </div>}

              {(skills.length > 0 || profile.crew?.experience_years || profile.crew?.equipment_known?.length || profile.crew?.software?.length) && (
                <div className="space-y-3 rounded-xl border border-border bg-bg-secondary/70 p-4">
                  {profile.crew?.experience_years && <StatPill label={uiText("Ui.text_a0c0a3ab95e19a")} value={uiText("PageCopy.years", {count: profile.crew.experience_years})} />}
                  {profile.crew?.equipment_known && profile.crew.equipment_known.length > 0 && <p className="text-xs text-text-secondary">{uiText.rich("Ui.text_155eacd9aefbad", { part1: chunks => (<span className="text-text-muted">{chunks}</span>), value2: () => (profile.crew?.equipment_known?.join(", ")) })}</p>}
                  {profile.crew?.software && profile.crew.software.length > 0 && <p className="text-xs text-text-secondary">{uiText.rich("Ui.text_8c53e376abeba4", { part1: chunks => (<span className="text-text-muted">{chunks}</span>), value2: () => (profile.crew?.software?.join(", ")) })}</p>}
                  {skills.length > 0 && <div className="flex flex-wrap gap-1.5">{skills.slice(0, 8).map((skill) => <span key={skill} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-text-secondary">{skill}</span>)}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── PORTFOLIO GRID ────────────────────────────────────────────── */}
        {galleryPhotos.length > 0 && (
          <>
            <div className="py-14">
              <SectionLabel>{uiText("Ui.text_1853eb2e9e5ed2")}</SectionLabel>
              {/* Masonry-style grid */}
              <div className="columns-2 sm:columns-3 gap-2 sm:gap-3 space-y-2 sm:space-y-3">
                {galleryPhotos.slice(0, 12).map((img, i) => (
                  <div
                    key={i}
                    className="break-inside-avoid cursor-pointer group overflow-hidden rounded-xl"
                    onClick={() => setLightbox(img.url)}
                  >
                    <ResilientPublicImage
                      src={img.url}
                      alt={img.caption ?? uiText("Ui.text_00dd8d76c990bf", { value1: String(i + 1) })}
                      className="w-full break-inside-avoid"
                      imageClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
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
            <SectionLabel>{uiText("Ui.text_d534be829e3219")}</SectionLabel>
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
        {(skills.length > 0 || profile.bio || memberships.length > 0 || specialSkills.length > 0) && (
          <>
            <Divider />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              {profile.bio && <div><SectionLabel>{uiText("Ui.text_3f8ab8360131de")}</SectionLabel><ProfileBio value={profile.bio} /></div>}
              {skills.length > 0 && (
                <div>
                  <SectionLabel>{uiText("Ui.text_05b86932f51fb5")}</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s) => (
                      <span key={s} className="px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {specialSkills.length > 0 && (
                <div>
                  <SectionLabel>{uiText("Ui.text_c85ac0460ca1b0")}</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {specialSkills.map((skill) => <span key={skill} className="px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary">{skill}</span>)}
                  </div>
                </div>
              )}
              {memberships.length > 0 && (
                <div>
                  <SectionLabel>{uiText("Ui.text_f96bf692d5a4c5")}</SectionLabel>
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

        {(credits.length > 0 || films.length > 0) && (
          <>
            <Divider />
            <SectionLabel>{uiText("Ui.text_9620ef01dde01d")}</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-6">
              {credits.map((credit) => (
                <article key={credit.id} className="rounded-xl border border-border bg-bg-secondary p-4">
                  <p className="font-semibold text-sm text-text-primary">{credit.projects!.title}</p>
                  <p className="mt-1 text-xs text-text-muted">{[credit.role, credit.projects!.year, credit.projects!.type].filter(Boolean).join(" · ")}</p>
                </article>
              ))}
              {films.map((film, index) => (
                <article key={`${film.title}-${index}`} className="rounded-xl border border-border bg-bg-secondary p-4">
                  <p className="font-semibold text-sm text-text-primary">{film.title}</p>
                  <p className="mt-1 text-xs text-text-muted">{[film.role, film.year, film.type].filter(Boolean).join(" · ")}</p>
                </article>
              ))}
            </div>
          </>
        )}


        {companyMembership?.length && (
          <>
            <Divider />
            <CompanyBadge membership={companyMembership} />
          </>
        )}

        {organizationSection}

        {(() => {
          const gp = profile as unknown as { tiktok_url?: string; vimeo_url?: string; phone?: string; contact_email?: string };
          const links = ([
            { label: uiText("Ui.text_bad57ef7837c8e"), url: safeLink(profile.instagram_url) },
            { label: uiText("Ui.text_1bb6fcfbf1368a"),    url: safeLink(gp.tiktok_url) },
            { label: uiText("Ui.text_fb7accfff8c6f8"),   url: safeLink(profile.youtube_url) },
            { label: uiText("Ui.text_a7a93fd1930a61"),     url: safeLink(gp.vimeo_url) },
            { label: uiText("Ui.text_dd84425b72da12"),  url: safeLink(profile.linkedin_url) },
            { label: uiText("AdminReview.fields.website"),   url: safeLink(profile.website_url) },
            gp.phone?.trim()         ? { label: gp.phone.trim(),         url: `tel:${gp.phone.trim()}`,             contactIcon: "phone" as const } : null,
            gp.contact_email?.trim() ? { label: gp.contact_email.trim(), url: `mailto:${gp.contact_email.trim()}`, contactIcon: "mail" as const } : null,
          ] as const).filter((l): l is NonNullable<typeof l> & { url: string } => l !== null && !!l.url) as { label: string; url: string; contactIcon?: "phone" | "mail" }[];
          if (links.length === 0 && !profile.contact_requires_sign_in) return null;
          return (
            <>
              <Divider />
              <SectionLabel>{uiText("Ui.text_9024c197d84940")}</SectionLabel>
              {links.length > 0 && <div className="flex flex-wrap gap-2 pb-4">
                  {links.map(({ label, url, contactIcon }) => (
                    <a key={label} href={url!} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
                      {contactIcon === "phone" && <Phone size={11} />}
                      {contactIcon === "mail"  && <Mail size={11} />}
                      {label}
                      {!contactIcon && <ExternalLink size={9} className="opacity-50" />}
                    </a>
                  ))}
                </div>}
              <ContactSignInPrompt profile={profile} />
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

function GenericProfile({ organizationSection, profile, isOwner, projectCredits, companyMembership, externalProfiles, listings = [], blockStatus = null, collaborations = [], imageLikes = {}, myImageLikes = [] }: { organizationSection?: React.ReactNode; profile: UserProfile; isOwner: boolean; projectCredits: ProjectCredit[]; companyMembership: CompanyMemberships; externalProfiles: ExternalProfileRow[]; listings?: PublicListing[]; blockStatus?: { youBlocked: boolean; theyBlocked: boolean } | null; collaborations?: PublicCollab[]; imageLikes?: Record<string, number>; myImageLikes?: string[] }) {
  const uiText = useTranslations();

  const profileText = useTranslations("profile");
  const creatorText = useTranslations("creators");
  const travel = profileTravelValue(profile);
  const tHeader = useTranslations("profileHeader");
  const canContact = !blockStatus?.youBlocked && !blockStatus?.theyBlocked;
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [expandedFilm, setExpandedFilm] = useState<number | null>(null);
  const images: ProfileImage[] = profile.profile_images ?? [];
  const reelUrl = profile.showreel_url ?? profile.reel_url;
  const reelEmbed = reelUrl ? getVideoEmbed(reelUrl) : null;
  const films: FilmographyEntry[] = profile.filmography ?? [];
  const awards: ProfileAward[] = profile.awards ?? [];
  const skills: string[] = profile.skills ?? [];
  const memberships: string[] = profile.memberships ?? [];
  const languages = profile.languages ?? [];
  const certificates: string[] = profile.crew?.certificates ?? [];
  const software: string[] = profile.crew?.software ?? [];
  const bgImage = profile.cover_image_url ?? (images.find((i) => i.featured)?.url);
  const roleLabels = displayPositions(profile, getLocalizedProfileTypeLabels(uiText)).map(label => taxonomyLabel(label, uiText));

  // Filmografie shows only manual entries — linked project credits appear as visual cards in "Projekte"
  const creditTitles = new Set(
    projectCredits.filter((c) => c.projects).map((c) => c.projects!.title.toLowerCase().trim())
  );

  const filmRows: FilmographyEntry[] = films
    .filter((f) => !creditTitles.has(f.title.toLowerCase().trim()))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  return (
    <div className="pt-16 min-h-screen min-w-0 max-w-full bg-bg-primary text-text-primary [overflow-wrap:anywhere]">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* Hero */}
      <section className={`relative isolate flex items-end ${bgImage ? "min-h-[300px] sm:min-h-[340px]" : ""}`}>
        {bgImage ? (
          <>
            <ResilientPublicImage src={bgImage} alt="" className="absolute inset-0" imageClassName="h-full w-full object-cover" imageStyle={profileCoverStyle(profile.focal_point)} loading="eager" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[65px] bg-gradient-to-b from-transparent to-bg-primary" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-bg-elevated to-bg-primary" />
        )}

        <div className={`relative z-10 mx-auto w-full min-w-0 max-w-5xl px-4 sm:px-6 lg:px-8 pb-5 sm:pb-6 ${bgImage ? "pt-40 sm:pt-44" : "pt-6 sm:pt-8"}`}>
          <div className="flex w-fit min-w-0 max-w-[min(100%,36rem)] items-center gap-3 rounded-2xl bg-bg-primary/95 p-3 sm:gap-4 sm:p-4">
            {profile.avatar_url ? (
              <button type="button" onClick={() => setLightbox(profile.avatar_url!)} aria-label={tHeader("openPhoto")}
                className="shrink-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
                <ProfileCardPhoto src={profile.avatar_url ?? ""} name={profile.display_name ?? ""} focalPoint={profile.focal_point} className="h-16 w-16 rounded-xl sm:h-20 sm:w-20" sizes="(max-width: 640px) 64px, 80px" />
              </button>
            ) : (
              <ProfileCardPhoto src={profile.avatar_url ?? ""} name={profile.display_name ?? ""} focalPoint={profile.focal_point} className="h-16 w-16 rounded-xl sm:h-20 sm:w-20" sizes="(max-width: 640px) 64px, 80px" />
            )}
            <div className="flex-1 min-w-0 w-full max-w-full [overflow-wrap:anywhere]">
              <h1 className="min-w-0 max-w-full break-words font-display text-xl sm:text-3xl font-bold tracking-tight text-white leading-tight [overflow-wrap:anywhere]" style={{ textShadow: "0 2px 4px #000, 0 0 22px rgba(0,0,0,0.7)" }}>
                {profile.display_name ?? uiText("Ui.text_276ffa1fb4f970")}
                <span className="block h-0.5 w-12 bg-gold mt-2 rounded-full" />
              </h1>
              {roleLabels[0] && <p className="mt-2 text-sm sm:text-base font-semibold text-gold break-words">{roleLabels[0]}</p>}

            </div>

          </div>
        </div>
      </section>


      <div className="mx-auto w-full min-w-0 max-w-5xl px-4 sm:px-6 lg:px-8 py-4 space-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary">
          {profile.location && <p className="flex min-w-0 items-start gap-1.5 break-words"><MapPin size={14} className="mt-0.5 shrink-0" />{profile.location}</p>}
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${profile.available ? "bg-gold" : "bg-red-400"}`} />
            {tHeader(profile.available ? "available" : "unavailable")}
          </span>
        </div>
        <ProfileRoles positions={roleLabels.slice(1)} secondaryOnly />
            <div className={`flex min-w-0 max-w-full items-center gap-2 flex-wrap ${isOwner ? "sm:shrink-0" : ""}`}>
              {!isOwner ? (
                <>
                  {canContact && (
                    <>
                      <Link href={`/messages?to=${profile.user_id}`}
                        className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2 bg-black/60 backdrop-blur-md border border-white/25 text-white font-medium rounded-lg hover:bg-white/25 transition-colors text-xs">{uiText.rich("Ui.text_e670272347a032", { part1: () => (<MessageSquare size={11} />) })}</Link>
                      <ConnectButton targetUserId={profile.user_id} disabled={!canContact} />
                      <Link href={`/booking?profile=${profile.user_id}`}
                        className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2 bg-black/60 backdrop-blur-md border border-white/25 text-white font-medium rounded-lg hover:bg-white/25 transition-colors text-xs">{uiText.rich("Ui.text_9855da52a3b061", { part1: () => (<ExternalLink size={11} />) })}</Link>
                    </>
                  )}
                  <BlockReportBar targetId={profile.user_id} initialYouBlocked={blockStatus?.youBlocked ?? false} />
                </>
              ) : (
                <Link href="/profile" className="inline-flex min-h-11 items-center gap-1.5 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/20 transition-colors">{uiText.rich("Ui.text_603ead2ae843f0", { part1: () => (<Pencil size={10} />) })}</Link>
              )}
            </div>
      </div>

      <div className="mx-auto w-full min-w-0 max-w-5xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16">

        {/* Only affiliations occupy the sidebar; the portrait appears once in the header. */}
        <div className="grid min-w-0 max-w-full grid-cols-1 md:has-[>aside:not(:empty)]:grid-cols-[200px_minmax(0,1fr)] lg:has-[>aside:not(:empty)]:grid-cols-[220px_minmax(0,1fr)] gap-6 md:gap-8 lg:gap-10 mb-6 sm:mb-10">
          <aside className="min-w-0 max-w-full space-y-6 sm:space-y-8 empty:hidden">
            {(companyMembership?.length ?? 0) > 0 && (
              <CompanyBadge membership={companyMembership} />
            )}
            {organizationSection}
          </aside>

          {/* Compact info */}
          <div className="min-w-0 max-w-full [overflow-wrap:anywhere]">
            <div className="min-w-0 max-w-full space-y-6 sm:space-y-8 [overflow-wrap:anywhere]">

            {profile.bio && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                  <p className="text-[11px] uppercase tracking-widest text-gold font-bold">{uiText("Ui.text_3f8ab8360131de")}</p>
                </div>
                <ProfileBio value={profile.bio} />
              </div>
            )}

            {(languages.length > 0 || profile.day_rate || travel || profile.crew?.experience_years) && (
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-6 gap-y-5">
                {languages.length > 0 && <StatPill label={uiText("profile.sectionLanguages")} value={languages.join(", ")} />}
                {profile.day_rate && <StatPill label={uiText("Ui.text_e43c71342ddc3d")} value={`${profile.day_rate} €`} />}
                {travel && <StatPill label={creatorText("filterTravel")} value={profileTraitLabel("travel", travel, profileText)} />}
                {profile.crew?.experience_years && <StatPill label={uiText("Ui.text_dfe794929179b3")} value={uiText("PageCopy.years", {count: profile.crew.experience_years})} />}
              </div>
            )}

            {skills.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                  <p className="text-[11px] uppercase tracking-widest text-gold font-bold">{uiText("Ui.text_66d0f523a379b2")}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="min-w-0 max-w-full break-words px-2.5 py-1 bg-bg-elevated border border-border rounded-md text-xs text-text-primary hover:border-gold/30 transition-colors [overflow-wrap:anywhere]">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {memberships.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                  <p className="text-[11px] uppercase tracking-widest text-gold font-bold">{uiText("Ui.text_f96bf692d5a4c5")}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {memberships.map((m) => (
                    <span key={m} className="min-w-0 max-w-full whitespace-normal break-words px-2.5 py-1 bg-bg-elevated border border-border rounded-md text-xs text-text-primary hover:border-gold/30 transition-colors">{m}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Links & Kontakt — moved above certificates */}
            {(() => {
              const gp2 = profile as unknown as { tiktok_url?: string; vimeo_url?: string; phone?: string; contact_email?: string };
              const links = ([
                { label: uiText("Ui.text_bad57ef7837c8e"), url: safeLink(profile.instagram_url) },
                { label: uiText("Ui.text_1bb6fcfbf1368a"),    url: safeLink(gp2.tiktok_url) },
                { label: uiText("Ui.text_fb7accfff8c6f8"),   url: safeLink(profile.youtube_url) },
                { label: uiText("Ui.text_a7a93fd1930a61"),     url: safeLink(gp2.vimeo_url) },
                { label: uiText("Ui.text_dd84425b72da12"),  url: safeLink(profile.linkedin_url) },
                { label: uiText("AdminReview.fields.website"),   url: safeLink(profile.website_url) },
                gp2.phone?.trim()         ? { label: gp2.phone.trim(),         url: `tel:${gp2.phone.trim()}`,             contactIcon: "phone" as const } : null,
                gp2.contact_email?.trim() ? { label: gp2.contact_email.trim(), url: `mailto:${gp2.contact_email.trim()}`, contactIcon: "mail" as const } : null,
              ] as const).filter((l): l is NonNullable<typeof l> & { url: string } => l !== null && !!l.url) as { label: string; url: string; contactIcon?: "phone" | "mail" }[];
              if (links.length === 0 && !profile.contact_requires_sign_in) return null;
              return (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                    <p className="text-[11px] uppercase tracking-widest text-gold font-bold">{uiText("Ui.text_2c02f24bb5b437")}</p>
                  </div>
                  {links.length > 0 && <div className="flex flex-wrap gap-1.5">
                      {links.map(({ label, url, contactIcon }) => (
                        <a key={label} href={url!} target="_blank" rel="noopener noreferrer"
                          className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 whitespace-normal break-words px-3 py-2 bg-bg-elevated border border-border rounded-lg text-xs text-text-primary hover:border-gold/40 hover:text-gold transition-colors">
                          {contactIcon === "phone" && <Phone size={11} className="shrink-0" />}
                          {contactIcon === "mail"  && <Mail size={11} className="shrink-0" />}
                          <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
                          {!contactIcon && <ExternalLink size={9} className="shrink-0 opacity-40" />}
                        </a>
                      ))}
                    </div>}
                  <ContactSignInPrompt profile={profile} />
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
                  <p className="text-[11px] uppercase tracking-widest text-gold font-bold">{uiText("Ui.text_9b3289a385a530")}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {software.map((s) => (
                    <span key={s} className="min-w-0 max-w-full whitespace-normal break-words px-2.5 py-1 bg-bg-elevated border border-border rounded-md text-xs text-text-primary">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Lizenzen & Zertifikate */}
            {certificates.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                  <p className="text-[11px] uppercase tracking-widest text-gold font-bold">{uiText("Ui.text_4c730b5fbc3008")}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {certificates.map((c) => (
                    <span key={c} className="min-w-0 max-w-full whitespace-normal break-words px-2.5 py-1 bg-bg-elevated border border-border rounded-md text-xs text-text-primary">{c}</span>
                  ))}
                </div>
              </div>
            )}

            </div>
          </div>
        </div>

        <Divider />

        {/* Projekte — grouped by profile position, rest in Weitere */}
        {projectCredits.filter(c => c.projects).length > 0 && (() => {
          const credits = projectCredits.filter(c => c.projects);
          const positions: string[] = profile.positions ?? [];
          const matched: Record<string, typeof credits> = {};
          const unmatched: typeof credits = [];
          for (const c of credits) {
            const role = c.role?.split("||")[0]?.trim() ?? "";
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
            ...(unmatched.length ? [{ label: uiText("Ui.text_aa61ce5c8994fa"), items: unmatched }] : []),
          ];
          if (!groups.length) return null;
          return (
            <div className="mb-12">
              <SectionLabel>{uiText("nav.projects")}</SectionLabel>
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
                            {collaborator && <span className="text-[10px] text-text-muted shrink-0 truncate max-w-[35%]">{uiText.rich("Ui.text_67b5a0f0600ce9", { value1: () => (collaborator) })}</span>}
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
            <SectionLabel>{uiText("profile.sectionFilmography")}</SectionLabel>
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
                        {normType(film.type) && <span>{uiText.rich("Ui.text_c70f2b0c3dd668", { value2: () => (normType(film.type)), part1: chunks => (<span className="text-text-secondary">{chunks}</span>) })}</span>}
                        {film.director && <span>{uiText.rich("Ui.text_31f12dabe7133b", { value2: () => (film.director), part1: chunks => (<span className="text-text-secondary">{chunks}</span>) })}</span>}
                        {film.production && <span>{uiText.rich("Ui.text_325b6b0ece32ff", { value2: () => (film.production), part1: chunks => (<span className="text-text-secondary">{chunks}</span>) })}</span>}
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
            <SectionLabel>{uiText("Ui.text_3cebfe46876003")}</SectionLabel>
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
              <iframe src={reelEmbed} className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>
        )}

        {/* Awards */}
        {awards.length > 0 && (
          <div className="mb-12">
            <SectionLabel>{uiText("Ui.text_669a46138d69d7")}</SectionLabel>
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16">
          <PhotoGrid images={images} profileId={profile.user_id} isOwner={isOwner} imageLikes={imageLikes} myImageLikes={myImageLikes} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — type-based routing
// ═══════════════════════════════════════════════════════════════════════════════

type PublicListing = { pricing?: import("@/lib/listing-price").ListingPriceMetadata; id: string; type: string; title: string; category: string | null; price: number | null; city: string; image_url: string | null; focal_point?: { x: number; y: number } | null };

// ─── Photo grid with likes ────────────────────────────────────────────────────
type ImageComment = { id: string; author_id: string; author_name: string; author_avatar: string | null; text: string; created_at: string };

function ImageModal({
  image,
  profileId,
  liked,
  likeCount,
  isOwner,
  onClose,
}: {
  image: ProfileImage;
  profileId: string;
  liked: boolean;
  likeCount: number;
  isOwner: boolean;
  onClose: () => void;
}) {
  const uiText = useTranslations();

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
          <ResilientPublicImage src={image.url} alt={image.caption ?? uiText("Ui.text_1a187a67b9a015")} className="h-full min-h-[240px] w-full" imageClassName="h-full max-h-[90vh] w-full object-contain" loading="eager" />
        </div>
        {/* Side panel */}
        <div className="md:w-2/5 flex flex-col max-h-[60vh] md:max-h-[90vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            {image.caption && <p className="text-sm font-medium text-text-primary truncate">{image.caption}</p>}
            <button onClick={onClose} className="text-text-muted hover:text-text-primary ml-2 shrink-0"><X size={18} /></button>
          </div>
          {/* Comments scroll */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {comments.length === 0 && (
              <p className="text-xs text-text-muted text-center py-6">{uiText("Ui.text_cf51eb8e0a722f")}</p>
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
            <PhotoLikeButton profileId={profileId} imageUrl={image.url} initialLiked={liked} initialCount={likeCount} disabled={isOwner} />
            <span className="text-sm font-semibold text-text-primary">{likeCount} {likeCount === 1 ? uiText("Ui.text_45db9ecdfcda3a") : uiText("Ui.text_1d5ef8ac45fcd1")}</span>
          </div>
          {/* Comment input */}
          {isSignedIn && (
            <div className="px-3 pb-3 flex gap-2 border-t border-border pt-3 shrink-0">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void postComment(); } }}
                placeholder={uiText("Ui.text_35fedf20b8d4ec")}
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
  const uiText = useTranslations();

  const [selectedImage, setSelectedImage] = useState<ProfileImage | null>(null);

  const sorted = [...images].sort((a, b) => (imageLikes[b.url] ?? 0) - (imageLikes[a.url] ?? 0));
  const topUrl = sorted[0]?.url;
  const topHasLikes = (imageLikes[topUrl] ?? 0) > 0;

  return (
    <>
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          profileId={profileId}
          liked={myImageLikes.includes(selectedImage.url)}
          likeCount={imageLikes[selectedImage.url] ?? 0}
          isOwner={isOwner}
          onClose={() => setSelectedImage(null)}
        />
      )}
      <div id="portfolio" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 scroll-mt-24">
        {sorted.map((img) => {
          const count = imageLikes[img.url] ?? 0;
          const isTop = img.url === topUrl && topHasLikes;
          return (
            <div key={img.url} className="relative aspect-[4/3] overflow-hidden rounded-xl group border border-border/50 bg-bg-elevated">
              <Link href={photoHref(profileId, img.url)} onClick={markPhotoNavigation} aria-label={uiText("Ui.text_be712cd0e6320b", { value1: String(img.caption ?? "") })} className="absolute inset-0 z-0">
              <ResilientPublicImage src={img.url} alt={img.caption ?? uiText("Ui.text_1a187a67b9a015")} className="absolute inset-0" imageClassName="h-full w-full object-cover transition-all duration-500 group-hover:brightness-110 group-hover:scale-[1.03]" />
              {isTop && (
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-gold/90 rounded-full text-bg-primary text-[10px] font-bold">{uiText("Ui.text_a070b7bbe61286")}</div>
              )}
              </Link>
              <PhotoLikeButton profileId={profileId} imageUrl={img.url} initialCount={count} initialLiked={myImageLikes.includes(img.url)} disabled={isOwner} className="absolute right-2 top-2 z-10" />
            </div>
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
  const uiText = useTranslations();

  if (profiles.length === 0) return null;
  return (
    <section className="border-t border-border bg-bg-secondary py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex min-w-0 max-w-full items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-text-primary">{uiText("Ui.text_d1c117352cd1c3")}</h2>
          <Link href="/creators" className="text-xs text-gold hover:text-gold-light transition-colors font-semibold">{uiText("Ui.text_30cda2e14e0d9a")}</Link>
        </div>
        <div className="flex min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible scrollbar-hide">
          {profiles.map((p) => {
            const city = typeof p.location === "string" ? p.location.split(",")[0]?.trim() : null;
            return (
              <Link
                key={p.user_id}
                href={`/profile/${p.slug}`}
                className="group min-w-0 shrink-0 w-36 sm:w-auto flex flex-col items-center text-center p-3 rounded-xl border border-border bg-bg-elevated hover:border-gold/40 transition-all"
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
                  <p className="text-[10px] text-gold font-semibold mt-1">{uiText.rich("Ui.text_0da218ed73f2db", { value1: () => (p.day_rate) })}</p>
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
  organizationSection,
  similarProfiles = [],
}: {
  profile: UserProfile;
  isOwner: boolean;
  projectCredits?: ProjectCredit[];
  companyMembership?: CompanyMemberships;
  externalProfiles?: ExternalProfileRow[];
  listings?: PublicListing[];
  blockStatus?: { youBlocked: boolean; theyBlocked: boolean } | null;
  collaborations?: PublicCollab[];
  imageLikes?: Record<string, number>;
  myImageLikes?: string[];
  similarProfiles?: SimilarProfile[];
  organizationSection?: React.ReactNode;
}) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const activeViewerId = isLoaded ? user?.id ?? null : null;
  const effectiveOwner = isOwner && (!isLoaded || user?.id === profile.user_id);
  const previousViewerId = useRef<string | null | undefined>(undefined);

  // Clerk synchronizes session changes between tabs. Refresh the server payload
  // on account changes and derive contact visibility from the live session so
  // owner/member-only contacts disappear immediately after sign-out.
  useEffect(() => {
    if (!isLoaded) return;
    const previous = previousViewerId.current;
    previousViewerId.current = activeViewerId;
    if (previous !== undefined && previous !== activeViewerId) router.refresh();
  }, [activeViewerId, isLoaded, router]);

  const phoneVisibility = profile.visibility?.phone ?? "hidden";
  const emailVisibility = profile.visibility?.contact_email ?? "hidden";
  const canSeePhone = phoneVisibility === "public" || (phoneVisibility === "members" && !!activeViewerId) || effectiveOwner;
  const canSeeEmail = emailVisibility === "public" || (emailVisibility === "members" && !!activeViewerId) || effectiveOwner;
  const visibleProfile: UserProfile = {
    ...profile,
    phone: canSeePhone ? profile.phone ?? null : null,
    contact_email: canSeeEmail ? profile.contact_email ?? null : null,
    contact_requires_sign_in: Boolean(!activeViewerId && (
      (profile.phone && !canSeePhone) || (profile.contact_email && !canSeeEmail)
    )),
  };

  const profileTypes = normalizeProfileTypes(visibleProfile.profile_types, visibleProfile.profile_type);
  const isModel = profileTypes.includes("model");
  const isTalent = profileTypes.some((type) => PROFILE_CATEGORY_MAP[type] === "talent");

  const similarSection = !effectiveOwner && similarProfiles.length > 0
    ? <SimilarProfilesSection profiles={similarProfiles} />
    : null;

  // Model types get editorial layout
  if (isModel) {
    return <><ModelProfile organizationSection={organizationSection} profile={visibleProfile} isOwner={effectiveOwner} projectCredits={projectCredits} companyMembership={companyMembership} listings={listings} blockStatus={blockStatus} collaborations={collaborations} />{similarSection}</>;
  }

  // Actor/talent types get casting-ready layout
  if (isTalent) {
    return <><ActorProfile organizationSection={organizationSection} profile={visibleProfile} isOwner={effectiveOwner} projectCredits={projectCredits} companyMembership={companyMembership} externalProfiles={externalProfiles} listings={listings} blockStatus={blockStatus} collaborations={collaborations} imageLikes={imageLikes} myImageLikes={myImageLikes} />{similarSection}</>;
  }

  // Crew, creative, vendor get generic layout
  return <><GenericProfile organizationSection={organizationSection} profile={visibleProfile} isOwner={effectiveOwner} projectCredits={projectCredits} companyMembership={companyMembership} externalProfiles={externalProfiles} listings={listings} blockStatus={blockStatus} collaborations={collaborations} imageLikes={imageLikes} myImageLikes={myImageLikes} />{similarSection}</>;
}
