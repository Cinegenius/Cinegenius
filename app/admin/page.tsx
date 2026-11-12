"use client";
import OfferModerationStatus from "@/components/OfferModerationStatus";
import { viewRecord, writeViewRecord } from "@/lib/navigation-context";
import { OFFER_STATUSES } from "@/lib/offer-moderation";
import AdminReviewLink from "@/components/admin/AdminReviewLink";
import { reportReviewPath } from "@/lib/admin-review";
import ResponsiblePersonAdmin from "@/components/ResponsiblePersonAdmin";
import type { StoredResponsiblePerson } from "@/lib/responsible-person";

import { useAuth } from "@clerk/nextjs";
import { localizedMarketplaceDepartments } from "@/lib/marketplaceCategories";
import { useTranslations , useLocale } from "next-intl";
import { useViewState } from "@/lib/use-view-state";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ServerAdminContext } from "@/lib/server-admin-context";
import { useAdminSupportUnread } from "@/lib/use-admin-support-unread";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import Image from "@/components/MediaImage";
import {
  Activity, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, ClipboardList, Clapperboard, CreditCard, Eye, FileImage,
  LayoutDashboard, List, MessageSquareText, Search, Shield, ShieldCheck, Users, X,
} from "lucide-react";
import { SupportMessageAction } from "@/components/admin/SupportMessageAction";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { confirmDialog, promptDialog, dismissNativeDialog } from "@/lib/native-dialog";

const AdminSupportCenter = dynamic(() => import("@/components/admin/AdminSupportCenter").then(module => module.AdminSupportCenter));
const AdminReviewQueue = dynamic(() => import("@/components/admin/AdminReviewQueue"));
const AdminAccounts = dynamic(() => import("@/components/admin/AdminAccounts").then(module => module.AdminAccounts));
const AdminStartedOffers = dynamic(() => import("@/components/admin/AdminStartedOffers").then(module => module.AdminStartedOffers));
const AdminNewsletter = dynamic(() => import("@/components/admin/AdminNewsletter").then(module => module.AdminNewsletter));
const AdminOrganizations = dynamic(() => import("@/components/admin/AdminOrganizations").then(module => module.AdminOrganizations));

type TabId = "reviews" | "overview" | "reports" | "verifications" | "users" | "accounts" | "started-offers" | "companies" | "organizations" | "listings" | "projects" | "bookings" | "media" | "support" | "newsletter" | "audit";


type Listing = { moderation_status?: string; moderation_reason?: string | null; responsible_person?: StoredResponsiblePerson | null; id: string; user_id: string | null; company_id: string | null; company_slug: string | null; type: string; title: string; city: string | null; price: number | null; priceLabel?: string; published: boolean; created_at: string; provider_name: string; provider_href: string | null; provider_image: string | null; provider_missing: boolean; detail_href: string | null };
type AdminProfile = { user_id: string; display_name: string | null; slug: string | null; location: string | null; avatar_url: string | null; profile_types: string[] | null; verified: boolean; verification_revision: number; created_at: string; tagline: string | null };
type AdminProject = { id: string; title: string; year: number | null; type: string | null; verified: boolean; created_at: string; director: string | null; crew_count: number };
type AdminCredit = { id: string; project_id: string; user_id: string | null; unclaimed_profile_id: string | null; role: string; created_at: string; name: string; type: "user" | "ghost" };
type Report = { id: string; reporter_id: string; reporter_name: string | null; target_type: string; target_id: string; target_name: string | null; target_href: string | null; target_excerpt: string | null; reason: string; details: string | null; status: string; created_at: string };
type Verification = { id: string; user_id: string; display_name: string | null; status: string; notes: string | null; submitted_at: string; reviewed_at: string | null; review_version: number; profile_revision: number | null; profile_verified: boolean | null; review_reason: string | null; has_document: boolean };
type Company = { responsible_person?: StoredResponsiblePerson | null; id: string; slug: string; owner_user_id: string; owner_name: string | null; owner_profile_missing: boolean; name: string; logo_url: string | null; city: string; categories: string[]; services: string[]; verified: boolean; published: boolean; created_at: string; member_count: number; pending_request_count: number };
type Clarification = { id: string; company_id: string; user_id: string; title: string | null; public_titles: string[]; request_message: string; created_at: string; company_name: string; company_slug: string; owner_user_id: string; requester_name: string | null; owner_name: string | null };
type Booking = { id: string; ref: string; user_id: string; listing_id: string | null; listing_title: string; listing_type: string; start_date: string; end_date: string; days: number; daily_rate: number; subtotal: number; platform_fee: number; total: number; status: string; created_at: string; requester_name: string | null };
type MediaEntity = { id: string; title: string; slug: string | null; published: string | boolean | null; media: string[] };
type AuditEntry = { id: string; actor_user_id: string; action: string; entity_type: string; entity_id: string; reason: string; outcome: string; metadata: Record<string, unknown>; created_at: string };
type Overview = { counts: Record<string, number>; recentListings: Listing[] };

const typeLabels: Record<string, string> = {
  location: "Location", prop: "Equipment / Requisite", vehicle: "Fahrzeug", job: "Job",
  creator: "Crew / Talent", service: "Dienstleistung", animal: "Tiere",
};




function getLocalizedReasonLabels(translate: (key: string) => string): Record<string, string> { return ({
  spam: translate("Ui.text_94a9eac404c8c6"), harassment: translate("Ui.text_0392938fdb775e"), fake_profile: translate("Ui.text_b33fd3ef4fad87"),
  inappropriate_content: translate("Ui.text_3a6f6d61b35e21"), scam: translate("Ui.text_496b9838531d2f"), underage: translate("Ui.text_e9941ca87c7720"), other: translate("profile.typeOther"),
}); }

function getLocalizedNavItems(translate: (key: string) => string): { icon: typeof LayoutDashboard; label: string; id: TabId }[] {
  return ([
  { icon: LayoutDashboard, label: translate("nav.accountOverview"), id: "overview" },
  { icon: Eye, label: "", id: "reviews" },
  { icon: ClipboardList, label: translate("Ui.text_e6a6654d1758fd"), id: "reports" },
  { icon: ShieldCheck, label: translate("Ui.text_cf2a3edd7e38e8"), id: "verifications" },
  { icon: Users, label: translate("Places.areas.profiles"), id: "users" },
  { icon: Users, label: "", id: "accounts" },
  { icon: List, label: "", id: "started-offers" },
  { icon: Building2, label: translate("nav.companies"), id: "companies" },
  { icon: CalendarDays, label: "", id: "organizations" },
  { icon: List, label: translate("profile.tabListings"), id: "listings" },
  { icon: Clapperboard, label: translate("nav.projects"), id: "projects" },
  { icon: CreditCard, label: translate("Ui.text_e78c4c0deca6a1"), id: "bookings" },
  { icon: FileImage, label: translate("Ui.text_32f875e643fb71"), id: "media" },
  { icon: MessageSquareText, label: translate("Ui.text_be91940b79f469"), id: "support" },
  { icon: MessageSquareText, label: "", id: "newsletter" },
  { icon: Activity, label: translate("Ui.text_75c5b10d955fc7"), id: "audit" },
]);
}

async function fetchJson<T>(translate: (key: string, values?: Record<string, string | number>) => string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? translate("Ui.text_25e275cb765703", { value1: String(response.status) }));
  return body as T;
}

function adminReason(translate: (key: string, values?: Record<string, string | number>) => string, label: string): Promise<string | null> {
  return promptDialog({
    message: translate("Ui.text_4e08a632d52cde", { value1: String(label) }),
    confirmLabel: translate("profile.save"), cancelLabel: translate("home.boardCancel"),
    minLength: 5, maxLength: 500, validationMessage: translate("Ui.text_5a74d7bcf38f7d"),
  });
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-bg-secondary ${className}`}>{children}</section>;
}

function VerificationDecision({ title, optional, saving, onSave, onCancel }: { title: string; optional: boolean; saving: boolean; onSave: (reason: string) => void; onCancel: () => void }) {
  const t = useTranslations("VerificationReview");
  const [reason, setReason] = useState("");
  const validReason = reason.trim().length >= 5 || optional && reason.trim().length === 0;
  const fieldId = "verification-decision-reason";
  return <form onSubmit={event => { event.preventDefault(); onSave(reason.trim()); }} className="mt-4 w-full min-w-0 rounded-xl border border-gold/30 bg-bg-primary p-4">
    <h3 className="break-words text-sm font-semibold text-text-primary [overflow-wrap:anywhere]">{title}</h3>
    <label htmlFor={fieldId} className="mt-3 block text-sm text-text-secondary">{t(optional ? "reasonOptional" : "reason")}</label>
    <p id="verification-reason-notice" className="mt-1 text-xs leading-5 text-text-muted">{t("reasonVisible")}</p>
    <textarea id={fieldId} aria-describedby="verification-reason-notice" autoFocus value={reason} onChange={event => setReason(event.target.value)} required={!optional} minLength={5} maxLength={500} rows={3} disabled={saving} className="mt-2 w-full rounded-lg border border-border bg-bg-secondary p-3 text-base text-text-primary" />
    <div className="mt-3 flex flex-wrap gap-2"><button type="submit" disabled={saving || !validReason} className="inline-flex min-h-11 items-center rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-bg-primary disabled:opacity-40">{t(saving ? "saving" : "save")}</button><button type="button" disabled={saving} onClick={onCancel} className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary">{t("cancel")}</button></div>
  </form>;
}

function Empty({ title, detail }: { title: string; detail?: string }) {
  return <div className="rounded-xl border border-dashed border-border py-14 px-5 text-center"><p className="font-semibold text-text-primary">{title}</p>{detail && <p className="mt-1 text-sm text-text-muted">{detail}</p>}</div>;
}

function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const uiText = useTranslations();

  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-crimson/30 bg-crimson/10 px-4 py-3 text-sm text-crimson-light"><span>{text}</span>{onRetry && <button onClick={onRetry} className="rounded-lg border border-crimson/30 px-3 py-1.5 text-xs font-semibold">{uiText("FormDraft.reload")}</button>}</div>;
}

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const uiText = useTranslations();

  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages < 2) return null;
  return <div className="flex items-center justify-between gap-3 pt-2"><button onClick={() => onPage(page - 1)} disabled={page <= 1} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary disabled:opacity-40">{uiText.rich("Ui.text_3c9cbf8b79d036", { part1: () => (<ChevronLeft size={13} />) })}</button><span className="text-xs text-text-muted">{uiText.rich("Ui.text_715f960af986a8", { value1: () => (page), value2: () => (pages), value3: () => (total) })}</span><button onClick={() => onPage(page + 1)} disabled={page >= pages} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary disabled:opacity-40">{uiText.rich("Ui.text_71f09a8b7c811b", { part1: () => (<ChevronRight size={13} />) })}</button></div>;
}

function StatusBadge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "success" | "warning" | "danger" }) {
  const styles = {
    muted: "border-border bg-bg-elevated text-text-muted",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-gold/30 bg-gold/10 text-gold",
    danger: "border-crimson/30 bg-crimson/10 text-crimson-light",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles[tone]}`}>{children}</span>;
}

