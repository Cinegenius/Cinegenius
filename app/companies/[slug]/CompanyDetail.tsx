"use client";
import ResponsiblePersonCard from "@/components/ResponsiblePersonCard";
import type { PublicResponsiblePerson } from "@/lib/responsible-person-server";

import { useEffect, useRef, useState } from "react";
import FloatingPanel from "@/components/FloatingPanel";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useGallerySelection } from "@/lib/use-gallery-selection";
import {
  MapPin, Globe, Mail, Phone, CheckCircle,
  Package, Briefcase, Car, Home, Clapperboard, X,
  Pencil, Users, UserPlus, Clock, Check,
  Crown, ChevronRight, ExternalLink, MoreHorizontal,
  Calendar, Scale, Globe2, Quote, MessageSquare,
} from "lucide-react";
import { COMPANY_CATEGORY_BY_ID } from "@/lib/companyCategories";
import { AnimalCompanySummary } from "@/components/AnimalCompanyFields";
import { normalizeAnimalCompanyDetails, isAnimalCompany, animalCategoryLabel } from "@/lib/animal-taxonomy";
import { CATERING_COMPANY_CATEGORY, normalizeCateringCompanyDetails } from "@/lib/catering-taxonomy";
import {
  EQUIPMENT_CATEGORY_BY_ID, CONDITION_LABELS, CONDITION_COLORS, SERVICE_TYPE_BY_ID,
} from "@/lib/equipment-categories";
import { COMPANY_PUBLIC_TITLE_SUGGESTIONS, normalizeCompanyPublicTitles } from "@/lib/company-roles";
import MediaImage from "@/components/MediaImage";
import CompanyLogo from "@/components/CompanyLogo";
import Lightbox from "@/components/Lightbox";
import { listingDetailPath } from "@/lib/listing-routes";

type Listing = {
  id: string;
  title: string;
  type: string;
  category: string | null;
  price: number;
  city: string;
  image_url: string | null;
  created_at: string;
};

type MemberProfile = {
  user_id?: string;
  display_name: string;
  avatar_url: string | null;
  slug: string | null;
  role: string | null;
} | null;

type Member = {
  id: string;
  title: string | null;
  public_titles?: string[];
  is_company_owner?: boolean;
  status: string;
  created_at: string;
  request_message?: string;
  profile: MemberProfile;
};

type ServiceItem = {
  id: string; type: string; title: string; description: string | null;
  use_cases: string[]; price_on_request: boolean; price_note: string | null;
};

type EquipmentItem = {
  id: string; category: string; subcategory: string | null; name: string;
  brand: string | null; model: string | null; condition: string; available: boolean;
  price_day: number | null; price_week: number | null; price_on_request: boolean;
  pickup_available: boolean; delivery_available: boolean; insured: boolean; quantity: number;
};

type Company = {
  responsible?: PublicResponsiblePerson | null;
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  cover_url?: string | null;
  description: string;
  bio_short: string | null;
  tagline: string | null;
  usp: string | null;
  founded_year: number | null;
  legal_form: string | null;
  hq_address: string | null;
  countries: string[];
  industry_focus: string[];
  city: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  email_public?: boolean;
  phone_public?: boolean;
  hq_address_public?: boolean;
  contact_requires_sign_in?: boolean;
  categories: string[];
  services: string[];
  catering_details?: unknown;
  animal_details?: unknown;
  portfolio_images: string[];
  social_links: Record<string, string> | null;
  verified: boolean;
  published?: boolean;
  created_at: string;
};

const listingTypeIcons: Record<string, React.ElementType> = {
  job: Briefcase, prop: Package, vehicle: Car, location: Home, service: Clapperboard,
};
const listingTypeLabel: Record<string, string> = {
  job: "Job", prop: "Requisite", vehicle: "Fahrzeug", location: "Location", service: "Service",
};