type ProviderOption = { id: string; kind: "person" | "company"; label: string; detail: string; imageUrl: string | null };

function ListingProviderControls({ listing, onSaved, onError }: { listing: Listing; onSaved: () => void; onError: (message: string) => void }) {
  const uiText = useTranslations();

  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<"person" | "company">("person");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!editing || search.trim().length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetchJson<{ results: ProviderOption[] }>(uiText, `/api/admin/listing-providers?type=${kind}&q=${encodeURIComponent(search.trim())}`, { signal: controller.signal })
        .then((data) => setResults(data.results))
        .catch((error: Error) => { if (error.name !== "AbortError") onErrorRef.current(uiErrorMessage(error, uiText("System.requestFailed"))); })
        .finally(() => setLoading(false));
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [editing, kind, search]);

  async function choose(option: ProviderOption) {
    const reason = await adminReason(uiText, uiText("Ui.text_5c42b727708a10", { value1: String(listing.title), value2: String(option.label) }));
    if (!reason) return;
    setSaving(true);
    try {
      await fetchJson(uiText, "/api/admin/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: listing.id, providerType: option.kind, providerId: option.id, reason }) });
      setEditing(false);
      setSearch("");
      onSaved();
    } catch (error) { onErrorRef.current(uiErrorMessage(error, uiText("System.requestFailed"))); }
    finally { setSaving(false); }
  }

  return <div className="mt-3 rounded-lg border border-border bg-bg-primary/60 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <ResponsiblePersonAdmin person={listing.responsible_person} />
      <p className="min-w-0 text-xs text-text-secondary">{uiText.rich("Ui.text_c84554a48878b8", { value1: () => (listing.provider_href ? <a href={listing.provider_href} target="_blank" rel="noreferrer" className="font-medium text-gold hover:underline">{listing.provider_name}</a> : <span className={listing.provider_missing ? "font-semibold text-gold" : "font-medium text-text-primary"}>{listing.provider_name}</span>) })}</p>
      {listing.provider_missing && <StatusBadge tone="warning">{uiText("Ui.text_17653ddc11b35c")}</StatusBadge>}
      <button onClick={() => setEditing((value) => !value)} className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-text-secondary hover:border-gold hover:text-gold">{editing ? uiText("ProfilePhotoCrop.close") : listing.provider_missing ? uiText("Ui.text_f5c35c177722f1") : uiText("Ui.text_31ab0ec51b979f")}</button>
    </div>
    {listing.company_id && listing.user_id && <p className="mt-2 break-all text-[10px] text-text-muted">{uiText.rich("Ui.text_f7a6927f267546", { value1: () => (listing.user_id) })}</p>}
    {editing && <div className="mt-3 space-y-2">
      <p className="text-xs text-text-muted">{uiText("Ui.text_a7b337792028b3")}</p>
      <div className="flex gap-2"><button onClick={() => { setKind("person"); setSearch(""); }} className={`min-h-10 rounded-lg border px-3 text-xs ${kind === "person" ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{uiText("Ui.text_6007db63e18e53")}</button><button onClick={() => { setKind("company"); setSearch(""); }} className={`min-h-10 rounded-lg border px-3 text-xs ${kind === "company" ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{uiText("AdminReview.types.company")}</button></div>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={kind === "person" ? uiText("Ui.text_f3b3c3c285a16f") : uiText("Ui.text_c4f5380f3a36d2")} className="min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary" />
      {search.trim().length >= 2 && <div className="max-h-56 overflow-y-auto rounded-lg border border-border">{loading ? <p className="p-3 text-xs text-text-muted">{uiText("Ui.text_1cf9923f82f453")}</p> : !results.length ? <p className="p-3 text-xs text-text-muted">{uiText("Ui.text_aea9f82a2a4b4f")}</p> : results.map((option) => <button key={option.id} disabled={saving} onClick={() => void choose(option)} className="flex min-h-12 w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-bg-elevated disabled:opacity-50"><span className="min-w-0 flex-1"><span className="block truncate text-sm text-text-primary">{option.label}</span><span className="block truncate text-[11px] text-text-muted">{option.detail}</span></span><span className="shrink-0 text-[11px] text-gold">{saving ? uiText("Ui.text_4f696a99f9c9e4") : uiText("Organizations.choose")}</span></button>)}</div>}
    </div>}
  </div>;
}

function AdminContent() {
  useEffect(() => () => dismissNativeDialog(), []);
  const uiText = useTranslations();
  const reasonLabels = getLocalizedReasonLabels(uiText);

  const uiOptionLabels: Record<string, string> = {
    "Profile": uiText("Places.areas.profiles"),
    "Firmen": uiText("nav.companies"),
    "Inserate gesamt": uiText("Ui.text_1170ed335f7d39"),
    "Locations": uiText("nav.locations"),
    "Jobs": uiText("nav.jobs"),
    "Crew / Talent": uiText("AdminAccounts.contentKinds.creator"),
    "Marktplatz": uiText("nav.marketplace"),
    "Tiere": uiText("Ui.text_d9609c949e931a"),
    "Dienstleistungen": uiText("Ui.text_1db29b1e6b8f6c"),
    "Projekte": uiText("nav.projects"),
    "Aktuelle Aushänge": uiText("Ui.text_d2439a7b9e5dd8"),
    "Buchungsanfragen": uiText("Ui.text_e78c4c0deca6a1"),
    "Bewertungen": uiText("Ui.text_2049ad4dc9cbba"),
    "Bewerbungen": uiText("Ui.text_8d6d3b0d06c978"),
  };







  const navItems = getLocalizedNavItems(uiText);

  const uiLocale = useLocale();

  const { userId: reviewUserId } = useAuth();
  const reviewOwner = useContext(ServerAdminContext);
  const supportUnread = useAdminSupportUnread(reviewOwner);
  const supportText = useTranslations("SupportContact");
  const { leave: leaveAdminTab } = useFormNavigation();
  const market=useTranslations("MarketplaceOffer"),catalog=useTranslations("MarketplaceCatalog");
  const marketDepartments=localizedMarketplaceDepartments(catalog);
  const [listingDepartment,setListingDepartment]=useState("");
  const [listingSubcategory,setListingSubcategory]=useState("");
  const reviewT = useTranslations("AdminReview");
  const moderation = useTranslations("OfferModeration");
  const accountsText = useTranslations("AdminAccounts");
  const startedText = useTranslations("AdminStartedOffers");
  const organizationAdminText = useTranslations("AdminOrganizations");
  const [activeTab, setActiveTab] = useViewState<TabId>("admin.activeTab", "overview");
  useEffect(() => {
    const restoreSupportLink = () => {
      const params = new URL(window.location.href).searchParams;
      const tab = params.get("tab");
      if (params.has("supportThread")) setActiveTab("support");
      else if (tab && getLocalizedNavItems(key => key).some(item => item.id === tab)) setActiveTab(tab as TabId);
      else if (!tab) setActiveTab("overview");
    };
    restoreSupportLink();
    window.addEventListener("popstate", restoreSupportLink);
    return () => window.removeEventListener("popstate", restoreSupportLink);
  }, [setActiveTab]);
  const selectAdminTab = (id: TabId) => leaveAdminTab(() => {
    if (id === activeTab) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    url.searchParams.delete("supportThread");
    window.history.pushState(window.history.state, "", url.pathname + url.search + url.hash);
    setActiveTab(id);
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [listingsPage, setListingsPage] = useViewState("admin.listingsPage", 1);
  const [listingsSearch, setListingsSearch] = useViewState("admin.listingsSearch", "");
  const [listingsType, setListingsType] = useViewState("admin.listingsType", "all");
  const [listingsStatus, setListingsStatus] = useViewState("admin.listingsStatus", "all");
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");

  const [reports, setReports] = useState<Report[]>([]);
  const [reportsStatus, setReportsStatus] = useViewState("admin.reportsStatus", "pending");
  const [reportsPage, setReportsPage] = useViewState("admin.reportsPage", 1);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");

  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [verificationsLoading, setVerificationsLoading] = useState(false);
  const [verificationsError, setVerificationsError] = useState("");
  const [verificationsTotal, setVerificationsTotal] = useState(0);
  const [verificationsPage, setVerificationsPage] = useViewState("admin.verificationsPage", 1);
  const [verificationActing, setVerificationActing] = useState<string | null>(null);
  const [verificationsStatus, setVerificationsStatus] = useViewState("admin.verificationsStatus", "pending");
  const [verificationDecision, setVerificationDecision] = useState<{ kind: "request"; request: Verification; action: "approve" | "reject" } | { kind: "profile"; profile: AdminProfile; verified: boolean } | null>(null);
  const verificationLock = useRef(false);
  const verificationText = useTranslations("VerificationReview");

  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [profilesTotal, setProfilesTotal] = useState(0);
  const [profilesPage, setProfilesPage] = useViewState("admin.profilesPage", 1);
  const [profilesSearch, setProfilesSearch] = useViewState("admin.profilesSearch", "");
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState("");
  const [profileActing, setProfileActing] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesTotal, setCompaniesTotal] = useState(0);
  const [companiesPage, setCompaniesPage] = useViewState("admin.companiesPage", 1);
  const [companiesSearch, setCompaniesSearch] = useViewState("admin.companiesSearch", "");
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState("");
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [clarificationsTotal, setClarificationsTotal] = useState(0);
  const [clarificationsPage, setClarificationsPage] = useViewState("admin.clarificationsPage", 1);
  const [clarificationsError, setClarificationsError] = useState("");

  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [projectsPage, setProjectsPage] = useViewState("admin.projectsPage", 1);
  const [projectsSearch, setProjectsSearch] = useViewState("admin.projectsSearch", "");
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [projectActing, setProjectActing] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useViewState<string | null>("admin.expandedProject", null);
  const [credits, setCredits] = useState<Record<string, AdminCredit[]>>({});
  const [creditsLoading, setCreditsLoading] = useState<string | null>(null);
  const [creditsPage, setCreditsPage] = useViewState("admin.creditsPage", 1);
  const [creditsTotal, setCreditsTotal] = useState(0);
  const [editingCredit, setEditingCredit] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState("");
  const [creditActing, setCreditActing] = useState<string | null>(null);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsPage, setBookingsPage] = useViewState("admin.bookingsPage", 1);
  const [bookingsStatus, setBookingsStatus] = useViewState("admin.bookingsStatus", "all");
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  const [mediaEntities, setMediaEntities] = useState<MediaEntity[]>([]);
  const [mediaType, setMediaType] = useViewState("admin.mediaType", "profiles");
  const [mediaPage, setMediaPage] = useViewState("admin.mediaPage", 1);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [mediaChecks, setMediaChecks] = useState<Record<string, { status: string; message?: string; httpStatus?: number; contentType?: string }>>({});
  const [mediaChecking, setMediaChecking] = useState<string | null>(null);

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditPage, setAuditPage] = useViewState("admin.auditPage", 1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");

  const overviewRequest = useRef(0);
  const loadOverview = useCallback((signal = new AbortController().signal) => {
    const sequence = ++overviewRequest.current;
    setOverviewLoading(true);
    setOverviewError("");
    fetchJson<Overview>(uiText, "/api/admin/overview", { signal })
      .then(data => { if (!signal.aborted && sequence === overviewRequest.current) setOverview(data); })
      .catch((error: Error) => { if (!signal.aborted && sequence === overviewRequest.current) setOverviewError(uiErrorMessage(error, uiText("System.requestFailed"))); })
      .finally(() => { if (!signal.aborted && sequence === overviewRequest.current) setOverviewLoading(false); });
  }, []);

  const loadAttention = useCallback((signal = new AbortController().signal) => {
    return fetchJson<{ counts: Record<string, number> }>(uiText, "/api/admin/overview?summary=attention", { signal })
      .then(({ counts }) => { if (!signal.aborted) setOverview(current => ({ counts: { ...current?.counts, ...counts }, recentListings: current?.recentListings ?? [] })); })
      .catch(() => { /* The active section has its own visible error and retry handling. */ });
  }, []);
  const needsAttention = activeTab !== "overview";
  useEffect(() => {
    if (!needsAttention) return;
    const controller = new AbortController();
    void loadAttention(controller.signal);
    return () => controller.abort();
  }, [needsAttention, loadAttention, refreshKey]);

  useEffect(() => {
    if (activeTab !== "overview") return;
    const controller = new AbortController();
    // Let restored tab state settle before issuing the overview's count queries.
    void Promise.resolve().then(() => { if (!controller.signal.aborted) loadOverview(controller.signal); });
    return () => controller.abort();
  }, [activeTab, loadOverview, refreshKey]);

  useEffect(() => {
    if (activeTab !== "listings") return;
    let active = true;
    setListingsLoading(true); setListingsError("");
    const params = new URLSearchParams({ page: String(listingsPage), type: listingsType, status: listingsStatus });
    if(listingDepartment)params.set("dept",listingDepartment);if(listingSubcategory)params.set("sub",listingSubcategory);
    if (listingsSearch.trim()) params.set("search", listingsSearch.trim());
    fetchJson<{ listings: Listing[]; total: number }>(uiText, `/api/admin/listings?${params}`)
      .then((data) => { if (active) { setListings(data.listings); setListingsTotal(data.total); } })
      .catch((error: Error) => { if (active) setListingsError(uiErrorMessage(error, uiText("System.requestFailed"))); })
      .finally(() => { if (active) setListingsLoading(false); });
    return () => { active = false; };
  }, [activeTab, listingsPage, listingsSearch, listingsType, listingsStatus, listingDepartment, listingSubcategory, refreshKey]);

  useEffect(() => {
    let active = true;
    if (activeTab !== "reports") return;
    setReportsLoading(true); setReportsError("");
    fetchJson<{ reports: Report[]; total: number }>(uiText, `/api/reports?status=${reportsStatus}&page=${reportsPage}`)
      .then((data) => { if (!active) return;  setReports(data.reports); setReportsTotal(data.total); })
      .catch((error: Error) => { if (active) setReportsError(uiErrorMessage(error, uiText("System.requestFailed"))); })
      .finally(() => { if (active) setReportsLoading(false); });
      return () => { active = false; };
  }, [activeTab, reportsPage, reportsStatus, refreshKey]);

  useEffect(() => {
    let active = true;
    if (activeTab !== "verifications") return;
    setVerificationsLoading(true); setVerificationsError("");
    fetchJson<{ data: Verification[]; total: number }>(uiText, `/api/verification-requests?scope=admin&page=${verificationsPage}&status=${verificationsStatus}`)
      .then((data) => { if (!active) return;  setVerifications(data.data); setVerificationsTotal(data.total); })
      .catch((error: Error) => { if (active) setVerificationsError(uiErrorMessage(error, uiText("System.requestFailed"))); })
      .finally(() => { if (active) setVerificationsLoading(false); });
      return () => { active = false; };
  }, [activeTab, verificationsPage, verificationsStatus, refreshKey]);

  useEffect(() => {
    let active = true;
    if (activeTab !== "users") return;
    setProfilesLoading(true); setProfilesError("");
    const params = new URLSearchParams({ page: String(profilesPage) });
    if (profilesSearch.trim()) params.set("search", profilesSearch.trim());
    fetchJson<{ users: AdminProfile[]; total: number }>(uiText, `/api/admin/users?${params}`)
      .then((data) => { if (!active) return;  setProfiles(data.users); setProfilesTotal(data.total); })
      .catch((error: Error) => { if (active) setProfilesError(uiErrorMessage(error, uiText("System.requestFailed"))); })
      .finally(() => { if (active) setProfilesLoading(false); });
      return () => { active = false; };
  }, [activeTab, profilesPage, profilesSearch, refreshKey]);

  useEffect(() => {
    let active = true;
    if (activeTab !== "companies") return;
    setCompaniesLoading(true); setCompaniesError(""); setClarificationsError("");
    const companyParams = new URLSearchParams({ page: String(companiesPage) });
    if (companiesSearch.trim()) companyParams.set("search", companiesSearch.trim());
    Promise.allSettled([
      fetchJson<{ companies: Company[]; total: number }>(uiText, `/api/admin/companies?${companyParams}`),
      fetchJson<{ requests: Clarification[]; total: number }>(uiText, `/api/admin/company-clarifications?page=${clarificationsPage}`),
    ]).then(([companyResult, clarificationResult]) => { if (!active) return;
      if (companyResult.status === "fulfilled") { setCompanies(companyResult.value.companies); setCompaniesTotal(companyResult.value.total); }
      else setCompaniesError(uiErrorMessage(companyResult.reason, uiText("Ui.text_d2e09e94a87dc0")));
      if (clarificationResult.status === "fulfilled") { setClarifications(clarificationResult.value.requests); setClarificationsTotal(clarificationResult.value.total); }
      else setClarificationsError(uiErrorMessage(clarificationResult.reason, uiText("Ui.text_e7b2715fd50515")));
    }).finally(() => { if (active) setCompaniesLoading(false); });
      return () => { active = false; };
  }, [activeTab, companiesPage, companiesSearch, clarificationsPage, refreshKey]);

  useEffect(() => {
    let active = true;
    if (activeTab !== "projects") return;
    setProjectsLoading(true); setProjectsError("");
    const params = new URLSearchParams({ page: String(projectsPage) });
    if (projectsSearch.trim()) params.set("search", projectsSearch.trim());
    fetchJson<{ projects: AdminProject[]; total: number }>(uiText, `/api/admin/projects?${params}`)
      .then((data) => { if (!active) return;  setProjects(data.projects); setProjectsTotal(data.total); })
      .catch((error: Error) => { if (active) setProjectsError(uiErrorMessage(error, uiText("System.requestFailed"))); })
      .finally(() => { if (active) setProjectsLoading(false); });
      return () => { active = false; };
  }, [activeTab, projectsPage, projectsSearch, refreshKey]);

  useEffect(() => {
    let active = true;
    if (activeTab !== "bookings") return;
    setBookingsLoading(true); setBookingsError("");
    fetchJson<{ bookings: Booking[]; total: number }>(uiText, `/api/admin/bookings?page=${bookingsPage}&status=${bookingsStatus}`)
      .then((data) => { if (!active) return;  setBookings(data.bookings); setBookingsTotal(data.total); })
      .catch((error: Error) => { if (active) setBookingsError(uiErrorMessage(error, uiText("System.requestFailed"))); })
      .finally(() => { if (active) setBookingsLoading(false); });
      return () => { active = false; };
  }, [activeTab, bookingsPage, bookingsStatus, refreshKey]);

  useEffect(() => {
    let active = true;
    if (activeTab !== "media") return;
    setMediaLoading(true); setMediaError("");
    fetchJson<{ entities: MediaEntity[]; total: number }>(uiText, `/api/admin/media?type=${mediaType}&page=${mediaPage}`)
      .then((data) => { if (!active) return;  setMediaEntities(data.entities); setMediaTotal(data.total); })
      .catch((error: Error) => { if (active) setMediaError(uiErrorMessage(error, uiText("System.requestFailed"))); })
      .finally(() => { if (active) setMediaLoading(false); });
      return () => { active = false; };
  }, [activeTab, mediaType, mediaPage, refreshKey]);

  useEffect(() => {
    let active = true;
    if (activeTab !== "audit") return;
    setAuditLoading(true); setAuditError("");
    fetchJson<{ entries: AuditEntry[]; total: number }>(uiText, `/api/admin/audit?page=${auditPage}`)
      .then((data) => { if (!active) return;  setAuditEntries(data.entries); setAuditTotal(data.total); })
      .catch((error: Error) => { if (active) setAuditError(uiErrorMessage(error, uiText("System.requestFailed"))); })
      .finally(() => { if (active) setAuditLoading(false); });
      return () => { active = false; };
  }, [activeTab, auditPage, refreshKey]);

  async function mutate(url: string, payload: Record<string, unknown>, method = "PATCH") {
    const data = await fetchJson<{ success?: boolean; ok?: boolean; auditLogged?: boolean }>(uiText, url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (data.auditLogged === false) setActionMessage({ text: uiText("Ui.text_22be0877767a24"), error: true });
    else setActionMessage({ text: uiText("Ui.text_5e13d028516a79") });
    if (activeTab === "overview") loadOverview();
    else void loadAttention();
    return data;
  }

  async function changeReport(report: Report, status: "reviewed" | "resolved" | "dismissed") {
    const labels = { reviewed: uiText("Ui.text_c6eaa909e2f52f"), resolved: uiText("Ui.text_35475af80cfcae"), dismissed: uiText("Ui.text_66743be2739c89") };
    const reason = await adminReason(uiText, uiText("Ui.text_efae3eb968ceb3", { value1: String(labels[status]), value2: String(report.target_name ?? report.target_id) }));
    if (!reason) return;
    try {
      await mutate("/api/reports", { id: report.id, status, reason });
      setReports((items) => items.filter((item) => item.id !== report.id));
      setReportsTotal((total) => Math.max(0, total - 1));
    } catch (error) { setActionMessage({ text: uiErrorMessage(error, uiText("System.requestFailed")), error: true }); }
  }

  function changeVerification(request: Verification, action: "approve" | "reject") {
    if (!verificationLock.current) setVerificationDecision({ kind: "request", request, action });
  }
  function toggleProfile(profile: AdminProfile) {
    if (!verificationLock.current) setVerificationDecision({ kind: "profile", profile, verified: !profile.verified });
  }
  async function saveVerificationDecision(reason: string) {
    const decision = verificationDecision;
    if (!decision || verificationLock.current) return;
    verificationLock.current = true;
    const targetId = decision.kind === "request" ? decision.request.id : decision.profile.user_id;
    if (decision.kind === "request") setVerificationActing(targetId); else setProfileActing(targetId);
    try {
      if (decision.kind === "request") {
        await mutate("/api/verification-requests", { requestId: decision.request.id, version: decision.request.review_version, profileRevision: decision.request.profile_revision, action: decision.action, reason });
      } else {
        await mutate("/api/admin/users", { targetUserId: decision.profile.user_id, verified: decision.verified, revision: decision.profile.verification_revision, reason });
      }
      setVerificationDecision(null);
      setActionMessage({ text: verificationText("saved") });
      setRefreshKey(key => key + 1);
    } catch (error) { setActionMessage({ text: uiErrorMessage(error, verificationText("saveError")), error: true }); }
    finally { verificationLock.current = false; setVerificationActing(null); setProfileActing(null); }
  }

  async function toggleProject(project: AdminProject) {
    const nextValue = !project.verified;
    const reason = await adminReason(uiText, uiText("Ui.text_efae3eb968ceb3", { value1: String(nextValue ? uiText("Ui.text_2ac56fc7125285") : uiText("Ui.text_e96f6634a59db7")), value2: String(project.title) }));
    if (!reason) return;
    setProjectActing(project.id);
    try {
      await mutate("/api/admin/projects", { projectId: project.id, verified: nextValue, reason });
      setProjects((items) => items.map((item) => item.id === project.id ? { ...item, verified: nextValue } : item));
    } catch (error) { setActionMessage({ text: uiErrorMessage(error, uiText("System.requestFailed")), error: true }); }
    finally { setProjectActing(null); }
  }

  async function loadCredits(projectId: string, page = 1) {
    setCreditsLoading(projectId);
    try {
      const data = await fetchJson<{ credits: AdminCredit[]; page: number; total: number }>(uiText, `/api/admin/project-credits?project_id=${encodeURIComponent(projectId)}&page=${page}`);
      setCredits((current) => ({ ...current, [projectId]: data.credits }));
      setCreditsPage(data.page);
      setCreditsTotal(data.total);
    } catch (error) { setActionMessage({ text: uiErrorMessage(error, uiText("System.requestFailed")), error: true }); }
    finally { setCreditsLoading(null); }
  }

  async function saveCredit(credit: AdminCredit) {
    const reason = await adminReason(uiText, uiText("Ui.text_b88e154a15c813", { value1: String(credit.name) }));
    if (!reason) return;
    setCreditActing(credit.id);
    try {
      await mutate("/api/admin/project-credits", { id: credit.id, role: editingRole, reason });
      setCredits((current) => Object.fromEntries(Object.entries(current).map(([projectId, rows]) => [projectId, rows.map((row) => row.id === credit.id ? { ...row, role: editingRole } : row)])));
      setEditingCredit(null);
    } catch (error) { setActionMessage({ text: uiErrorMessage(error, uiText("System.requestFailed")), error: true }); }
    finally { setCreditActing(null); }
  }

  async function deleteCredit(credit: AdminCredit) {
    if (!await confirmDialog({ message: uiText("Ui.text_3aed5b680210ac", { value1: String(credit.name) }), confirmLabel: uiText("home.boardDelete"), cancelLabel: uiText("home.boardCancel") })) return;
    const reason = await adminReason(uiText, uiText("Ui.text_efb5b3435924e1", { value1: String(credit.name) }));
    if (!reason) return;
    setCreditActing(credit.id);
    try {
      await mutate(`/api/admin/project-credits?id=${encodeURIComponent(credit.id)}&confirm=true&reason=${encodeURIComponent(reason)}`, {}, "DELETE");
      const remaining = (credits[credit.project_id] ?? []).filter((row) => row.id !== credit.id);
      setCredits((current) => ({ ...current, [credit.project_id]: remaining }));
      setCreditsTotal((total) => Math.max(0, total - 1));
      if (!remaining.length && creditsPage > 1) await loadCredits(credit.project_id, creditsPage - 1);
    } catch (error) { setActionMessage({ text: uiErrorMessage(error, uiText("System.requestFailed")), error: true }); }
    finally { setCreditActing(null); }
  }

  async function checkMedia(url: string) {
    setMediaChecking(url);
    try {
      const result = await fetchJson<{ status: string; message?: string; httpStatus?: number; contentType?: string }>(uiText, `/api/admin/media/check?url=${encodeURIComponent(url)}`);
      setMediaChecks((current) => ({ ...current, [url]: result }));
    } catch (error) {
      setMediaChecks((current) => ({ ...current, [url]: { status: "check_failed", message: uiErrorMessage(error, uiText("System.requestFailed")) } }));
    } finally { setMediaChecking(null); }
  }

  const newsletterText = useTranslations("AdminNewsletter");
  const placeText = useTranslations("Places");
  const freshnessText = useTranslations("AdminListingFreshness");
  const labels = activeTab === "reviews" ? reviewT("queueTitle") : activeTab === "accounts" ? accountsText("title") : activeTab === "started-offers" ? startedText("title") : activeTab === "organizations" ? organizationAdminText("title") : activeTab === "newsletter" ? newsletterText("title") : (activeTab === "overview" ? uiText("nav.accountOverview") : navItems.find((item) => item.id === activeTab)?.label) ?? uiText("Ui.text_c1c224b03cd9bc");
  const pendingReports = overview?.counts.pendingReports ?? 0;
  const pendingVerifications = overview?.counts.pendingVerifications ?? 0;
  const companyClarificationsCount = overview?.counts.companyClarifications ?? 0;

  return (
    <div className="min-h-screen pt-16 lg:flex">
      <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-56 flex-col border-r border-border bg-bg-secondary lg:flex">
        <div className="border-b border-border p-4"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg border border-crimson/30 bg-crimson/20"><Shield size={16} className="text-crimson-light" /></div><div><p className="text-sm font-semibold text-text-primary">{uiText("nav.adminArea")}</p><p className="text-xs text-text-muted">{uiText("AdminNewsletter.brandName")}</p></div></div></div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <a href="/admin/places" className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-bg-elevated">{placeText("reviewTitle")}</a>
          <a href="/admin/listing-freshness" className="flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-bg-elevated">{freshnessText("title")}</a>
          {navItems.map(({ icon: Icon, label: originalLabel, id }) => {
            const label = id === "reviews" ? reviewT("queueTitle") : id === "accounts" ? accountsText("title") : id === "started-offers" ? startedText("title") : id === "organizations" ? organizationAdminText("title") : id === "newsletter" ? newsletterText("title") : originalLabel;
            const badge = id === "support" ? supportUnread.count ?? 0 : id === "reports" ? pendingReports : id === "verifications" ? pendingVerifications : id === "companies" ? companyClarificationsCount : 0;
            return <button key={id} onClick={() => selectAdminTab(id)} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === id ? "border-l-2 border-crimson bg-crimson/10 pl-2.5 text-crimson-light" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}><Icon size={15} /><span className="flex-1 text-left">{label}</span>{badge > 0 && <span aria-label={id === "support" ? supportText("unreadLabel", { count: badge }) : undefined} className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-bg-primary">{badge}</span>}{id === "support" && supportUnread.status === "error" && <CircleAlert size={15} aria-label={supportText("unreadError")} />}</button>;
          })}
        </nav>
        <div className="border-t border-border p-3"><p className="px-3 text-xs text-text-muted">{uiText("Ui.text_ecbb4568b854da")}</p></div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-56">
        <header className="sticky top-16 z-30 border-b border-border bg-bg-primary/90 px-4 py-3 backdrop-blur-nav sm:px-6"><h1 className="font-display text-lg font-bold text-text-primary">{labels}</h1></header>
        <nav className="flex gap-2 overflow-x-auto border-b border-border bg-bg-primary px-4 py-2 lg:hidden">
          <a href="/admin/places" className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-border px-3 py-2 text-xs">{placeText("reviewTitle")}</a>
          <a href="/admin/listing-freshness" className="flex min-h-11 shrink-0 items-center rounded-lg border border-border px-3 py-2 text-xs">{freshnessText("title")}</a>
          {navItems.map(({ label, id }) => <button key={id} onClick={() => selectAdminTab(id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${activeTab === id ? "border-crimson/40 bg-crimson/10 text-crimson-light" : "border-border text-text-secondary"}`}>{id === "reviews" ? reviewT("queueTitle") : id === "accounts" ? accountsText("title") : id === "started-offers" ? startedText("title") : id === "organizations" ? organizationAdminText("title") : id === "newsletter" ? newsletterText("title") : label}{id === "support" && (supportUnread.count ?? 0) > 0 && <span aria-label={supportText("unreadLabel", { count: supportUnread.count! })} className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-bg-primary">{supportUnread.count}</span>}{id === "support" && supportUnread.status === "error" && <CircleAlert size={14} aria-label={supportText("unreadError")} />}</button>)}
        </nav>
        <div className="min-w-0 space-y-5 p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-28 lg:pb-6">
          {actionMessage && <div role={actionMessage.error ? "alert" : "status"} className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${actionMessage.error ? "border-gold/30 bg-gold/10 text-gold" : "border-success/30 bg-success/10 text-success"}`}><span className="min-w-0 break-words [overflow-wrap:anywhere]">{actionMessage.text}</span><button className="flex min-h-11 min-w-11 shrink-0 items-center justify-center" aria-label={uiText("Ui.text_91b884fe922674")} onClick={() => setActionMessage(null)}><X size={15} /></button></div>}

          {activeTab === "overview" && <div className="space-y-5">
            {overviewError && <ErrorBox text={overviewError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: moderation("pendingCount"), value: overview?.counts.pendingOffers, tab: "reviews" as TabId, icon: List, urgent: (overview?.counts.pendingOffers ?? 0) > 0 },
                { label: moderation("legacyCount"), value: overview?.counts.legacyOffers, tab: "reviews" as TabId, icon: List, urgent: (overview?.counts.legacyOffers ?? 0) > 0 },
                { label: uiText("Ui.text_8c5b9a37f10f1e"), value: overview?.counts.pendingReports, tab: "reports" as TabId, icon: ClipboardList, urgent: pendingReports > 0 },
                { label: uiText("Ui.text_b39c94aea8390f"), value: overview?.counts.pendingVerifications, tab: "verifications" as TabId, icon: ShieldCheck, urgent: pendingVerifications > 0 },
                { label: uiText("Ui.text_11fb4985b1dbca"), value: overview?.counts.companyClarifications, tab: "companies" as TabId, icon: Building2, urgent: companyClarificationsCount > 0 },
                { label: uiText("Ui.text_865adff6d948f4"), value: overview?.counts.draftListings, tab: "listings" as TabId, icon: List, urgent: false },
              ].map(({ label, value, tab, icon: Icon, urgent }) => <button key={label} onClick={() => { if (label === moderation("legacyCount") || label === moderation("pendingCount")) { const owner = reviewUserId || reviewOwner || "guest"; const record = viewRecord(window.history.state, "/admin", owner); writeViewRecord("/admin", owner, { fields: { ...record.fields, reviewStatus: label === moderation("legacyCount") ? "legacy_review_required" : "pending", reviewKind: "listing", reviewPage: 1 } }); } setActiveTab(tab); }} className={`rounded-xl border p-4 text-left transition-colors hover:bg-bg-elevated ${urgent ? "border-gold/30 bg-gold/5" : "border-border bg-bg-secondary"}`}>{uiText.rich("Ui.text_41323be4f91608", { value3: () => (label), part2: chunks => (<span>{chunks}</span>), part4: () => (<Icon size={15} />), part1: chunks => (<span className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-text-muted">{chunks}</span>), value6: () => (overviewLoading ? "…" : (value ?? 0)), part5: chunks => (<span className={`mt-2 block text-2xl font-bold font-display ${urgent ? "text-gold" : "text-text-primary"}`}>{chunks}</span>), part8: () => (<ChevronRight className="inline" size={12} />), part7: chunks => (<span className="mt-1 block text-xs text-text-muted">{chunks}</span>) })}</button>)}
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
              <Panel className="overflow-hidden"><div className="border-b border-border p-4"><h2 className="font-semibold text-text-primary">{uiText("Ui.text_0971a32df77ed2")}</h2><p className="mt-1 text-xs text-text-muted">{uiText("Ui.text_4702ce46550e6b")}</p></div>
                {overviewLoading ? <p className="p-6 text-sm text-text-muted">{uiText("Ui.text_437466ccf276d8")}</p> : !overview?.recentListings.length ? <p className="p-6 text-sm text-text-muted">{uiText("Ui.text_709cbabd135b9c")}</p> : <div className="divide-y divide-border">{overview.recentListings.map((item) => <div key={item.id} className="flex min-w-0 items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm text-text-primary">{item.title}</p><p className="truncate text-xs text-text-muted">{typeLabels[item.type] ?? item.type} · {item.city || uiText("AdminOrganizations.noLocation")} · {new Date(item.created_at).toLocaleDateString(uiLocale)}</p></div><StatusBadge tone={item.published ? "success" : "muted"}>{item.published ? uiText("AdminAccounts.contentPublic") : uiText("OfferModeration.statuses.draft")}</StatusBadge></div>)}</div>}
              </Panel>
              <Panel className="p-4"><h2 className="font-semibold text-text-primary">{uiText("Ui.text_ae80902e590492")}</h2><div className="mt-3 grid grid-cols-2 gap-3 text-sm">{[
                ["Profile", "profiles"], ["Firmen", "Unternehmen"], ["Inserate gesamt", "listings"], ["Locations", "locations"], ["Jobs", "jobs"], ["Crew / Talent", "crew"], ["Marktplatz", "marketplace"], ["Tiere", "animals"], ["Dienstleistungen", "services"], ["Projekte", "projects"], ["Aktuelle Aushänge", "communityPosts"], ["Buchungsanfragen", "bookings"], ["Bewertungen", "reviews"], ["Bewerbungen", "applications"],
              ].map(([label, key]) => <div key={key} className="flex justify-between gap-2 border-b border-border/70 pb-2"><span className="text-text-muted">{(uiOptionLabels[label] ?? label)}</span><strong className="text-text-primary">{overviewLoading ? "…" : (overview?.counts[key] ?? "—")}</strong></div>)}</div><p className="mt-4 rounded-lg border border-border bg-bg-elevated p-3 text-xs leading-relaxed text-text-muted">{uiText("Ui.text_580cc9e38b682e")}</p></Panel>
            </div>
          </div>}

          {activeTab === "reports" && <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-text-muted">{uiText("Ui.text_5ea63691e37e72")}</p><select value={reportsStatus} onChange={(e) => { setReportsStatus(e.target.value); setReportsPage(1); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"><option value="pending">{uiText("Ui.text_64509e1af49cd9")}</option><option value="reviewed">{uiText("Ui.text_db2c6cfa22deb2")}</option><option value="resolved">{uiText("Ui.text_38ee859a969e3a")}</option><option value="dismissed">{uiText("Ui.text_54730c6647cb8c")}</option></select></div>
            {reportsError && <ErrorBox text={reportsError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {reportsLoading && !reports.length ? <p className="py-10 text-center text-sm text-text-muted">{uiText("Ui.text_b0fe418761c1fa")}</p> : reports.length === 0 ? <Empty title={uiText("Ui.text_172e00587f952d")} /> : <div className="space-y-3">{reports.map((report) => <Panel key={report.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-text-primary">{report.target_name ?? uiText("Ui.text_e7cfcd79c0fe62", { value1: String(report.target_id) })}</h2><StatusBadge tone="warning">{reasonLabels[report.reason] ?? report.reason}</StatusBadge><StatusBadge>{report.target_type}</StatusBadge></div><p className="mt-1 text-xs text-text-muted">{uiText.rich("Ui.text_fe62daada33ea6", { value1: () => (report.reporter_name ?? report.reporter_id), value2: () => (new Date(report.created_at).toLocaleString(uiLocale)) })}</p>{report.target_excerpt && <p className="mt-3 rounded-lg border border-border bg-bg-elevated p-3 text-sm text-text-secondary">{report.target_excerpt}</p>}{report.details && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-secondary">{uiText.rich("Ui.text_e7320eb5d26ede", { value1: () => (report.details) })}</p>}<p className="mt-2 break-all text-[11px] text-text-muted">{uiText.rich("Ui.text_e288d86c1edda1", { value1: () => (report.id) })}</p></div>{(reportReviewPath(report.target_type, report.target_id) || report.target_href) && <a href={reportReviewPath(report.target_type, report.target_id) || report.target_href || "/admin"} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold">{uiText.rich("Ui.text_fe5c837a483733", { part1: () => (<Eye size={12} />) })}</a>}</div>{reportsStatus === "pending" && <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => changeReport(report, "reviewed")} className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold">{uiText("Ui.text_c6eaa909e2f52f")}</button><button onClick={() => changeReport(report, "resolved")} className="rounded-lg border border-success/30 px-3 py-2 text-xs font-semibold text-success">{uiText("Ui.text_32001c12e8aade")}</button><button onClick={() => changeReport(report, "dismissed")} className="rounded-lg border border-border px-3 py-2 text-xs text-text-muted">{uiText("Ui.text_594ca889c4421b")}</button></div>}</Panel>)}</div>}
            <Pager page={reportsPage} total={reportsTotal} pageSize={50} onPage={setReportsPage} />
          </div>}

          {activeTab === "verifications" && <div className="min-w-0 space-y-4">
            <div className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-text-secondary">{uiText("Ui.text_4766acadcd2c41")}</div>
            <label className="block max-w-sm text-sm text-text-secondary">{verificationText("filterLabel")}<select value={verificationsStatus} onChange={event => { setVerificationsStatus(event.target.value); setVerificationsPage(1); setVerificationDecision(null); }} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg-secondary p-3 text-base">{["pending", "approved", "rejected", "all"].map(status => <option key={status} value={status}>{verificationText(status)}</option>)}</select></label>
            {verificationsError && <ErrorBox text={verificationsError} onRetry={() => setRefreshKey(key => key + 1)} />}
            {verificationsLoading ? <p role="status" className="py-10 text-center text-sm text-text-muted">{uiText("Ui.text_f37cdca9b23b05")}</p> : !verifications.length ? <Empty title={uiText("Ui.text_4f05e290726542")} /> : <div className="space-y-3">{verifications.map(request => <Panel key={request.id} className="min-w-0 p-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1 basis-48"><a href={`/admin/review/profile/${encodeURIComponent(request.user_id)}`} className="inline-flex min-h-11 items-center break-words font-medium text-text-primary hover:text-gold [overflow-wrap:anywhere]">{request.display_name ?? request.user_id}</a><p className="mt-1 break-words text-xs text-text-muted [overflow-wrap:anywhere]">{new Date(request.submitted_at).toLocaleString(uiLocale)} · {request.user_id}</p><div className="mt-2"><StatusBadge tone={request.status === "approved" ? "success" : request.status === "rejected" ? "danger" : "warning"}>{verificationText(request.status)}</StatusBadge></div></div>
              {request.status === "pending" && <div className="flex flex-wrap gap-2"><button disabled={verificationActing !== null || request.profile_revision === null} onClick={() => changeVerification(request, "approve")} className="min-h-11 rounded-lg border border-success/30 px-4 py-2 text-sm font-semibold text-success disabled:opacity-50">{verificationText("approve")}</button><button disabled={verificationActing !== null || request.profile_revision === null} onClick={() => changeVerification(request, "reject")} className="min-h-11 rounded-lg border border-crimson/30 px-4 py-2 text-sm font-semibold text-crimson-light disabled:opacity-50">{verificationText("reject")}</button></div>}</div>
              {request.profile_revision === null && <p role="alert" className="mt-3 text-sm text-gold">{verificationText("profileMissing")}</p>}
              {request.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-text-secondary [overflow-wrap:anywhere]">{request.notes}</p>}
              {request.has_document ? <a href={`/api/verification-requests/${encodeURIComponent(request.id)}/document?version=${request.review_version}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center break-words text-sm text-gold">{verificationText("document")}</a> : request.status === "pending" && <p className="mt-3 text-sm text-text-muted">{verificationText("evidenceMissing")}</p>}
              {request.review_reason && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-text-secondary [overflow-wrap:anywhere]">{request.review_reason}</p>}
              {verificationDecision?.kind === "request" && verificationDecision.request.id === request.id && <VerificationDecision key={`${request.id}-${verificationDecision.action}`} title={verificationText(verificationDecision.action === "approve" ? "decisionApprove" : "decisionReject", { name: request.display_name ?? request.user_id })} optional={verificationDecision.action === "approve"} saving={verificationActing === request.id} onSave={reason => void saveVerificationDecision(reason)} onCancel={() => setVerificationDecision(null)} />}
            </Panel>)}</div>}
            <Pager page={verificationsPage} total={verificationsTotal} pageSize={50} onPage={setVerificationsPage} />
          </div>}

          {activeTab === "accounts" && <AdminAccounts />}
          {activeTab === "started-offers" && <AdminStartedOffers />}
          {activeTab === "users" && <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-text-secondary">{uiText("Ui.text_3823abad969698")}</div>
            <div className="flex flex-wrap items-center gap-3"><div className="relative w-full max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={profilesSearch} onChange={(e) => { setProfilesSearch(e.target.value); setProfilesPage(1); }} placeholder={uiText("Ui.text_013e9a01e583be")} className="w-full rounded-xl border border-border bg-bg-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted" /></div><span className="text-sm text-text-muted">{uiText.rich("Ui.text_25b5b77e727a77", { value1: () => (profilesTotal) })}</span></div>
            {profilesError && <ErrorBox text={profilesError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {profilesLoading && !profiles.length ? <p className="py-10 text-center text-sm text-text-muted">{uiText("Ui.text_8ba3fe49fe080d")}</p> : !profiles.length ? <Empty title={uiText("creators.emptyTitleFiltered")} /> : <div className="space-y-2">{profiles.map((profile) => <Panel key={profile.user_id} className="flex flex-wrap items-center gap-3 p-4">{profile.avatar_url ? <Image src={profile.avatar_url} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-full border border-border object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-elevated"><Users size={15} className="text-text-muted" /></div>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium text-text-primary">{profile.display_name ?? uiText("Ui.text_396469a46c076c")}</p>{profile.verified && <BadgeCheck size={14} className="text-gold" />}</div><p className="truncate text-xs text-text-muted">{profile.location ?? uiText("AdminOrganizations.noLocation")}{profile.profile_types?.length ? uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(profile.profile_types.join(", ")) }) : ""}</p><p className="truncate font-mono text-[10px] text-text-muted">{uiText.rich("Ui.text_2a612a18e465f9", { value1: () => (profile.user_id) })}</p></div><a href={`/profile/${profile.slug ?? profile.user_id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold">{uiText.rich("Ui.text_16acd53b1dcdf2", { part1: () => (<Eye className="mr-1 inline" size={12} />) })}</a><AdminReviewLink kind="profile" id={profile.user_id} /><SupportMessageAction targetType="profile" targetId={profile.user_id} /><button disabled={profileActing === profile.user_id} onClick={() => toggleProfile(profile)} className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50 ${profile.verified ? "border-gold/30 text-gold" : "border-border text-text-muted hover:border-gold hover:text-gold"}`}>{profileActing === profile.user_id ? uiText("Ui.text_4f696a99f9c9e4") : profile.verified ? uiText("Ui.text_c9bc0de967fe95") : uiText("Ui.text_33347561b7ed6b")}</button>{verificationDecision?.kind === "profile" && verificationDecision.profile.user_id === profile.user_id && <VerificationDecision key={profile.user_id} title={verificationText(verificationDecision.verified ? "decisionApprove" : "decisionRevoke", { name: profile.display_name ?? profile.user_id })} optional={verificationDecision.verified} saving={profileActing === profile.user_id} onSave={reason => void saveVerificationDecision(reason)} onCancel={() => setVerificationDecision(null)} />}</Panel>)}</div>}
            <Pager page={profilesPage} total={profilesTotal} pageSize={50} onPage={setProfilesPage} />
          </div>}

          {activeTab === "reviews" && <AdminReviewQueue />}
          {activeTab === "companies" && <div className="space-y-5">
            <Panel className="overflow-hidden"><div className="border-b border-border p-4"><div className="flex items-center gap-2"><CircleAlert size={16} className="text-gold" /><h2 className="font-semibold text-text-primary">{uiText("Ui.text_d13621aafee30f")}</h2><StatusBadge tone={clarificationsTotal ? "warning" : "muted"}>{clarificationsTotal}</StatusBadge></div><p className="mt-1 text-xs text-text-muted">{uiText("Ui.text_d7c12f58d09ab4")}</p></div>
              {clarificationsError ? <div className="p-4"><ErrorBox text={clarificationsError} /></div> : !clarifications.length ? <p className="p-5 text-sm text-text-muted">{uiText("Ui.text_5a71685c007a65")}</p> : <div className="divide-y divide-border">{clarifications.map((request) => <div key={request.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="font-medium text-text-primary">{request.company_name}</p><p className="mt-1 text-xs text-text-muted">{uiText.rich("Ui.text_69f0313fa55d13", { value2: () => (request.requester_name ?? request.user_id), part1: chunks => (<a href={`/profile/${request.user_id}`} target="_blank" rel="noreferrer" className="text-gold hover:underline">{chunks}</a>), value3: () => (new Date(request.created_at).toLocaleString(uiLocale)) })}</p><p className="mt-2 text-sm text-text-secondary">{uiText.rich("Ui.text_2cc0b7ec245a11", { value1: () => ((request.public_titles ?? []).join(" · ") || request.title || uiText("AdminOrganizations.notProvided")) })}</p>{request.request_message && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-muted">„{request.request_message}”</p>}<p className="mt-2 text-xs text-gold">{uiText("Ui.text_58d9d6e7f44014")}</p></div><a href={`mailto:cinegenius.co@gmail.com?subject=${encodeURIComponent(uiText("Ui.text_d3a2a7381e5e6a", { value1: String(request.company_name) }))}&body=${encodeURIComponent(uiText("Ui.text_a65688d26630c0", { value1: String(request.company_id), value2: String(request.id), value3: String(request.user_id) }))}`} className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold">{uiText("Ui.text_e224120023107f")}</a></div>)}</div>}
              <div className="px-4 pb-4"><Pager page={clarificationsPage} total={clarificationsTotal} pageSize={25} onPage={setClarificationsPage} /></div>
            </Panel>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-text-primary">{uiText.rich("Ui.text_dea270a93160f6", { value1: () => (companiesTotal) })}</h2><div className="relative w-full max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={companiesSearch} onChange={(e) => { setCompaniesSearch(e.target.value); setCompaniesPage(1); }} placeholder={uiText("Ui.text_60582895a882a2")} className="w-full rounded-xl border border-border bg-bg-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted" /></div></div>
            {companiesError && <ErrorBox text={companiesError} />}
            {companiesLoading && !companies.length ? <p className="py-8 text-center text-sm text-text-muted">{uiText("Ui.text_5fc54dd547ba6b")}</p> : !companies.length ? <Empty title={uiText("Ui.text_5a35616902b016")} /> : <div className="space-y-2">{companies.map((company) => <Panel key={company.id} className="flex flex-wrap items-center gap-3 p-4">{company.logo_url ? <Image src={company.logo_url} alt="" width={44} height={44} unoptimized className="h-11 w-11 rounded-lg border border-border object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-bg-elevated"><Building2 size={16} className="text-text-muted" /></div>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{company.name}</p><StatusBadge tone={company.published ? "success" : "muted"}>{company.published ? uiText("AdminAccounts.contentPublic") : uiText("OfferModeration.statuses.draft")}</StatusBadge>{company.verified && <StatusBadge tone="success">{uiText("common.verified")}</StatusBadge>}</div><p className="mt-1 text-xs text-text-muted">{uiText.rich("Ui.text_bd3b14089edc29", { value1: () => (company.city || uiText("AdminOrganizations.noLocation")), value2: () => (company.categories?.join(", ") || uiText("Ui.text_b50c5fb31080dc")), value3: () => (company.member_count), value4: () => (company.pending_request_count) })}</p><p className="mt-1 font-mono text-[10px] text-text-muted">{uiText.rich("Ui.text_8c0d1747bbf7b8", { value1: () => (company.owner_user_id), value2: () => (company.owner_profile_missing ? uiText("Ui.text_7e26022e1c738e") : company.owner_name ? uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(company.owner_name) }) : "") })}</p></div><a href={`/companies/${company.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold">{uiText.rich("Ui.text_16acd53b1dcdf2", { part1: () => (<Eye className="mr-1 inline" size={12} />) })}</a><AdminReviewLink kind="company" id={company.id} /><ResponsiblePersonAdmin person={company.responsible_person} /><SupportMessageAction targetType="company" targetId={company.id} /></Panel>)}</div>}
            <Pager page={companiesPage} total={companiesTotal} pageSize={30} onPage={setCompaniesPage} />
          </div>}

          {activeTab === "listings" && <div className="space-y-4">
            <div className="mb-3 flex flex-wrap gap-3"><label className="min-w-0 text-sm">{market("choose")}<select className="ml-2 min-h-11 max-w-full rounded-lg border border-border bg-bg-secondary px-3" value={listingDepartment} onChange={event=>{setListingDepartment(event.target.value);setListingSubcategory("");setListingsPage(1);}}><option value="">{market("choose")}</option>{marketDepartments.map(d=><option value={d.id} key={d.id}>{d.label}</option>)}</select></label>{listingDepartment&&<label className="min-w-0 text-sm">{market("subcategory")}<select className="ml-2 min-h-11 max-w-full rounded-lg border border-border bg-bg-secondary px-3" value={listingSubcategory} onChange={event=>{setListingSubcategory(event.target.value);setListingsPage(1);}}><option value="">{market("allSubcategories")}</option>{marketDepartments.find(d=>d.id===listingDepartment)?.groups.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select></label>}</div>

            <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[220px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={listingsSearch} onChange={(e) => { setListingsSearch(e.target.value); setListingsPage(1); }} placeholder={uiText("Ui.text_526d087218e9be")} className="w-full rounded-lg border border-border bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-primary" /></div><select value={listingsType} onChange={(e) => { setListingsType(e.target.value); setListingsPage(1); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"><option value="all">{uiText("Ui.text_bc0b501bb3186b")}</option>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={listingsStatus} onChange={(e) => { setListingsStatus(e.target.value); setListingsPage(1); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"><option value="all">{uiText("OfferModeration.allStatuses")}</option><option value="published">{uiText("AdminAccounts.contentPublic")}</option>{OFFER_STATUSES.map(status => <option key={status} value={status}>{moderation("statuses." + status)}</option>)}</select><span className="text-sm text-text-muted">{uiText.rich("Ui.text_f4bfda1314a156", { value1: () => (listingsTotal) })}</span></div>
            {listingsError && <ErrorBox text={listingsError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {listingsLoading && !listings.length ? <p className="py-10 text-center text-sm text-text-muted">{uiText("Ui.text_62f1dd180e9718")}</p> : !listings.length ? <Empty title={uiText("Ui.text_c1b52b406ec3f2")} /> : <div className="space-y-2">{listings.map((listing) => <Panel key={listing.id} className="p-4"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{listing.title}</p><StatusBadge tone={listing.published ? "success" : "muted"}><OfferModerationStatus item={listing} /></StatusBadge></div><p className="mt-1 text-xs text-text-muted">{typeLabels[listing.type] ?? listing.type} · {listing.city || uiText("AdminOrganizations.noLocation")} · {listing.priceLabel ?? (listing.price ? uiText("Ui.text_4a44946c8fc283", { value1: String(Number(listing.price).toLocaleString(uiLocale)) }) : uiText("AdminReview.fields.price_on_request"))} · {new Date(listing.created_at).toLocaleDateString(uiLocale)}</p><p className="mt-1 font-mono text-[10px] text-text-muted">{uiText.rich("Ui.text_38aede50ccdfac", { value1: () => (listing.id) })}</p></div>{listing.published && listing.detail_href && <a href={listing.detail_href} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold">{uiText.rich("Ui.text_d7063c0f9b6271", { part1: () => (<Eye className="mr-1 inline" size={12} />) })}</a>}<AdminReviewLink kind="listing" id={listing.id} /><SupportMessageAction targetType="listing" targetId={listing.id} /></div><ListingProviderControls listing={listing} onSaved={() => setRefreshKey((key) => key + 1)} onError={(text) => setActionMessage({ text, error: true })} />{!listing.detail_href && <p className="mt-2 text-xs text-crimson-light">{uiText("Ui.text_3821369adcbd27")}</p>}</Panel>)}</div>}
            <Pager page={listingsPage} total={listingsTotal} pageSize={50} onPage={setListingsPage} />
          </div>}

          {activeTab === "projects" && <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={projectsSearch} onChange={(e) => { setProjectsSearch(e.target.value); setProjectsPage(1); }} placeholder={uiText("Ui.text_aa4ba86b01f4ed")} className="w-full rounded-xl border border-border bg-bg-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary" /></div><span className="text-sm text-text-muted">{uiText.rich("Ui.text_498d3e7eff0dd2", { value1: () => (projectsTotal) })}</span></div>
            {projectsError && <ErrorBox text={projectsError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {projectsLoading && !projects.length ? <p className="py-10 text-center text-sm text-text-muted">{uiText("Ui.text_1b314fa0c00641")}</p> : !projects.length ? <Empty title={uiText("projects.emptyTitle")} /> : <div className="space-y-2">{projects.map((project) => <Panel key={project.id} className="overflow-hidden"><div className="flex flex-wrap items-center gap-3 p-4"><button aria-expanded={expandedProject === project.id} onClick={() => { const next = expandedProject === project.id ? null : project.id; setExpandedProject(next); if (next) { setCreditsPage(1); loadCredits(next, 1); } }} className="flex items-center gap-1 text-xs text-text-muted">{uiText.rich("Ui.text_e5128f466df592", { part1: () => (<ChevronDown size={14} className={expandedProject === project.id ? "rotate-180" : ""} />), value2: () => (project.crew_count) })}</button><div className="min-w-0 flex-1"><p className="truncate font-medium text-text-primary">{project.title}</p><p className="text-xs text-text-muted">{[project.type, project.year, project.director].filter(Boolean).join(" · ")} · {new Date(project.created_at).toLocaleDateString(uiLocale)}</p></div><a href={`/projects/${project.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold">{uiText.rich("Ui.text_5e46b114a09d77", { part1: () => (<Eye className="mr-1 inline" size={12} />) })}</a><AdminReviewLink kind="project" id={project.id} /><button disabled={projectActing === project.id} onClick={() => toggleProject(project)} className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary disabled:opacity-50">{projectActing === project.id ? uiText("Ui.text_4f696a99f9c9e4") : project.verified ? uiText("Ui.text_43277c4204c895") : uiText("Ui.text_33347561b7ed6b")}</button></div>
              {expandedProject === project.id && <div className="border-t border-border bg-bg-elevated">{creditsLoading === project.id ? <p className="p-4 text-xs text-text-muted">{uiText("Ui.text_8329c0c04e12cf")}</p> : !(credits[project.id] ?? []).length ? <p className="p-4 text-xs text-text-muted">{uiText("Ui.text_88b45066db66fc")}</p> : (credits[project.id] ?? []).map((credit) => <div key={credit.id} className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 last:border-0">{editingCredit === credit.id ? <><span className="min-w-[120px] text-xs text-text-secondary">{credit.name}</span><input value={editingRole} onChange={(event) => setEditingRole(event.target.value)} className="min-w-[160px] flex-1 rounded border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary" /><button onClick={() => saveCredit(credit)} disabled={creditActing === credit.id} className="text-success"><Check size={14} /></button><button onClick={() => setEditingCredit(null)} className="text-text-muted"><X size={14} /></button></> : <><span className="min-w-[120px] flex-1 text-xs text-text-primary">{credit.name} · <span className="text-text-muted">{credit.role.split("||")[0]}</span></span>{credit.type === "user" && credit.user_id && <a href={`/profile/${credit.user_id}`} target="_blank" rel="noreferrer" className="text-xs text-gold">{uiText("profile.tabProfile")}</a>}<button onClick={() => { setEditingCredit(credit.id); setEditingRole(credit.role.split("||")[0]); }} className="rounded border border-border px-2 py-1 text-[11px] text-text-secondary">{uiText("Ui.text_a4f14a4ab5996a")}</button><button disabled={creditActing === credit.id} onClick={() => deleteCredit(credit)} className="rounded border border-crimson/30 px-2 py-1 text-[11px] text-crimson-light">{uiText("Ui.text_e1d7608e0a6d0a")}</button></>}</div>)}<div className="px-4 pb-3"><Pager page={creditsPage} total={creditsTotal} pageSize={50} onPage={(page) => loadCredits(project.id, page)} /></div></div>}
            </Panel>)}</div>}
            <Pager page={projectsPage} total={projectsTotal} pageSize={30} onPage={setProjectsPage} />
          </div>}

          {activeTab === "bookings" && <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm text-text-muted">{uiText("Ui.text_5f5315f2f8c389")}</p><select value={bookingsStatus} onChange={(e) => { setBookingsStatus(e.target.value); setBookingsPage(1); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"><option value="all">{uiText("OfferModeration.allStatuses")}</option><option value="pending">{uiText("profile.verifPendingStatus")}</option><option value="confirmed">{uiText("Places.verified")}</option><option value="rejected">{uiText("OfferModeration.statuses.rejected")}</option></select></div>
            {bookingsError && <ErrorBox text={bookingsError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {bookingsLoading && !bookings.length ? <p className="py-10 text-center text-sm text-text-muted">{uiText("Ui.text_ae5e013bbe59bf")}</p> : !bookings.length ? <Empty title={uiText("Ui.text_2e5af0af0bf05d")} /> : <div className="space-y-2">{bookings.map((booking) => <Panel key={booking.id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-medium text-text-primary">{booking.listing_title}</p><p className="mt-1 text-xs text-text-muted">{booking.requester_name ?? uiText("Ui.text_5397727abda7cc")} · {booking.ref} · {typeLabels[booking.listing_type] ?? booking.listing_type}</p><p className="mt-1 text-xs text-text-muted">{uiText.rich("Ui.text_e8b2664f28b5db", { value1: () => (booking.start_date), value2: () => (booking.end_date), value3: () => (booking.days), value4: () => (new Date(booking.created_at).toLocaleDateString(uiLocale)) })}</p><p className="mt-1 font-mono text-[10px] text-text-muted">{uiText.rich("Ui.text_2a612a18e465f9", { value1: () => (booking.user_id) })}</p></div><StatusBadge tone={booking.status === "confirmed" ? "success" : booking.status === "pending" ? "warning" : "muted"}>{booking.status === "pending" ? uiText("profile.verifPendingStatus") : booking.status === "confirmed" ? uiText("Places.verified") : booking.status}</StatusBadge><div className="text-right"><p className="font-semibold text-text-primary">{Number(booking.total).toLocaleString(uiLocale)} €</p><p className="text-[11px] text-text-muted">{uiText.rich("Ui.text_5f8b57e8fc1016", { value1: () => (Number(booking.platform_fee).toLocaleString(uiLocale)) })}</p></div></Panel>)}</div>}
            <Pager page={bookingsPage} total={bookingsTotal} pageSize={30} onPage={setBookingsPage} />
          </div>}

          {activeTab === "media" && <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-text-secondary">{uiText("Ui.text_8dc08fdfa0974a")}</div>
            <div className="flex flex-wrap items-center gap-3"><select value={mediaType} onChange={(e) => { setMediaType(e.target.value); setMediaPage(1); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"><option value="profiles">{uiText("Ui.text_8af3b882cd0d40")}</option><option value="companies">{uiText("Ui.text_8140c96bd353c7")}</option><option value="listings">{uiText("profile.tabListings")}</option><option value="projects">{uiText("nav.projects")}</option></select><span className="text-sm text-text-muted">{uiText.rich("Ui.text_1ad1c45f7f01dd", { value1: () => (mediaTotal) })}</span></div>
            {mediaError && <ErrorBox text={mediaError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {mediaLoading && !mediaEntities.length ? <p className="py-10 text-center text-sm text-text-muted">{uiText("Ui.text_dce2b01d3a90b8")}</p> : !mediaEntities.length ? <Empty title={uiText("Ui.text_ddf2eda8fed15f")} /> : <div className="space-y-2">{mediaEntities.map((entity) => <Panel key={entity.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-text-primary">{entity.title}</p><p className="mt-1 font-mono text-[10px] text-text-muted">{uiText.rich("Ui.text_a31bb11285151f", { value1: () => (entity.id), value2: () => (entity.published === true || entity.published === "published" ? uiText("Ui.text_d5d586bdb18a9a") : uiText("Ui.text_1d2e38aed19f8d")) })}</p></div><StatusBadge tone={entity.media.length ? "success" : "warning"}>{entity.media.length ? uiText("Ui.text_d081bf34777da2", { value1: String(entity.media.length) }) : uiText("Ui.text_d5ca05d75d4843")}</StatusBadge></div>{!entity.media.length ? <p className="mt-3 text-xs text-text-muted">{uiText("Ui.text_49e54758992341")}</p> : <div className="mt-3 grid gap-2">{entity.media.map((url) => { const check = mediaChecks[url]; return <div key={url} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg-elevated p-2"><a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs text-text-secondary hover:text-gold">{url}</a><button disabled={mediaChecking === url} onClick={() => checkMedia(url)} className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-text-secondary disabled:opacity-50">{mediaChecking === url ? uiText("Ui.text_5cb1c4ec08482e") : uiText("Ui.text_132008fe86524c")}</button>{check && <StatusBadge tone={check.status === "reachable" ? "success" : check.status === "external_reference" ? "muted" : "danger"}>{check.status === "reachable" ? uiText("Ui.text_5cd461ef171772", { value1: String(check.contentType ? uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(check.contentType) }) : "") }) : check.status === "missing_file" ? uiText("Ui.text_3b6724b8c0ad5c", { value1: String(check.httpStatus) }) : check.status === "access_problem" ? uiText("Ui.text_a7bf61e6a757a1", { value1: String(check.httpStatus) }) : check.status === "external_reference" ? uiText("Ui.text_848207da3967df") : check.status === "connection_error" ? uiText("Ui.text_809d7c1d67e387") : check.message ?? check.status}</StatusBadge>}</div>; })}</div>}</Panel>)}</div>}
            <Pager page={mediaPage} total={mediaTotal} pageSize={25} onPage={setMediaPage} />
          </div>}

          {activeTab === "audit" && <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-text-secondary">{uiText("Ui.text_cbc5b1b2db60ba")}</div>
            {auditError && <ErrorBox text={auditError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {auditLoading && !auditEntries.length ? <p className="py-10 text-center text-sm text-text-muted">{uiText("Ui.text_608cd62349893a")}</p> : !auditEntries.length ? <Empty title={uiText("Ui.text_4c13002b83ed76")} /> : <div className="space-y-2">{auditEntries.map((entry) => <Panel key={entry.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{entry.action.replaceAll("_", " ")}</p><StatusBadge tone={entry.outcome === "succeeded" ? "success" : entry.outcome === "failed" ? "danger" : "warning"}>{entry.outcome}</StatusBadge></div><p className="mt-1 text-xs text-text-muted">{uiText.rich("Ui.text_a0eff2b3af99dd", { value1: () => (new Date(entry.created_at).toLocaleString(uiLocale)), value2: () => (entry.actor_user_id) })}</p><p className="mt-1 break-all font-mono text-[10px] text-text-muted">{entry.entity_type} · {entry.entity_id}</p><p className="mt-2 text-sm text-text-secondary">{uiText.rich("Ui.text_e0f8c0ead6cdc6", { value1: () => (entry.reason) })}</p></div></div></Panel>)}</div>}
            <Pager page={auditPage} total={auditTotal} pageSize={50} onPage={setAuditPage} />
          </div>}

          {activeTab === "support" && <AdminSupportCenter />}
          {activeTab === "organizations" && <AdminOrganizations />}
          {activeTab === "newsletter" && <AdminNewsletter />}
        </div>
      </main>
    </div>
  );
}

export default function AdminPage() {
  const { userId, isLoaded } = useAuth();
  const serverAdminId = useContext(ServerAdminContext);
  const activeId = isLoaded ? userId : serverAdminId;
  return activeId ? <AdminContent key={activeId} /> : null;
}