export default function CompanyDetail({
  company, listings, members, services, equipment, myMembership, myTitleChangeRequest, currentUserId: initialUserId, initialIsOwner,
}: {
  company: Company;
  listings: Listing[];
  members: Member[];
  services: ServiceItem[];
  equipment: EquipmentItem[];
  myMembership: { id: string; status: string; role?: string; title?: string | null; public_titles?: string[] } | null;
  myTitleChangeRequest: { id: string; status: string; created_at: string } | null;
  currentUserId: string | null;
  initialIsOwner: boolean;
}) {
  const { user, isLoaded } = useUser();
  const messageText = useTranslations("companyMessages");
  const animals = useTranslations("FilmAnimals");
  const currentUserId = isLoaded ? user?.id ?? null : initialUserId;
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [companyPublished, setCompanyPublished] = useState(company.published !== false);
  const [publishingCompany, setPublishingCompany] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [lightboxIdx, setLightboxIdx] = useGallerySelection(company.portfolio_images);

  const isOwner = initialIsOwner && !!initialUserId && currentUserId === initialUserId;
  const cats = company.categories.map((id) => COMPANY_CATEGORY_BY_ID[id]).filter(Boolean);
  const cateringDetails = normalizeCateringCompanyDetails(company.catering_details);
  const offersCatering = company.categories.includes(CATERING_COMPANY_CATEGORY.id);

  const [localMembers, setLocalMembers] = useState<Member[]>(members);
  const [localMembership, setLocalMembership] = useState(myMembership);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinDialogMode, setJoinDialogMode] = useState<"join" | "title_change" | null>(null);
  const membershipDialogRef = useRef<HTMLElement | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [membershipError, setMembershipError] = useState("");
  const [membershipSuccess, setMembershipSuccess] = useState("");
  const [joinTitles, setJoinTitles] = useState<string[]>([]);
  const [joinCustomTitle, setJoinCustomTitle] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [titleChangeRequest, setTitleChangeRequest] = useState(myTitleChangeRequest);

  useEffect(() => {
    if (isLoaded && currentUserId !== initialUserId) {
      setLocalMembership(null);
      setTitleChangeRequest(null);
      setJoinDialogMode(null);
      setMembershipSuccess("");
    }
  }, [currentUserId, initialUserId, isLoaded]);
  const [showAllTeam, setShowAllTeam] = useState(false);
  const canEditCompany = isOwner || (localMembership?.status === "accepted" && ["admin", "editor", "manager"].includes(localMembership.role ?? ""));

  useEffect(() => {
    if (!joinDialogMode) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    membershipDialogRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, [joinDialogMode]);

  const acceptedMembers = localMembers.filter((m) => m.status === "accepted");
  const managementMembers = acceptedMembers.filter((m) => m.is_company_owner);
  const regularMembers = acceptedMembers.filter((m) => !m.is_company_owner);

  function selectedJoinTitles() {
    return normalizeCompanyPublicTitles([...joinTitles, ...joinCustomTitle.split(",")]);
  }

  function openJoinForm(mode: "join" | "title_change" = "join") {
    const existingTitles = mode === "title_change"
      ? normalizeCompanyPublicTitles(localMembership?.public_titles?.length ? localMembership.public_titles : localMembership?.title)
      : [];
    setJoinTitles(existingTitles.filter((title) => COMPANY_PUBLIC_TITLE_SUGGESTIONS.includes(title as (typeof COMPANY_PUBLIC_TITLE_SUGGESTIONS)[number])));
    setJoinCustomTitle(existingTitles.filter((title) => !COMPANY_PUBLIC_TITLE_SUGGESTIONS.includes(title as (typeof COMPANY_PUBLIC_TITLE_SUGGESTIONS)[number])).join(", "));
    setJoinMessage("");
    setJoinError("");
    setJoinDialogMode(mode);
    setActionMenuOpen(false);
  }

  function toggleJoinTitle(title: string) {
    if (!joinTitles.includes(title) && joinTitles.length + normalizeCompanyPublicTitles(joinCustomTitle.split(",")).length >= 5) {
      setJoinError("Du kannst bis zu fünf Funktionen angeben.");
      return;
    }
    setJoinError("");
    setJoinTitles((current) => current.includes(title)
      ? current.filter((item) => item !== title)
      : normalizeCompanyPublicTitles([...current, title]));
  }

  async function handleSubmitMembershipAction() {
    const public_titles = selectedJoinTitles();
    if (!public_titles.length) {
      setJoinError("Wähle mindestens eine Funktion aus oder gib eine eigene Bezeichnung ein.");
      return;
    }
    if (joinDialogMode === "title_change" && !localMembership) return;
    setJoining(true); setJoinError("");
    try {
      const response = joinDialogMode === "title_change"
        ? await fetch("/api/company-member-title-change-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ member_id: localMembership!.id, public_titles, message: joinMessage }),
          })
        : await fetch("/api/company-members", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company_id: company.id, public_titles, message: joinMessage }),
          });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Deine Anfrage konnte nicht gesendet werden.");
      if (joinDialogMode === "title_change") setTitleChangeRequest(result.data);
      else setLocalMembership({ id: result.data.id, status: result.data.status });
      setJoinDialogMode(null);
      setMembershipSuccess(joinDialogMode === "title_change"
        ? "Funktionsänderung angefragt – die Bestätigung durch die Firma steht aus."
        : "Anfrage gesendet – Bestätigung durch die Firma ausstehend.");
    } catch (cause: unknown) {
      setJoinError(cause instanceof Error ? cause.message : "Deine Anfrage konnte nicht gesendet werden.");
    } finally {
      setJoining(false);
    }
  }

  async function withdrawTitleChangeRequest() {
    if (!titleChangeRequest) return;
    setWithdrawing(true); setMembershipError(""); setMembershipSuccess("");
    try {
      const response = await fetch(`/api/company-member-title-change-requests?id=${encodeURIComponent(titleChangeRequest.id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Die Anfrage konnte nicht zurückgezogen werden.");
      setTitleChangeRequest(null);
      setMembershipSuccess("Deine Funktionsänderungsanfrage wurde zurückgezogen.");
    } catch (cause) {
      setMembershipError(cause instanceof Error ? cause.message : "Die Anfrage konnte nicht zurückgezogen werden.");
    } finally { setWithdrawing(false); }
  }

  async function handleLeave() {
    if (!localMembership) return;
    setWithdrawing(true);
    setMembershipError("");
    setMembershipSuccess("");
    try {
      const res = await fetch(`/api/company-members?id=${encodeURIComponent(localMembership.id)}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Die Anfrage konnte nicht zurückgezogen werden. Bitte lade die Seite neu und versuche es erneut.");
      setLocalMembership(null);
      setLocalMembers((current) => current.filter((member) => member.id !== localMembership.id));
      setJoinDialogMode(null);
      setMembershipSuccess(localMembership.status === "pending"
        ? "Deine Beitrittsanfrage wurde zurückgezogen."
        : "Du hast die Firma verlassen.");
    } catch (cause) {
      setMembershipError(cause instanceof Error ? cause.message : "Die Anfrage konnte nicht zurückgezogen werden.");
    } finally {
      setWithdrawing(false);
    }
  }

  async function publishCompany() {
    setPublishingCompany(true);
    setPublishError("");
    try {
      const response = await fetch(`/api/companies/${company.slug}/publish`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Veröffentlichung fehlgeschlagen.");
      setCompanyPublished(true);
    } catch (cause) {
      setPublishError(cause instanceof Error ? cause.message : "Veröffentlichung fehlgeschlagen.");
    } finally {
      setPublishingCompany(false);
    }
  }

  return (
    <div className="pt-16 min-h-screen min-w-0 max-w-full bg-bg-primary text-text-primary [overflow-wrap:anywhere]">

      {isWelcome && !welcomeDismissed && (
        <div className="bg-gold/10 border-b border-gold/20">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gold flex items-center gap-2"><CheckCircle size={14} /> Firmenprofil erstellt!</span>
            <button onClick={() => setWelcomeDismissed(true)}><X size={14} className="text-gold/50 hover:text-gold" /></button>
          </div>
        </div>
      )}

      {isOwner && !companyPublished && (
        <div className="border-b border-gold/20 bg-gold/10">
          <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div><p className="text-sm font-semibold text-gold">Bisher privater Firmenentwurf</p><p className="mt-1 text-xs text-text-muted">Dieses ältere Profil ist noch privat. Wenn du es im Formular speicherst, wird es automatisch öffentlich. Du kannst es auch direkt hier veröffentlichen.</p>{publishError && <p role="alert" className="mt-2 text-xs text-red-300">{publishError}</p>}</div>
            <button onClick={() => void publishCompany()} disabled={publishingCompany} className="min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary disabled:opacity-60">{publishingCompany ? "Wird veröffentlicht …" : "Jetzt öffentlich anzeigen"}</button>
          </div>
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-bg-elevated to-bg-primary">
          {company.cover_url && <img src={company.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
          <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/60 via-bg-primary/75 to-bg-primary" />
        </div>

        <div className="relative z-10 mx-auto w-full min-w-0 max-w-4xl px-4 sm:px-6 pt-10 pb-8 sm:pb-10">

          {/* Logo + Name */}
          <div className="flex min-w-0 max-w-full flex-col items-start gap-5 sm:flex-row sm:gap-6 mb-6">
            <CompanyLogo src={company.logo_url} name={company.name}
              className="h-36 w-full sm:h-40 sm:w-64 sm:shrink-0" />

            {/* Name + tagline */}
            <div className="flex-1 min-w-0 pt-0.5">
              {cats.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {cats.map((cat) => (
                    <span key={cat.id} className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full border ${cat.bg} ${cat.color}`}>
                      {animalCategoryLabel(cat.id, cat.label, animals)}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex min-w-0 max-w-full items-center gap-2 flex-wrap">
                <h1 className="min-w-0 max-w-full break-words font-display text-2xl sm:text-3xl font-bold text-text-primary leading-tight [overflow-wrap:anywhere]">
                  {company.name}
                </h1>
                {company.verified && (
                  <CheckCircle size={15} className="text-gold shrink-0" />
                )}
              </div>

              {company.tagline && (
                <p className="min-w-0 max-w-full break-words text-text-muted text-sm mt-1 leading-snug [overflow-wrap:anywhere]">{company.tagline}</p>
              )}
            </div>
          </div>

          {canEditCompany && (
            <Link href={`/company-setup?company_id=${company.id}`}
              className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-bg-primary/60 px-3 py-2 text-xs text-text-secondary hover:border-gold/40 hover:text-gold">
              <Pencil size={13} /> Bearbeiten
            </Link>
          )}

          {/* Industry focus */}
          {company.industry_focus?.length > 0 && (
            <p className="min-w-0 max-w-full break-words text-xs text-text-muted mb-4 leading-relaxed [overflow-wrap:anywhere]">
              {company.industry_focus.join(" · ")}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted mb-6">
            <span className="flex items-center gap-1.5"><MapPin size={11} />{company.city}</span>
            {acceptedMembers.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Users size={11} /> {acceptedMembers.length} {acceptedMembers.length === 1 ? "Person" : "Personen"}
              </span>
            )}
            {company.founded_year && (
              <span className="flex items-center gap-1.5">
                <Calendar size={11} /> Seit {company.founded_year}
              </span>
            )}
          </div>

          {/* CTA buttons */}
          <div className="flex min-w-0 max-w-full flex-wrap gap-2">
            {company.email && (
              <a href={`mailto:${company.email}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors text-xs">
                <Mail size={13} /> E-Mail schreiben
              </a>
            )}
            {!isOwner && <Link href={`/companies/${encodeURIComponent(company.slug)}/message`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-4 py-2 text-xs text-text-secondary transition-colors hover:border-gold/40 hover:text-gold">
              <MessageSquare size={14} /> {currentUserId ? messageText("send") : messageText("signIn")}
            </Link>}
            {company.phone && (
              <a href={`tel:${company.phone}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-border bg-bg-elevated rounded-lg text-xs text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
                <Phone size={13} /> {company.phone}
              </a>
            )}
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-w-0 max-w-full items-center gap-1.5 whitespace-normal break-words px-4 py-2 border border-border bg-bg-elevated rounded-lg text-xs text-text-secondary hover:border-gold/40 hover:text-gold transition-colors [overflow-wrap:anywhere]">
                <Globe size={13} /> {company.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
            {company.contact_requires_sign_in && !currentUserId && (
              <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/companies/${company.slug}`)}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-4 py-2 text-xs text-text-secondary hover:border-gold/40 hover:text-gold">
                <Mail size={13} /> Anmelden, um Kontakt aufzunehmen
              </Link>
            )}
            {!isOwner && (
              <div className="relative">
                <button ref={actionMenuTriggerRef} type="button" aria-expanded={actionMenuOpen} aria-controls="company-membership-actions-menu"
                  onClick={() => setActionMenuOpen((open) => !open)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs text-text-secondary transition-colors hover:border-gold/40 hover:text-gold">
                  <MoreHorizontal size={14} /> Weitere Aktionen
                </button>
                {actionMenuOpen && (
                  <FloatingPanel anchorRef={actionMenuTriggerRef} onClose={() => setActionMenuOpen(false)} width={288} id="company-membership-actions-menu" label="Weitere Firmenaktionen" className="rounded-xl border border-border bg-bg-secondary p-2 shadow-2xl">
                    {!currentUserId ? (
                      <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/companies/${company.slug}`)}`}
                        className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-elevated">
                        Anmelden, um Firmenzugehörigkeit anzufragen
                      </Link>
                    ) : !localMembership ? (
                      <button type="button" onClick={() => openJoinForm("join")}
                        className="flex min-h-11 w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-elevated">
                        Firmenzugehörigkeit anfragen
                      </button>
                    ) : localMembership.status === "pending" ? (
                      <div className="space-y-1">
                        <p className="px-3 py-2 text-xs leading-relaxed text-text-muted">Anfrage gesendet – Bestätigung durch die Firma ausstehend.</p>
                        <button type="button" onClick={() => void handleLeave()} disabled={withdrawing}
                          className="flex min-h-11 w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-elevated disabled:opacity-50">
                          {withdrawing ? "Wird zurückgezogen …" : "Anfrage zurückziehen"}
                        </button>
                      </div>
                    ) : titleChangeRequest?.status === "pending" ? (
                      <div className="space-y-1">
                        <p className="px-3 py-2 text-xs leading-relaxed text-text-muted">Funktionsänderung ausstehend. Deine bestätigte Funktion bleibt bis zur Freigabe bestehen.</p>
                        <button type="button" onClick={() => void withdrawTitleChangeRequest()} disabled={withdrawing}
                          className="flex min-h-11 w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-elevated disabled:opacity-50">
                          {withdrawing ? "Wird zurückgezogen …" : "Anfrage zurückziehen"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={() => openJoinForm("title_change")}
                          className="flex min-h-11 w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-elevated">
                          Funktion ändern anfragen
                        </button>
                        <button type="button" onClick={() => void handleLeave()} disabled={withdrawing}
                          className="flex min-h-11 w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-elevated disabled:opacity-50">
                          {withdrawing ? "Wird beendet …" : "Firma verlassen"}
                        </button>
                      </>
                    )}
                  </FloatingPanel>
                )}
              </div>
            )}
            {currentUserId && !isOwner && localMembership?.status === "pending" && (
              <p role="status" className="w-full text-xs text-amber-400"><Clock size={11} className="mr-1 inline" />Anfrage gesendet – Bestätigung durch die Firma ausstehend.</p>
            )}
            {membershipError && <p role="alert" className="w-full text-xs text-crimson-light">{membershipError}</p>}
            {membershipSuccess && <p role="status" className="w-full text-xs text-success">{membershipSuccess}</p>}
            {currentUserId && !isOwner && localMembership?.status === "accepted" && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-success flex items-center gap-1.5"><CheckCircle size={11} /> Du bist Teammitglied</span>
              </div>
            )}
          </div>

          {joinDialogMode && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-primary/80 p-4 backdrop-blur-sm" onClick={() => !joining && setJoinDialogMode(null)}>
              <section role="dialog" aria-modal="true" aria-labelledby="company-membership-dialog-title"
                ref={membershipDialogRef} tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !joining) { setJoinDialogMode(null); return; }
                  if (event.key !== "Tab") return;
                  const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]');
                  const first = focusable[0]; const last = focusable[focusable.length - 1];
                  if (!first || !last) return;
                  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
                  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                }}
                className="max-h-[min(90dvh,720px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-bg-secondary p-5 shadow-2xl sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="company-membership-dialog-title" className="font-display text-xl font-bold text-text-primary">
                      {joinDialogMode === "join" ? "Firmenzugehörigkeit anfragen" : "Funktion ändern anfragen"}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted">
                      {joinDialogMode === "join"
                        ? "Du arbeitest bereits für diese Firma? Frage hier die Verknüpfung mit deinem Profil an. Das ist keine Bewerbung auf einen Job."
                        : "Bitte die Firma darum, deine öffentliche Funktion im Teamprofil zu ändern. Bis zur Bestätigung bleibt deine bisherige Funktion sichtbar."}
                    </p>
                  </div>
                  <button type="button" aria-label="Dialog schließen" onClick={() => !joining && setJoinDialogMode(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-bg-elevated hover:text-text-primary"><X size={16} /></button>
                </div>
                <p className="mt-3 rounded-lg border border-border bg-bg-primary/60 p-3 text-xs leading-relaxed text-text-muted">
                  Die Angaben erscheinen erst nach der Bestätigung durch die Firma öffentlich. Öffentliche Funktionen vergeben keine Verwaltungsrechte. Ohne zuständige Firmenverwaltung wird nichts automatisch freigegeben; zur Klärung erreichst du uns unter <a className="text-gold underline underline-offset-2" href="mailto:cinegenius.co@gmail.com">cinegenius.co@gmail.com</a>.
                </p>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium text-text-secondary">Welche Funktion(en) hast du? Wähle bis zu fünf.</p>
                    <div className="flex flex-wrap gap-2">
                      {COMPANY_PUBLIC_TITLE_SUGGESTIONS.map((title) => {
                        const selected = joinTitles.includes(title);
                        return <button key={title} type="button" aria-pressed={selected} onClick={() => toggleJoinTitle(title)}
                          className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-xs transition-colors ${selected ? "border-gold/50 bg-gold/10 text-gold" : "border-border bg-bg-elevated text-text-secondary hover:border-gold/40"}`}>
                          {selected && <Check size={12} />} {title}
                        </button>;
                      })}
                    </div>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-text-secondary">Weitere Berufsbezeichnung(en) (optional, mehrere mit Komma trennen)</span>
                    <input value={joinCustomTitle} onChange={(event) => { setJoinCustomTitle(event.target.value); setJoinError(""); }} maxLength={400} disabled={joinTitles.length >= 5}
                      placeholder="z. B. Catering-Leitung oder Oberbeleuchter/in"
                      className="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-gold/50 focus:outline-none disabled:opacity-50" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-text-secondary">Nachricht an die Firma (optional)</span>
                    <textarea value={joinMessage} onChange={(event) => setJoinMessage(event.target.value)} maxLength={500} rows={3}
                      placeholder="Zum Beispiel: Seit wann du für die Firma arbeitest."
                      className="w-full resize-y rounded-lg border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-gold/50 focus:outline-none" />
                    <span className="block text-right text-[11px] text-text-muted">{joinMessage.length}/500</span>
                  </label>
                  {joinError && <p role="alert" className="text-xs text-crimson-light">{joinError}</p>}
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                    <button type="button" onClick={() => setJoinDialogMode(null)} disabled={joining} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary hover:bg-bg-elevated disabled:opacity-50">Abbrechen</button>
                    <button type="button" onClick={() => void handleSubmitMembershipAction()} disabled={joining}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-semibold text-bg-primary transition-colors hover:bg-gold-light disabled:opacity-50">
                      <UserPlus size={14} /> {joining ? "Wird gesendet …" : "Anfrage senden"}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

        </div>
      </section>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full min-w-0 max-w-4xl px-4 py-10">
        <div className="grid min-w-0 max-w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-10">

          {/* ── LEFT ──────────────────────────────────────────────────── */}
          <div className="space-y-10 min-w-0">

            {/* About */}
            <ResponsiblePersonCard person={company.responsible} />
            {(company.bio_short || company.description || company.usp) && (
              <section>
                <SectionLabel>Über das Unternehmen</SectionLabel>
                <div className="space-y-4">
                  {company.bio_short && (
                    <p className="text-sm text-text-primary leading-relaxed font-medium">
                      {company.bio_short}
                    </p>
                  )}
                  {company.usp && (
                    <div className="flex gap-3 p-4 bg-gold/5 border-l-2 border-gold rounded-r-xl">
                      <Quote size={16} className="text-gold shrink-0 mt-0.5" />
                      <p className="text-sm text-text-secondary leading-relaxed italic">{company.usp}</p>
                    </div>
                  )}
                  {company.description && (
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {company.description}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Team */}
            {(acceptedMembers.length > 0 || isOwner) && (
              <section>
                <SectionLabel>Team ({acceptedMembers.length})</SectionLabel>
                <div className="space-y-4">

                  {/* Management */}
                  {managementMembers.length > 0 && (
                    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                      <div className="px-5 py-2.5 border-b border-border bg-bg-elevated flex items-center gap-2">
                        <Crown size={10} className="text-gold" />
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-gold">Inhaberschaft</span>
                      </div>
                      <div className="grid min-w-0 divide-y divide-border">
                        {managementMembers.map((member) => <CompanyPersonCard key={member.id} member={member} />)}
                      </div>
                    </div>
                  )}

                  {/* Team */}
                  {regularMembers.length > 0 && (
                    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                      <div className="px-5 py-2.5 border-b border-border bg-bg-elevated flex items-center gap-2">
                        <Users size={10} className="text-text-muted" />
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">Team</span>
                      </div>
                      <div className="grid min-w-0 divide-y divide-border">
                        {(showAllTeam ? regularMembers : regularMembers.slice(0, 10)).map((member) => <CompanyPersonCard key={member.id} member={member} />)}
                      </div>
                      {regularMembers.length > 10 && (
                        <button
                          onClick={() => setShowAllTeam((v) => !v)}
                          className="w-full px-5 py-3 border-t border-border bg-bg-secondary hover:bg-bg-elevated text-xs text-text-muted hover:text-gold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Users size={11} />
                          {showAllTeam ? "Weniger anzeigen" : `Alle ${regularMembers.length} Teammitglieder anzeigen`}
                        </button>
                      )}
                    </div>
                  )}
                </div>

              </section>
            )}

            {/* Portfolio */}
            {company.portfolio_images.length > 0 && (
              <section>
                <SectionLabel>Portfolio</SectionLabel>
                <div className="grid grid-cols-3 gap-2">
                  {company.portfolio_images.slice(0, 9).map((url, i) => (
                    <button key={url} onClick={() => setLightboxIdx(i)}
                      className="aspect-square rounded-xl overflow-hidden bg-bg-elevated hover:opacity-85 transition-opacity relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {i === 8 && company.portfolio_images.length > 9 && (
                        <div className="absolute inset-0 bg-bg-primary/60 flex items-center justify-center">
                          <span className="text-sm font-bold text-text-primary">+{company.portfolio_images.length - 9}</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {lightboxIdx !== null && (
                  <Lightbox
                    images={company.portfolio_images}
                    activeIndex={lightboxIdx}
                    onClose={() => setLightboxIdx(null)}
                    onPrev={() => setLightboxIdx((i) => i !== null ? (i - 1 + company.portfolio_images.length) % company.portfolio_images.length : 0)}
                    onNext={() => setLightboxIdx((i) => i !== null ? (i + 1) % company.portfolio_images.length : 0)}
                  />
                )}
              </section>
            )}

            {/* Services */}
            {services.length > 0 && (
              <section>
                <SectionLabel>Services ({services.length})</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((svc) => (
                    <div key={svc.id} className="p-4 bg-bg-secondary border border-border rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-text-muted px-2 py-0.5 bg-bg-elevated border border-border rounded-full">
                          {SERVICE_TYPE_BY_ID[svc.type]?.label ?? svc.type}
                        </span>
                        {!svc.price_on_request && svc.price_note && (
                          <span className="text-[10px] text-gold">{svc.price_note}</span>
                        )}
                        {svc.price_on_request && (
                          <span className="text-[10px] text-text-muted">Preis auf Anfrage</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-text-primary mb-1">{svc.title}</p>
                      {svc.description && (
                        <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{svc.description}</p>
                      )}
                      {svc.use_cases?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {svc.use_cases.map((u) => (
                            <span key={u} className="text-[10px] px-2 py-0.5 bg-bg-elevated border border-border rounded-full text-text-muted">{u}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Equipment */}
            {equipment.length > 0 && (
              <section>
                <SectionLabel>Equipment ({equipment.length})</SectionLabel>
                <div className="space-y-2">
                  {equipment.slice(0, 12).map((item) => {
                    const cat = EQUIPMENT_CATEGORY_BY_ID[item.category];
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                        <span className="text-lg shrink-0">{cat?.emoji ?? "📦"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-text-primary truncate">{item.name}</p>
                            {item.brand && <span className="text-xs text-text-muted">{item.brand}{item.model ? ` ${item.model}` : ""}</span>}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CONDITION_COLORS[item.condition]}`}>
                              {CONDITION_LABELS[item.condition]}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
                            {cat && <span>{animalCategoryLabel(cat.id, cat.label, animals)}</span>}
                            {item.subcategory && <span>· {item.subcategory}</span>}
                            {item.quantity > 1 && <span>· {item.quantity}×</span>}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {!item.price_on_request && item.price_day ? (
                            <p className="text-sm font-semibold text-gold">{item.price_day} €<span className="text-text-muted font-normal text-xs">/Tag</span></p>
                          ) : (
                            <p className="text-xs text-text-muted">Auf Anfrage</p>
                          )}
                          <p className={`text-[10px] mt-0.5 ${item.available ? "text-emerald-400" : "text-text-muted"}`}>
                            {item.available ? "Verfügbar" : "Nicht verfügbar"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {equipment.length > 12 && (
                    <p className="text-xs text-text-muted pt-1">+ {equipment.length - 12} weitere — für vollständige Liste anfragen</p>
                  )}
                </div>
              </section>
            )}

            {/* Listings */}
            {listings.length > 0 && (
              <section>
                <SectionLabel>Inserate ({listings.length})</SectionLabel>
                <div className="divide-y divide-border">
                  {listings.map((listing) => {
                    const Icon = listingTypeIcons[listing.type] ?? Package;
                    const href = listingDetailPath(listing.type, listing.id, company.slug) ?? `/companies/${company.slug}`;
                    return (
                      <Link key={listing.id} href={href}
                        className="flex items-center gap-3 py-3 group -mx-1 px-1 rounded-lg hover:bg-bg-secondary/60 transition-colors">
                        {listing.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <MediaImage src={listing.image_url} width={40} height={40} alt={listing.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          : <div className="w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0"><Icon size={16} className="text-text-muted" /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary group-hover:text-gold transition-colors truncate">{listing.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5">
                            <span>{listing.type === "animal" ? animals("portfolio") : listingTypeLabel[listing.type] ?? listing.type}</span>
                            <span>·</span>
                            <span>{listing.city}</span>
                            {listing.type !== "animal" && listing.price > 0 && <><span>·</span><span className="text-gold">{listing.price} €</span></>}
                          </div>
                        </div>
                        <ChevronRight size={13} className="text-text-muted shrink-0 group-hover:text-gold transition-colors" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

          </div>

          {/* ── RIGHT ─────────────────────────────────────────────────── */}
          <div className="space-y-8">

            {/* Social links */}
            {company.social_links && Object.values(company.social_links).some(Boolean) && (
              <section>
                <SectionLabel>Social Media</SectionLabel>
                <div className="space-y-1.5">
                  {(
                    [
                      { key: "instagram", label: "Instagram" },
                      { key: "linkedin",  label: "LinkedIn" },
                      { key: "youtube",   label: "YouTube" },
                      { key: "vimeo",     label: "Vimeo" },
                      { key: "tiktok",    label: "TikTok" },
                      { key: "facebook",  label: "Facebook" },
                    ] as const
                  )
                    .filter(({ key }) => company.social_links?.[key]?.trim())
                    .map(({ key, label }) => (
                      <a
                        key={key}
                        href={company.social_links![key]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 w-full px-3 py-2 bg-bg-secondary border border-border rounded-lg text-xs text-text-secondary hover:border-gold/40 hover:text-gold transition-colors group"
                      >
                        <span className="font-medium flex-1">{label}</span>
                        <ExternalLink size={10} className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                </div>
              </section>
            )}

            {/* Firmendaten */}
            {(company.founded_year || company.legal_form || company.hq_address || company.countries?.length > 0) && (
              <section>
                <SectionLabel>Firmendaten</SectionLabel>
                <div className="space-y-2 text-xs text-text-secondary">
                  {company.founded_year && (
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-text-muted shrink-0" />
                      <span>Gegründet {company.founded_year}</span>
                    </div>
                  )}
                  {company.legal_form && (
                    <div className="flex items-center gap-2">
                      <Scale size={12} className="text-text-muted shrink-0" />
                      <span>{company.legal_form}</span>
                    </div>
                  )}
                  {company.hq_address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={12} className="text-text-muted shrink-0 mt-0.5" />
                      <span>{company.hq_address}</span>
                    </div>
                  )}
                  {company.countries?.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Globe2 size={12} className="text-text-muted shrink-0 mt-0.5" />
                      <span>{company.countries.join(", ")}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Services keywords */}
            {isAnimalCompany(company.categories) && <section className="space-y-4"><AnimalCompanySummary value={normalizeAnimalCompanyDetails(company.animal_details)} />{isOwner && <Link href={`/inserat?animal=1&company_id=${company.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm text-gold">{animals("addPortfolio")}</Link>}<p className="text-xs leading-5 text-text-muted">{animals("portfolioHelp")}</p></section>}
            {company.services.length > 0 && (
              <section>
                <SectionLabel>Leistungen</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {company.services.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-bg-secondary border border-border text-xs text-text-secondary rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {offersCatering && (cateringDetails.serviceTypes.length > 0 || cateringDetails.serviceAreas || cateringDetails.capacity || cateringDetails.dietaryOptions.length > 0 || cateringDetails.mobileEquipment.length > 0) && (
              <section className="space-y-3 rounded-2xl border border-orange-300/20 bg-orange-300/[0.04] p-4 sm:p-5">
                <SectionLabel>Catering / Setverpflegung</SectionLabel>
                {cateringDetails.serviceTypes.length > 0 && <DetailLine label="Leistungen" value={cateringDetails.serviceTypes.join(", ")} />}
                {cateringDetails.serviceAreas && <DetailLine label="Einsatzregion" value={cateringDetails.serviceAreas} />}
                {cateringDetails.capacity && <DetailLine label="Kapazität" value={`Bis zu ${cateringDetails.capacity} Personen`} />}
                {cateringDetails.dietaryOptions.length > 0 && <DetailLine label="Ernährungsangebote" value={cateringDetails.dietaryOptions.join(", ")} />}
                {cateringDetails.mobileEquipment.length > 0 && <DetailLine label="Mobile Ausstattung" value={cateringDetails.mobileEquipment.join(", ")} />}
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function DetailLine({ label, value }: { label: string; value: string }) {
  return <p className="break-words text-sm leading-6 text-text-secondary"><span className="font-medium text-text-primary">{label}: </span>{value}</p>;
}

function CompanyPersonCard({ member }: { member: Member }) {
  const name = member.profile?.display_name || "Teammitglied";
  const destination = member.profile?.slug || member.profile?.user_id;
  const titles = member.public_titles?.filter(Boolean).join(" · ") || member.title || (member.is_company_owner ? "Inhaber/in" : "Teammitglied");
  const content = <>
    <Avatar member={member} size={32} />
    <div className="min-w-0 flex-1 space-y-0.5">
      <p className="break-words text-sm font-semibold leading-snug text-text-primary group-hover:text-gold [overflow-wrap:anywhere]">{name}</p>
      <p className="break-words text-xs leading-relaxed text-text-secondary [overflow-wrap:anywhere]">{titles}</p>
    </div>
  </>;
  const classes = "group flex min-w-0 items-start gap-3 px-4 py-3 sm:px-5";
  return destination
    ? <Link href={`/profile/${encodeURIComponent(destination)}`} className={`${classes} transition-colors hover:bg-bg-elevated`}>{content}</Link>
    : <div className={classes}>{content}</div>;
}

function Avatar({ member, size = 40 }: { member: Member; size?: number }) {
  const name = member.profile?.display_name ?? "?";
  return (
    <div className="rounded-full bg-bg-elevated border border-border overflow-hidden shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, minWidth: size }}>
      {member.profile?.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={member.profile.avatar_url} alt={name} className="w-full h-full object-cover" />
        : <span className="text-xs font-bold text-text-muted">{name[0]?.toUpperCase()}</span>
      }
    </div>
  );
}
