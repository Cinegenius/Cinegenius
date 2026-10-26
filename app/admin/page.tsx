"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Activity, BadgeCheck, Building2, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, ClipboardList, Clapperboard, CreditCard, Eye, FileImage,
  LayoutDashboard, List, MessageSquareText, Search, Shield, ShieldCheck, Users, X,
} from "lucide-react";
import { AdminSupportCenter } from "@/components/admin/AdminSupportCenter";
import { SupportMessageAction } from "@/components/admin/SupportMessageAction";

type TabId = "overview" | "reports" | "verifications" | "users" | "companies" | "listings" | "projects" | "bookings" | "media" | "support" | "audit";
const navItems: { icon: typeof LayoutDashboard; label: string; id: TabId }[] = [
  { icon: LayoutDashboard, label: "Übersicht", id: "overview" },
  { icon: ClipboardList, label: "Meldungen", id: "reports" },
  { icon: ShieldCheck, label: "Verifizierungen", id: "verifications" },
  { icon: Users, label: "Profile", id: "users" },
  { icon: Building2, label: "Firmen", id: "companies" },
  { icon: List, label: "Inserate", id: "listings" },
  { icon: Clapperboard, label: "Projekte", id: "projects" },
  { icon: CreditCard, label: "Buchungsanfragen", id: "bookings" },
  { icon: FileImage, label: "Medienprüfung", id: "media" },
  { icon: MessageSquareText, label: "Support", id: "support" },
  { icon: Activity, label: "Adminprotokoll", id: "audit" },
];

type Listing = { id: string; user_id: string | null; company_id: string | null; company_slug: string | null; type: string; title: string; city: string | null; price: number | null; priceLabel?: string; published: boolean; created_at: string; provider_name: string; provider_href: string | null; provider_image: string | null; provider_missing: boolean; detail_href: string | null };
type AdminProfile = { user_id: string; display_name: string | null; slug: string | null; location: string | null; avatar_url: string | null; profile_types: string[] | null; verified: boolean; created_at: string; tagline: string | null };
type AdminProject = { id: string; title: string; year: number | null; type: string | null; verified: boolean; created_at: string; director: string | null; crew_count: number };
type AdminCredit = { id: string; project_id: string; user_id: string | null; unclaimed_profile_id: string | null; role: string; created_at: string; name: string; type: "user" | "ghost" };
type Report = { id: string; reporter_id: string; reporter_name: string | null; target_type: string; target_id: string; target_name: string | null; target_href: string | null; target_excerpt: string | null; reason: string; details: string | null; status: string; created_at: string };
type Verification = { id: string; user_id: string; display_name: string | null; status: string; notes: string | null; submitted_at: string; reviewed_at: string | null };
type Company = { id: string; slug: string; owner_user_id: string; owner_name: string | null; owner_profile_missing: boolean; name: string; logo_url: string | null; city: string; categories: string[]; services: string[]; verified: boolean; published: boolean; created_at: string; member_count: number; pending_request_count: number };
type Clarification = { id: string; company_id: string; user_id: string; title: string | null; public_titles: string[]; request_message: string; created_at: string; company_name: string; company_slug: string; owner_user_id: string; requester_name: string | null; owner_name: string | null };
type Booking = { id: string; ref: string; user_id: string; listing_id: string | null; listing_title: string; listing_type: string; start_date: string; end_date: string; days: number; daily_rate: number; subtotal: number; platform_fee: number; total: number; status: string; created_at: string; requester_name: string | null };
type MediaEntity = { id: string; title: string; slug: string | null; published: string | boolean | null; media: string[] };
type AuditEntry = { id: string; actor_user_id: string; action: string; entity_type: string; entity_id: string; reason: string; outcome: string; metadata: Record<string, unknown>; created_at: string };
type Overview = { counts: Record<string, number>; recentListings: Listing[] };

const typeLabels: Record<string, string> = {
  location: "Location", prop: "Equipment / Requisite", vehicle: "Fahrzeug", job: "Job",
  creator: "Crew / Talent", service: "Dienstleistung", animal: "Tiere",
};
const reasonLabels: Record<string, string> = {
  spam: "Spam", harassment: "Belästigung", fake_profile: "Falsches Profil",
  inappropriate_content: "Unangemessener Inhalt", scam: "Betrugsverdacht", underage: "Minderjährigkeit", other: "Sonstiges",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Anfrage fehlgeschlagen (${response.status})`);
  return body as T;
}

function adminReason(label: string): string | null {
  const reason = window.prompt(`${label}\n\nBegründung fürs Adminprotokoll (mindestens 5 Zeichen):`);
  if (reason === null) return null;
  if (reason.trim().length < 5) {
    window.alert("Bitte eine Begründung mit mindestens 5 Zeichen eingeben.");
    return null;
  }
  return reason.trim().slice(0, 500);
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-bg-secondary ${className}`}>{children}</section>;
}

function Empty({ title, detail }: { title: string; detail?: string }) {
  return <div className="rounded-xl border border-dashed border-border py-14 px-5 text-center"><p className="font-semibold text-text-primary">{title}</p>{detail && <p className="mt-1 text-sm text-text-muted">{detail}</p>}</div>;
}

function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-crimson/30 bg-crimson/10 px-4 py-3 text-sm text-crimson-light"><span>{text}</span>{onRetry && <button onClick={onRetry} className="rounded-lg border border-crimson/30 px-3 py-1.5 text-xs font-semibold">Erneut laden</button>}</div>;
}

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages < 2) return null;
  return <div className="flex items-center justify-between gap-3 pt-2"><button onClick={() => onPage(page - 1)} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary disabled:opacity-40"><ChevronLeft size={13} /> Zurück</button><span className="text-xs text-text-muted">Seite {page} von {pages} · {total} Einträge</span><button onClick={() => onPage(page + 1)} disabled={page >= pages} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary disabled:opacity-40">Weiter <ChevronRight size={13} /></button></div>;
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
      fetchJson<{ results: ProviderOption[] }>(`/api/admin/listing-providers?type=${kind}&q=${encodeURIComponent(search.trim())}`, { signal: controller.signal })
        .then((data) => setResults(data.results))
        .catch((error: Error) => { if (error.name !== "AbortError") onErrorRef.current(error.message); })
        .finally(() => setLoading(false));
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [editing, kind, search]);

  async function choose(option: ProviderOption) {
    const reason = adminReason(`Anbieter für „${listing.title}” zuordnen: ${option.label}`);
    if (!reason) return;
    setSaving(true);
    try {
      await fetchJson("/api/admin/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: listing.id, providerType: option.kind, providerId: option.id, reason }) });
      setEditing(false);
      setSearch("");
      onSaved();
    } catch (error) { onErrorRef.current((error as Error).message); }
    finally { setSaving(false); }
  }

  return <div className="mt-3 rounded-lg border border-border bg-bg-primary/60 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 text-xs text-text-secondary">Anbieter: {listing.provider_href ? <a href={listing.provider_href} target="_blank" rel="noreferrer" className="font-medium text-gold hover:underline">{listing.provider_name}</a> : <span className={listing.provider_missing ? "font-semibold text-gold" : "font-medium text-text-primary"}>{listing.provider_name}</span>}</p>
      {listing.provider_missing && <StatusBadge tone="warning">Zuordnung prüfen</StatusBadge>}
      <button onClick={() => setEditing((value) => !value)} className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-text-secondary hover:border-gold hover:text-gold">{editing ? "Schließen" : listing.provider_missing ? "Anbieter zuordnen" : "Anbieter ändern"}</button>
    </div>
    {listing.company_id && listing.user_id && <p className="mt-2 break-all text-[10px] text-text-muted">Technisches Eintragskonto: {listing.user_id} · Firmenanbieter wird separat angezeigt.</p>}
    {editing && <div className="mt-3 space-y-2">
      <p className="text-xs text-text-muted">Wähle das tatsächliche öffentliche Anbieterprofil. Die Admin-Freigabe ist nicht automatisch die Anbieteridentität.</p>
      <div className="flex gap-2"><button onClick={() => { setKind("person"); setSearch(""); }} className={`min-h-10 rounded-lg border px-3 text-xs ${kind === "person" ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>Person</button><button onClick={() => { setKind("company"); setSearch(""); }} className={`min-h-10 rounded-lg border px-3 text-xs ${kind === "company" ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>Firma</button></div>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={kind === "person" ? "Öffentliches Personenprofil suchen…" : "Öffentliche Firma suchen…"} className="min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary" />
      {search.trim().length >= 2 && <div className="max-h-56 overflow-y-auto rounded-lg border border-border">{loading ? <p className="p-3 text-xs text-text-muted">Suche…</p> : !results.length ? <p className="p-3 text-xs text-text-muted">Keine passenden öffentlichen Anbieter gefunden.</p> : results.map((option) => <button key={option.id} disabled={saving} onClick={() => void choose(option)} className="flex min-h-12 w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-bg-elevated disabled:opacity-50"><span className="min-w-0 flex-1"><span className="block truncate text-sm text-text-primary">{option.label}</span><span className="block truncate text-[11px] text-text-muted">{option.detail}</span></span><span className="shrink-0 text-[11px] text-gold">{saving ? "Speichern…" : "Auswählen"}</span></button>)}</div>}
    </div>}
  </div>;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsSearch, setListingsSearch] = useState("");
  const [listingsType, setListingsType] = useState("all");
  const [listingsStatus, setListingsStatus] = useState("all");
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState("");
  const [listingActing, setListingActing] = useState<string | null>(null);

  const [reports, setReports] = useState<Report[]>([]);
  const [reportsStatus, setReportsStatus] = useState("pending");
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState("");

  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [verificationsLoading, setVerificationsLoading] = useState(false);
  const [verificationsError, setVerificationsError] = useState("");
  const [verificationsTotal, setVerificationsTotal] = useState(0);
  const [verificationsPage, setVerificationsPage] = useState(1);
  const [verificationActing, setVerificationActing] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [profilesTotal, setProfilesTotal] = useState(0);
  const [profilesPage, setProfilesPage] = useState(1);
  const [profilesSearch, setProfilesSearch] = useState("");
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState("");
  const [profileActing, setProfileActing] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesTotal, setCompaniesTotal] = useState(0);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesSearch, setCompaniesSearch] = useState("");
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState("");
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [clarificationsTotal, setClarificationsTotal] = useState(0);
  const [clarificationsPage, setClarificationsPage] = useState(1);
  const [clarificationsError, setClarificationsError] = useState("");

  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectsSearch, setProjectsSearch] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [projectActing, setProjectActing] = useState<string | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [credits, setCredits] = useState<Record<string, AdminCredit[]>>({});
  const [creditsLoading, setCreditsLoading] = useState<string | null>(null);
  const [creditsPage, setCreditsPage] = useState(1);
  const [creditsTotal, setCreditsTotal] = useState(0);
  const [editingCredit, setEditingCredit] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState("");
  const [creditActing, setCreditActing] = useState<string | null>(null);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsStatus, setBookingsStatus] = useState("all");
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  const [mediaEntities, setMediaEntities] = useState<MediaEntity[]>([]);
  const [mediaType, setMediaType] = useState("profiles");
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [mediaChecks, setMediaChecks] = useState<Record<string, { status: string; message?: string; httpStatus?: number; contentType?: string }>>({});
  const [mediaChecking, setMediaChecking] = useState<string | null>(null);

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");

  const loadOverview = useCallback(() => {
    setOverviewLoading(true);
    setOverviewError("");
    fetchJson<Overview>("/api/admin/overview")
      .then(setOverview)
      .catch((error: Error) => setOverviewError(error.message))
      .finally(() => setOverviewLoading(false));
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview, refreshKey]);

  useEffect(() => {
    if (activeTab !== "listings") return;
    setListingsLoading(true); setListingsError("");
    const params = new URLSearchParams({ page: String(listingsPage), type: listingsType, status: listingsStatus });
    if (listingsSearch.trim()) params.set("search", listingsSearch.trim());
    fetchJson<{ listings: Listing[]; total: number }>(`/api/admin/listings?${params}`)
      .then((data) => { setListings(data.listings); setListingsTotal(data.total); })
      .catch((error: Error) => setListingsError(error.message))
      .finally(() => setListingsLoading(false));
  }, [activeTab, listingsPage, listingsSearch, listingsType, listingsStatus, refreshKey]);

  useEffect(() => {
    if (activeTab !== "reports") return;
    setReportsLoading(true); setReportsError("");
    fetchJson<{ reports: Report[]; total: number }>(`/api/reports?status=${reportsStatus}&page=${reportsPage}`)
      .then((data) => { setReports(data.reports); setReportsTotal(data.total); })
      .catch((error: Error) => setReportsError(error.message))
      .finally(() => setReportsLoading(false));
  }, [activeTab, reportsPage, reportsStatus, refreshKey]);

  useEffect(() => {
    if (activeTab !== "verifications") return;
    setVerificationsLoading(true); setVerificationsError("");
    fetchJson<{ data: Verification[]; total: number }>(`/api/verification-requests?page=${verificationsPage}`)
      .then((data) => { setVerifications(data.data); setVerificationsTotal(data.total); })
      .catch((error: Error) => setVerificationsError(error.message))
      .finally(() => setVerificationsLoading(false));
  }, [activeTab, verificationsPage, refreshKey]);

  useEffect(() => {
    if (activeTab !== "users") return;
    setProfilesLoading(true); setProfilesError("");
    const params = new URLSearchParams({ page: String(profilesPage) });
    if (profilesSearch.trim()) params.set("search", profilesSearch.trim());
    fetchJson<{ users: AdminProfile[]; total: number }>(`/api/admin/users?${params}`)
      .then((data) => { setProfiles(data.users); setProfilesTotal(data.total); })
      .catch((error: Error) => setProfilesError(error.message))
      .finally(() => setProfilesLoading(false));
  }, [activeTab, profilesPage, profilesSearch, refreshKey]);

  useEffect(() => {
    if (activeTab !== "companies") return;
    setCompaniesLoading(true); setCompaniesError(""); setClarificationsError("");
    const companyParams = new URLSearchParams({ page: String(companiesPage) });
    if (companiesSearch.trim()) companyParams.set("search", companiesSearch.trim());
    Promise.allSettled([
      fetchJson<{ companies: Company[]; total: number }>(`/api/admin/companies?${companyParams}`),
      fetchJson<{ requests: Clarification[]; total: number }>(`/api/admin/company-clarifications?page=${clarificationsPage}`),
    ]).then(([companyResult, clarificationResult]) => {
      if (companyResult.status === "fulfilled") { setCompanies(companyResult.value.companies); setCompaniesTotal(companyResult.value.total); }
      else setCompaniesError(companyResult.reason instanceof Error ? companyResult.reason.message : "Firmen konnten nicht geladen werden.");
      if (clarificationResult.status === "fulfilled") { setClarifications(clarificationResult.value.requests); setClarificationsTotal(clarificationResult.value.total); }
      else setClarificationsError(clarificationResult.reason instanceof Error ? clarificationResult.reason.message : "Klärungsfälle konnten nicht geladen werden.");
    }).finally(() => setCompaniesLoading(false));
  }, [activeTab, companiesPage, companiesSearch, clarificationsPage, refreshKey]);

  useEffect(() => {
    if (activeTab !== "projects") return;
    setProjectsLoading(true); setProjectsError("");
    const params = new URLSearchParams({ page: String(projectsPage) });
    if (projectsSearch.trim()) params.set("search", projectsSearch.trim());
    fetchJson<{ projects: AdminProject[]; total: number }>(`/api/admin/projects?${params}`)
      .then((data) => { setProjects(data.projects); setProjectsTotal(data.total); })
      .catch((error: Error) => setProjectsError(error.message))
      .finally(() => setProjectsLoading(false));
  }, [activeTab, projectsPage, projectsSearch, refreshKey]);

  useEffect(() => {
    if (activeTab !== "bookings") return;
    setBookingsLoading(true); setBookingsError("");
    fetchJson<{ bookings: Booking[]; total: number }>(`/api/admin/bookings?page=${bookingsPage}&status=${bookingsStatus}`)
      .then((data) => { setBookings(data.bookings); setBookingsTotal(data.total); })
      .catch((error: Error) => setBookingsError(error.message))
      .finally(() => setBookingsLoading(false));
  }, [activeTab, bookingsPage, bookingsStatus, refreshKey]);

  useEffect(() => {
    if (activeTab !== "media") return;
    setMediaLoading(true); setMediaError("");
    fetchJson<{ entities: MediaEntity[]; total: number }>(`/api/admin/media?type=${mediaType}&page=${mediaPage}`)
      .then((data) => { setMediaEntities(data.entities); setMediaTotal(data.total); })
      .catch((error: Error) => setMediaError(error.message))
      .finally(() => setMediaLoading(false));
  }, [activeTab, mediaType, mediaPage, refreshKey]);

  useEffect(() => {
    if (activeTab !== "audit") return;
    setAuditLoading(true); setAuditError("");
    fetchJson<{ entries: AuditEntry[]; total: number }>(`/api/admin/audit?page=${auditPage}`)
      .then((data) => { setAuditEntries(data.entries); setAuditTotal(data.total); })
      .catch((error: Error) => setAuditError(error.message))
      .finally(() => setAuditLoading(false));
  }, [activeTab, auditPage, refreshKey]);

  async function mutate(url: string, payload: Record<string, unknown>, method = "PATCH") {
    const data = await fetchJson<{ success?: boolean; ok?: boolean; auditLogged?: boolean }>(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (data.auditLogged === false) setActionMessage({ text: "Änderung gespeichert. Das Protokoll blieb im Status „gestartet“; bitte die Adminmigration prüfen.", error: true });
    else setActionMessage({ text: "Änderung gespeichert und protokolliert." });
    loadOverview();
    return data;
  }

  async function changeReport(report: Report, status: "reviewed" | "resolved" | "dismissed") {
    const labels = { reviewed: "Als geprüft markieren", resolved: "Meldung abschließen", dismissed: "Meldung verwerfen" };
    const reason = adminReason(`${labels[status]}: ${report.target_name ?? report.target_id}`);
    if (!reason) return;
    try {
      await mutate("/api/reports", { id: report.id, status, reason });
      setReports((items) => items.filter((item) => item.id !== report.id));
      setReportsTotal((total) => Math.max(0, total - 1));
    } catch (error) { setActionMessage({ text: (error as Error).message, error: true }); }
  }

  async function changeVerification(request: Verification, action: "approve" | "reject") {
    const label = action === "approve" ? "Verifizierung genehmigen" : "Verifizierung ablehnen";
    const reason = adminReason(`${label}: ${request.display_name ?? request.user_id}`);
    if (!reason) return;
    setVerificationActing(request.id);
    try {
      await mutate("/api/verification-requests", { requestId: request.id, action, reason });
      setVerifications((items) => items.filter((item) => item.id !== request.id));
      setVerificationsTotal((total) => Math.max(0, total - 1));
    } catch (error) { setActionMessage({ text: (error as Error).message, error: true }); }
    finally { setVerificationActing(null); }
  }

  async function toggleProfile(profile: AdminProfile) {
    const nextValue = !profile.verified;
    const reason = adminReason(`${nextValue ? "Profil verifizieren" : "Verifizierung entfernen"}: ${profile.display_name ?? profile.user_id}`);
    if (!reason) return;
    setProfileActing(profile.user_id);
    try {
      await mutate("/api/admin/users", { targetUserId: profile.user_id, verified: nextValue, reason });
      setProfiles((items) => items.map((item) => item.user_id === profile.user_id ? { ...item, verified: nextValue } : item));
    } catch (error) { setActionMessage({ text: (error as Error).message, error: true }); }
    finally { setProfileActing(null); }
  }

  async function toggleListing(listing: Listing) {
    const nextValue = !listing.published;
    const label = nextValue ? "Inserat veröffentlichen" : "Inserat ausblenden";
    if (!window.confirm(`${label}? ${nextValue ? "Das Inserat wird öffentlich sichtbar." : "Das Inserat wird für Besucher verborgen."}`)) return;
    const reason = adminReason(`${label}: ${listing.title}`);
    if (!reason) return;
    setListingActing(listing.id);
    try {
      await mutate("/api/admin/listings", { listingId: listing.id, published: nextValue, reason });
      setListings((items) => items.map((item) => item.id === listing.id ? { ...item, published: nextValue } : item));
      setOverview((current) => current ? { ...current, recentListings: current.recentListings.map((item) => item.id === listing.id ? { ...item, published: nextValue } : item) } : current);
    } catch (error) { setActionMessage({ text: (error as Error).message, error: true }); }
    finally { setListingActing(null); }
  }

  async function toggleProject(project: AdminProject) {
    const nextValue = !project.verified;
    const reason = adminReason(`${nextValue ? "Projekt verifizieren" : "Projektverifizierung entfernen"}: ${project.title}`);
    if (!reason) return;
    setProjectActing(project.id);
    try {
      await mutate("/api/admin/projects", { projectId: project.id, verified: nextValue, reason });
      setProjects((items) => items.map((item) => item.id === project.id ? { ...item, verified: nextValue } : item));
    } catch (error) { setActionMessage({ text: (error as Error).message, error: true }); }
    finally { setProjectActing(null); }
  }

  async function loadCredits(projectId: string, page = 1) {
    setCreditsLoading(projectId);
    try {
      const data = await fetchJson<{ credits: AdminCredit[]; page: number; total: number }>(`/api/admin/project-credits?project_id=${encodeURIComponent(projectId)}&page=${page}`);
      setCredits((current) => ({ ...current, [projectId]: data.credits }));
      setCreditsPage(data.page);
      setCreditsTotal(data.total);
    } catch (error) { setActionMessage({ text: (error as Error).message, error: true }); }
    finally { setCreditsLoading(null); }
  }

  async function saveCredit(credit: AdminCredit) {
    const reason = adminReason(`Crewfunktion für ${credit.name} ändern`);
    if (!reason) return;
    setCreditActing(credit.id);
    try {
      await mutate("/api/admin/project-credits", { id: credit.id, role: editingRole, reason });
      setCredits((current) => Object.fromEntries(Object.entries(current).map(([projectId, rows]) => [projectId, rows.map((row) => row.id === credit.id ? { ...row, role: editingRole } : row)])));
      setEditingCredit(null);
    } catch (error) { setActionMessage({ text: (error as Error).message, error: true }); }
    finally { setCreditActing(null); }
  }

  async function deleteCredit(credit: AdminCredit) {
    if (!window.confirm(`Crewzuordnung von ${credit.name} endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    const reason = adminReason(`Crewzuordnung endgültig löschen: ${credit.name}`);
    if (!reason) return;
    setCreditActing(credit.id);
    try {
      await mutate(`/api/admin/project-credits?id=${encodeURIComponent(credit.id)}&confirm=true&reason=${encodeURIComponent(reason)}`, {}, "DELETE");
      const remaining = (credits[credit.project_id] ?? []).filter((row) => row.id !== credit.id);
      setCredits((current) => ({ ...current, [credit.project_id]: remaining }));
      setCreditsTotal((total) => Math.max(0, total - 1));
      if (!remaining.length && creditsPage > 1) await loadCredits(credit.project_id, creditsPage - 1);
    } catch (error) { setActionMessage({ text: (error as Error).message, error: true }); }
    finally { setCreditActing(null); }
  }

  async function checkMedia(url: string) {
    setMediaChecking(url);
    try {
      const result = await fetchJson<{ status: string; message?: string; httpStatus?: number; contentType?: string }>(`/api/admin/media/check?url=${encodeURIComponent(url)}`);
      setMediaChecks((current) => ({ ...current, [url]: result }));
    } catch (error) {
      setMediaChecks((current) => ({ ...current, [url]: { status: "check_failed", message: (error as Error).message } }));
    } finally { setMediaChecking(null); }
  }

  const labels = (activeTab === "overview" ? "Übersicht" : navItems.find((item) => item.id === activeTab)?.label) ?? "Admin";
  const pendingReports = overview?.counts.pendingReports ?? 0;
  const pendingVerifications = overview?.counts.pendingVerifications ?? 0;
  const companyClarificationsCount = overview?.counts.companyClarifications ?? 0;

  return (
    <div className="min-h-screen pt-16 lg:flex">
      <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-56 flex-col border-r border-border bg-bg-secondary lg:flex">
        <div className="border-b border-border p-4"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg border border-crimson/30 bg-crimson/20"><Shield size={16} className="text-crimson-light" /></div><div><p className="text-sm font-semibold text-text-primary">Adminbereich</p><p className="text-xs text-text-muted">CineGenius</p></div></div></div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ icon: Icon, label, id }) => {
            const badge = id === "reports" ? pendingReports : id === "verifications" ? pendingVerifications : id === "companies" ? companyClarificationsCount : 0;
            return <button key={id} onClick={() => setActiveTab(id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === id ? "border-l-2 border-crimson bg-crimson/10 pl-2.5 text-crimson-light" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}><Icon size={15} /><span className="flex-1 text-left">{label}</span>{badge > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-bg-primary">{badge}</span>}</button>;
          })}
        </nav>
        <div className="border-t border-border p-3"><p className="px-3 text-xs text-text-muted">Zugriff nur für Admins</p></div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-56">
        <header className="sticky top-16 z-30 border-b border-border bg-bg-primary/90 px-4 py-3 backdrop-blur-nav sm:px-6"><h1 className="font-display text-lg font-bold text-text-primary">{labels}</h1></header>
        <nav className="flex gap-2 overflow-x-auto border-b border-border bg-bg-primary px-4 py-2 lg:hidden">
          {navItems.map(({ label, id }) => <button key={id} onClick={() => setActiveTab(id)} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium ${activeTab === id ? "border-crimson/40 bg-crimson/10 text-crimson-light" : "border-border text-text-secondary"}`}>{label}</button>)}
        </nav>
        <div className="space-y-5 p-4 sm:p-6">
          {actionMessage && <div role={actionMessage.error ? "alert" : "status"} className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${actionMessage.error ? "border-gold/30 bg-gold/10 text-gold" : "border-success/30 bg-success/10 text-success"}`}><span>{actionMessage.text}</span><button aria-label="Meldung schließen" onClick={() => setActionMessage(null)}><X size={15} /></button></div>}

          {activeTab === "overview" && <div className="space-y-5">
            {overviewError && <ErrorBox text={overviewError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: "Offene Meldungen", value: overview?.counts.pendingReports, tab: "reports" as TabId, icon: ClipboardList, urgent: pendingReports > 0 },
                { label: "Offene Verifizierungen", value: overview?.counts.pendingVerifications, tab: "verifications" as TabId, icon: ShieldCheck, urgent: pendingVerifications > 0 },
                { label: "Firmenklärungsfälle", value: overview?.counts.companyClarifications, tab: "companies" as TabId, icon: Building2, urgent: companyClarificationsCount > 0 },
                { label: "Unveröffentlichte Inserate", value: overview?.counts.draftListings, tab: "listings" as TabId, icon: List, urgent: false },
              ].map(({ label, value, tab, icon: Icon, urgent }) => <button key={label} onClick={() => setActiveTab(tab)} className={`rounded-xl border p-4 text-left transition-colors hover:bg-bg-elevated ${urgent ? "border-gold/30 bg-gold/5" : "border-border bg-bg-secondary"}`}><span className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-text-muted"><span>{label}</span><Icon size={15} /></span><span className={`mt-2 block text-2xl font-bold font-display ${urgent ? "text-gold" : "text-text-primary"}`}>{overviewLoading ? "…" : (value ?? 0)}</span><span className="mt-1 block text-xs text-text-muted">Direkt zur Bearbeitung <ChevronRight className="inline" size={12} /></span></button>)}
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
              <Panel className="overflow-hidden"><div className="border-b border-border p-4"><h2 className="font-semibold text-text-primary">Neueste Inserate</h2><p className="mt-1 text-xs text-text-muted">Veröffentlichte Angebote und Entwürfe aus derselben Inseratstabelle.</p></div>
                {overviewLoading ? <p className="p-6 text-sm text-text-muted">Laden…</p> : !overview?.recentListings.length ? <p className="p-6 text-sm text-text-muted">Noch keine Inserate vorhanden.</p> : <div className="divide-y divide-border">{overview.recentListings.map((item) => <div key={item.id} className="flex min-w-0 items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm text-text-primary">{item.title}</p><p className="truncate text-xs text-text-muted">{typeLabels[item.type] ?? item.type} · {item.city || "Kein Ort"} · {new Date(item.created_at).toLocaleDateString("de-DE")}</p></div><StatusBadge tone={item.published ? "success" : "muted"}>{item.published ? "Öffentlich" : "Entwurf"}</StatusBadge></div>)}</div>}
              </Panel>
              <Panel className="p-4"><h2 className="font-semibold text-text-primary">Plattformbestand</h2><div className="mt-3 grid grid-cols-2 gap-3 text-sm">{[
                ["Profile", "profiles"], ["Firmen", "companies"], ["Inserate gesamt", "listings"], ["Locations", "locations"], ["Jobs", "jobs"], ["Crew / Talent", "crew"], ["Marktplatz", "marketplace"], ["Tiere", "animals"], ["Dienstleistungen", "services"], ["Projekte", "projects"], ["Aktuelle Aushänge", "communityPosts"], ["Buchungsanfragen", "bookings"], ["Bewertungen", "reviews"], ["Bewerbungen", "applications"],
              ].map(([label, key]) => <div key={key} className="flex justify-between gap-2 border-b border-border/70 pb-2"><span className="text-text-muted">{label}</span><strong className="text-text-primary">{overviewLoading ? "…" : (overview?.counts[key] ?? "—")}</strong></div>)}</div><p className="mt-4 rounded-lg border border-border bg-bg-elevated p-3 text-xs leading-relaxed text-text-muted">Es gibt derzeit keinen internen Supportfall-Posteingang und keine erfasste Zahlungs- oder Auszahlungsverwaltung. Buchungen sind Anfragen; die Plattformgebühr wird beim Anlegen mit 0 € gespeichert.</p></Panel>
            </div>
          </div>}

          {activeTab === "reports" && <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-text-muted">Meldungen über Profile, Inserate und Bewertungen. Private Nachrichten werden hier nicht durchsucht.</p><select value={reportsStatus} onChange={(e) => { setReportsStatus(e.target.value); setReportsPage(1); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"><option value="pending">Offen</option><option value="reviewed">Geprüft</option><option value="resolved">Abgeschlossen</option><option value="dismissed">Verworfen</option></select></div>
            {reportsError && <ErrorBox text={reportsError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {reportsLoading ? <p className="py-10 text-center text-sm text-text-muted">Meldungen werden geladen…</p> : reports.length === 0 ? <Empty title="Keine Meldungen in diesem Status" /> : <div className="space-y-3">{reports.map((report) => <Panel key={report.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-text-primary">{report.target_name ?? `Ziel ${report.target_id}`}</h2><StatusBadge tone="warning">{reasonLabels[report.reason] ?? report.reason}</StatusBadge><StatusBadge>{report.target_type}</StatusBadge></div><p className="mt-1 text-xs text-text-muted">Gemeldet von {report.reporter_name ?? report.reporter_id} · {new Date(report.created_at).toLocaleString("de-DE")}</p>{report.target_excerpt && <p className="mt-3 rounded-lg border border-border bg-bg-elevated p-3 text-sm text-text-secondary">{report.target_excerpt}</p>}{report.details && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-secondary">Zusatzinfo: {report.details}</p>}<p className="mt-2 break-all text-[11px] text-text-muted">Meldungs-ID: {report.id}</p></div>{report.target_href && <a href={report.target_href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold"><Eye size={12} /> Inhalt öffnen</a>}</div>{reportsStatus === "pending" && <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => changeReport(report, "reviewed")} className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold">Als geprüft markieren</button><button onClick={() => changeReport(report, "resolved")} className="rounded-lg border border-success/30 px-3 py-2 text-xs font-semibold text-success">Abschließen</button><button onClick={() => changeReport(report, "dismissed")} className="rounded-lg border border-border px-3 py-2 text-xs text-text-muted">Verwerfen</button></div>}</Panel>)}</div>}
            <Pager page={reportsPage} total={reportsTotal} pageSize={50} onPage={setReportsPage} />
          </div>}

          {activeTab === "verifications" && <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-text-secondary">Nur eingereichte Prüfungen werden gezeigt. Entscheidungen erfordern eine Begründung und werden im Adminprotokoll festgehalten.</div>
            {verificationsError && <ErrorBox text={verificationsError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {verificationsLoading ? <p className="py-10 text-center text-sm text-text-muted">Anfragen werden geladen…</p> : !verifications.length ? <Empty title="Keine offenen Verifizierungen" /> : <div className="space-y-2">{verifications.map((request) => <Panel key={request.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><a href={`/profile/${request.user_id}`} target="_blank" rel="noreferrer" className="font-medium text-text-primary hover:text-gold">{request.display_name ?? request.user_id}</a><p className="mt-1 text-xs text-text-muted">Eingereicht {new Date(request.submitted_at).toLocaleString("de-DE")} · Clerk-ID {request.user_id}</p>{request.notes && <p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-sm text-text-secondary">{request.notes}</p>}</div><div className="flex gap-2"><button disabled={verificationActing === request.id} onClick={() => changeVerification(request, "approve")} className="rounded-lg border border-success/30 px-3 py-2 text-xs font-semibold text-success disabled:opacity-50">Genehmigen</button><button disabled={verificationActing === request.id} onClick={() => changeVerification(request, "reject")} className="rounded-lg border border-crimson/30 px-3 py-2 text-xs font-semibold text-crimson-light disabled:opacity-50">Ablehnen</button></div></Panel>)}</div>}
            <Pager page={verificationsPage} total={verificationsTotal} pageSize={50} onPage={setVerificationsPage} />
          </div>}

          {activeTab === "users" && <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-text-secondary">Diese Liste enthält CineGenius-Profile und ihre Clerk-ID, nicht sämtliche Clerk-Konten. Verifizieren ändert nur das interne Profilkennzeichen; Konten sperren oder löschen wird hier nicht angeboten.</div>
            <div className="flex flex-wrap items-center gap-3"><div className="relative w-full max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={profilesSearch} onChange={(e) => { setProfilesSearch(e.target.value); setProfilesPage(1); }} placeholder="Name oder exakte Clerk-ID suchen…" className="w-full rounded-xl border border-border bg-bg-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted" /></div><span className="text-sm text-text-muted">{profilesTotal} Profile</span></div>
            {profilesError && <ErrorBox text={profilesError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {profilesLoading ? <p className="py-10 text-center text-sm text-text-muted">Profile werden geladen…</p> : !profiles.length ? <Empty title="Keine Profile gefunden" /> : <div className="space-y-2">{profiles.map((profile) => <Panel key={profile.user_id} className="flex flex-wrap items-center gap-3 p-4">{profile.avatar_url ? <Image src={profile.avatar_url} alt="" width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-full border border-border object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-elevated"><Users size={15} className="text-text-muted" /></div>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium text-text-primary">{profile.display_name ?? "Kein Name"}</p>{profile.verified && <BadgeCheck size={14} className="text-gold" />}</div><p className="truncate text-xs text-text-muted">{profile.location ?? "Kein Ort"}{profile.profile_types?.length ? ` · ${profile.profile_types.join(", ")}` : ""}</p><p className="truncate font-mono text-[10px] text-text-muted">Clerk-ID: {profile.user_id}</p></div><a href={`/profile/${profile.slug ?? profile.user_id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold"><Eye className="mr-1 inline" size={12} />Profil</a><SupportMessageAction targetType="profile" targetId={profile.user_id} /><button disabled={profileActing === profile.user_id} onClick={() => toggleProfile(profile)} className={`rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50 ${profile.verified ? "border-gold/30 text-gold" : "border-border text-text-muted hover:border-gold hover:text-gold"}`}>{profileActing === profile.user_id ? "Speichern…" : profile.verified ? "Verifiziert · entfernen" : "Verifizieren"}</button></Panel>)}</div>}
            <Pager page={profilesPage} total={profilesTotal} pageSize={50} onPage={setProfilesPage} />
          </div>}

          {activeTab === "companies" && <div className="space-y-5">
            <Panel className="overflow-hidden"><div className="border-b border-border p-4"><div className="flex items-center gap-2"><CircleAlert size={16} className="text-gold" /><h2 className="font-semibold text-text-primary">Klärungsfälle ohne bestätigte Firmenverantwortung</h2><StatusBadge tone={clarificationsTotal ? "warning" : "muted"}>{clarificationsTotal}</StatusBadge></div><p className="mt-1 text-xs text-text-muted">Normale Teambeitrittsanfragen bleiben bei der Firma. Diese Warteschlange enthält nur Fälle ohne erreichbares Inhaberprofil und ohne bestätigtes Adminteam. Hier wird nichts automatisch angenommen oder berechtigt.</p></div>
              {clarificationsError ? <div className="p-4"><ErrorBox text={clarificationsError} /></div> : !clarifications.length ? <p className="p-5 text-sm text-text-muted">Keine offenen Klärungsfälle.</p> : <div className="divide-y divide-border">{clarifications.map((request) => <div key={request.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0"><p className="font-medium text-text-primary">{request.company_name}</p><p className="mt-1 text-xs text-text-muted">Anfrage von <a href={`/profile/${request.user_id}`} target="_blank" rel="noreferrer" className="text-gold hover:underline">{request.requester_name ?? request.user_id}</a> · {new Date(request.created_at).toLocaleString("de-DE")}</p><p className="mt-2 text-sm text-text-secondary">Funktion: {(request.public_titles ?? []).join(" · ") || request.title || "Nicht angegeben"}</p>{request.request_message && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-muted">„{request.request_message}”</p>}<p className="mt-2 text-xs text-gold">Klärung nötig: kein bestätigter Ansprechpartner erkannt. Teamrolle und Zugriffsrechte bleiben unverändert.</p></div><a href={`mailto:support@cinegenius.co?subject=${encodeURIComponent(`Firmenzugehörigkeit klären: ${request.company_name}`)}&body=${encodeURIComponent(`Bitte Firmenzugehörigkeit prüfen. Firmen-ID: ${request.company_id}; Anfrage-ID: ${request.id}; Person-ID: ${request.user_id}.\n\nDie Plattform hat keine bestätigte Firmenverantwortung erkannt.`)}`} className="rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-gold">Klärung an Support vorbereiten</a></div>)}</div>}
              <div className="px-4 pb-4"><Pager page={clarificationsPage} total={clarificationsTotal} pageSize={25} onPage={setClarificationsPage} /></div>
            </Panel>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-text-primary">Firmenverzeichnis · {companiesTotal}</h2><div className="relative w-full max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={companiesSearch} onChange={(e) => { setCompaniesSearch(e.target.value); setCompaniesPage(1); }} placeholder="Firma oder Ort suchen…" className="w-full rounded-xl border border-border bg-bg-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted" /></div></div>
            {companiesError && <ErrorBox text={companiesError} />}
            {companiesLoading ? <p className="py-8 text-center text-sm text-text-muted">Firmen werden geladen…</p> : !companies.length ? <Empty title="Keine Firmen gefunden" /> : <div className="space-y-2">{companies.map((company) => <Panel key={company.id} className="flex flex-wrap items-center gap-3 p-4">{company.logo_url ? <Image src={company.logo_url} alt="" width={44} height={44} unoptimized className="h-11 w-11 rounded-lg border border-border object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-bg-elevated"><Building2 size={16} className="text-text-muted" /></div>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{company.name}</p><StatusBadge tone={company.published ? "success" : "muted"}>{company.published ? "Öffentlich" : "Entwurf"}</StatusBadge>{company.verified && <StatusBadge tone="success">Verifiziert</StatusBadge>}</div><p className="mt-1 text-xs text-text-muted">{company.city || "Kein Ort"} · {company.categories?.join(", ") || "Keine Branche"} · {company.member_count} bestätigte Teammitglieder · {company.pending_request_count} offene Anfragen</p><p className="mt-1 font-mono text-[10px] text-text-muted">Inhaber-ID: {company.owner_user_id}{company.owner_profile_missing ? " · Inhaberprofil fehlt" : company.owner_name ? ` · ${company.owner_name}` : ""}</p></div><a href={`/companies/${company.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold"><Eye className="mr-1 inline" size={12} />Profil</a><SupportMessageAction targetType="company" targetId={company.id} /></Panel>)}</div>}
            <Pager page={companiesPage} total={companiesTotal} pageSize={30} onPage={setCompaniesPage} />
          </div>}

          {activeTab === "listings" && <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-[220px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={listingsSearch} onChange={(e) => { setListingsSearch(e.target.value); setListingsPage(1); }} placeholder="Titel suchen…" className="w-full rounded-lg border border-border bg-bg-secondary py-2 pl-9 pr-3 text-sm text-text-primary" /></div><select value={listingsType} onChange={(e) => { setListingsType(e.target.value); setListingsPage(1); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"><option value="all">Alle Bereiche</option>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={listingsStatus} onChange={(e) => { setListingsStatus(e.target.value); setListingsPage(1); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"><option value="all">Alle Status</option><option value="published">Öffentlich</option><option value="draft">Entwurf / verborgen</option></select><span className="text-sm text-text-muted">{listingsTotal} Einträge</span></div>
            {listingsError && <ErrorBox text={listingsError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {listingsLoading ? <p className="py-10 text-center text-sm text-text-muted">Inserate werden geladen…</p> : !listings.length ? <Empty title="Keine Inserate in dieser Auswahl" /> : <div className="space-y-2">{listings.map((listing) => <Panel key={listing.id} className="p-4"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{listing.title}</p><StatusBadge tone={listing.published ? "success" : "muted"}>{listing.published ? "Öffentlich" : "Entwurf / verborgen"}</StatusBadge></div><p className="mt-1 text-xs text-text-muted">{typeLabels[listing.type] ?? listing.type} · {listing.city || "Kein Ort"} · {listing.priceLabel ?? (listing.price ? `${Number(listing.price).toLocaleString("de-DE")} €` : "Preis auf Anfrage")} · {new Date(listing.created_at).toLocaleDateString("de-DE")}</p><p className="mt-1 font-mono text-[10px] text-text-muted">ID {listing.id}</p></div>{listing.published && listing.detail_href && <a href={listing.detail_href} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold"><Eye className="mr-1 inline" size={12} />Öffentlich ansehen</a>}<button disabled={listingActing === listing.id} onClick={() => toggleListing(listing)} className={`rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50 ${listing.published ? "border-crimson/30 text-crimson-light" : "border-success/30 text-success"}`}>{listingActing === listing.id ? "Speichern…" : listing.published ? "Ausblenden" : "Veröffentlichen"}</button><SupportMessageAction targetType="listing" targetId={listing.id} /></div><ListingProviderControls listing={listing} onSaved={() => setRefreshKey((key) => key + 1)} onError={(text) => setActionMessage({ text, error: true })} />{!listing.detail_href && <p className="mt-2 text-xs text-crimson-light">Für diesen Angebotstyp ist keine öffentliche Detailadresse eingerichtet.</p>}</Panel>)}</div>}
            <Pager page={listingsPage} total={listingsTotal} pageSize={50} onPage={setListingsPage} />
          </div>}

          {activeTab === "projects" && <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full max-w-md"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input value={projectsSearch} onChange={(e) => { setProjectsSearch(e.target.value); setProjectsPage(1); }} placeholder="Projekt suchen…" className="w-full rounded-xl border border-border bg-bg-secondary py-2.5 pl-9 pr-3 text-sm text-text-primary" /></div><span className="text-sm text-text-muted">{projectsTotal} Projekte</span></div>
            {projectsError && <ErrorBox text={projectsError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {projectsLoading ? <p className="py-10 text-center text-sm text-text-muted">Projekte werden geladen…</p> : !projects.length ? <Empty title="Keine Projekte gefunden" /> : <div className="space-y-2">{projects.map((project) => <Panel key={project.id} className="overflow-hidden"><div className="flex flex-wrap items-center gap-3 p-4"><button aria-expanded={expandedProject === project.id} onClick={() => { const next = expandedProject === project.id ? null : project.id; setExpandedProject(next); if (next) { setCreditsPage(1); loadCredits(next, 1); } }} className="flex items-center gap-1 text-xs text-text-muted"><ChevronDown size={14} className={expandedProject === project.id ? "rotate-180" : ""} />{project.crew_count} Crew</button><div className="min-w-0 flex-1"><p className="truncate font-medium text-text-primary">{project.title}</p><p className="text-xs text-text-muted">{[project.type, project.year, project.director].filter(Boolean).join(" · ")} · {new Date(project.created_at).toLocaleDateString("de-DE")}</p></div><a href={`/projects/${project.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:border-gold hover:text-gold"><Eye className="mr-1 inline" size={12} />Projekt</a><button disabled={projectActing === project.id} onClick={() => toggleProject(project)} className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary disabled:opacity-50">{projectActing === project.id ? "Speichern…" : project.verified ? "Verifizierung entfernen" : "Verifizieren"}</button></div>
              {expandedProject === project.id && <div className="border-t border-border bg-bg-elevated">{creditsLoading === project.id ? <p className="p-4 text-xs text-text-muted">Crew wird geladen…</p> : !(credits[project.id] ?? []).length ? <p className="p-4 text-xs text-text-muted">Keine Crewzuordnungen.</p> : (credits[project.id] ?? []).map((credit) => <div key={credit.id} className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 last:border-0">{editingCredit === credit.id ? <><span className="min-w-[120px] text-xs text-text-secondary">{credit.name}</span><input value={editingRole} onChange={(event) => setEditingRole(event.target.value)} className="min-w-[160px] flex-1 rounded border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary" /><button onClick={() => saveCredit(credit)} disabled={creditActing === credit.id} className="text-success"><Check size={14} /></button><button onClick={() => setEditingCredit(null)} className="text-text-muted"><X size={14} /></button></> : <><span className="min-w-[120px] flex-1 text-xs text-text-primary">{credit.name} · <span className="text-text-muted">{credit.role.split("||")[0]}</span></span>{credit.type === "user" && credit.user_id && <a href={`/profile/${credit.user_id}`} target="_blank" rel="noreferrer" className="text-xs text-gold">Profil</a>}<button onClick={() => { setEditingCredit(credit.id); setEditingRole(credit.role.split("||")[0]); }} className="rounded border border-border px-2 py-1 text-[11px] text-text-secondary">Funktion ändern</button><button disabled={creditActing === credit.id} onClick={() => deleteCredit(credit)} className="rounded border border-crimson/30 px-2 py-1 text-[11px] text-crimson-light">Zuordnung löschen</button></>}</div>)}<div className="px-4 pb-3"><Pager page={creditsPage} total={creditsTotal} pageSize={50} onPage={(page) => loadCredits(project.id, page)} /></div></div>}
            </Panel>)}</div>}
            <Pager page={projectsPage} total={projectsTotal} pageSize={30} onPage={setProjectsPage} />
          </div>}

          {activeTab === "bookings" && <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-3xl text-sm text-text-muted">Nur Buchungsanfragen aus der vorhandenen Tabelle. In diesen Datensätzen ist keine Zahlungsabwicklung hinterlegt; Provision und Auszahlungen lassen sich daher nicht verwalten.</p><select value={bookingsStatus} onChange={(e) => { setBookingsStatus(e.target.value); setBookingsPage(1); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"><option value="all">Alle Status</option><option value="pending">Ausstehend</option><option value="confirmed">Bestätigt</option><option value="rejected">Abgelehnt</option></select></div>
            {bookingsError && <ErrorBox text={bookingsError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {bookingsLoading ? <p className="py-10 text-center text-sm text-text-muted">Buchungsanfragen werden geladen…</p> : !bookings.length ? <Empty title="Keine Buchungsanfragen gefunden" /> : <div className="space-y-2">{bookings.map((booking) => <Panel key={booking.id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-medium text-text-primary">{booking.listing_title}</p><p className="mt-1 text-xs text-text-muted">{booking.requester_name ?? "Profil nicht zugeordnet"} · {booking.ref} · {typeLabels[booking.listing_type] ?? booking.listing_type}</p><p className="mt-1 text-xs text-text-muted">{booking.start_date} bis {booking.end_date} · {booking.days} Tag(e) · Anfrage am {new Date(booking.created_at).toLocaleDateString("de-DE")}</p><p className="mt-1 font-mono text-[10px] text-text-muted">Clerk-ID: {booking.user_id}</p></div><StatusBadge tone={booking.status === "confirmed" ? "success" : booking.status === "pending" ? "warning" : "muted"}>{booking.status === "pending" ? "Ausstehend" : booking.status === "confirmed" ? "Bestätigt" : booking.status}</StatusBadge><div className="text-right"><p className="font-semibold text-text-primary">{Number(booking.total).toLocaleString("de-DE")} €</p><p className="text-[11px] text-text-muted">Plattformgebühr {Number(booking.platform_fee).toLocaleString("de-DE")} €</p></div></Panel>)}</div>}
            <Pager page={bookingsPage} total={bookingsTotal} pageSize={30} onPage={setBookingsPage} />
          </div>}

          {activeTab === "media" && <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-text-secondary">Prüfung ist lesend. Öffentliche Supabase-Storage- und Clerk-Bildadressen werden nur auf Knopfdruck per HEAD geprüft. 404 = Datei fehlt; 401/403 = Zugriffsproblem; 2xx = Datei erreichbar, ein verbleibender Fehler liegt eher bei Darstellung/Optimierung. Andere Hosts werden nicht automatisch abgerufen.</div>
            <div className="flex flex-wrap items-center gap-3"><select value={mediaType} onChange={(e) => { setMediaType(e.target.value); setMediaPage(1); }} className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"><option value="profiles">Profile und Portfolios</option><option value="companies">Firmenfotos</option><option value="listings">Inserate</option><option value="projects">Projekte</option></select><span className="text-sm text-text-muted">{mediaTotal} Datensätze</span></div>
            {mediaError && <ErrorBox text={mediaError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {mediaLoading ? <p className="py-10 text-center text-sm text-text-muted">Bildverweise werden geladen…</p> : !mediaEntities.length ? <Empty title="Keine Datensätze gefunden" /> : <div className="space-y-2">{mediaEntities.map((entity) => <Panel key={entity.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-text-primary">{entity.title}</p><p className="mt-1 font-mono text-[10px] text-text-muted">ID {entity.id} · {entity.published === true || entity.published === "published" ? "veröffentlicht" : "nicht als veröffentlicht markiert"}</p></div><StatusBadge tone={entity.media.length ? "success" : "warning"}>{entity.media.length ? `${entity.media.length} Bildreferenz(en)` : "Keine Bildreferenz"}</StatusBadge></div>{!entity.media.length ? <p className="mt-3 text-xs text-text-muted">In den bekannten Bildfeldern ist kein Bild verknüpft.</p> : <div className="mt-3 grid gap-2">{entity.media.map((url) => { const check = mediaChecks[url]; return <div key={url} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg-elevated p-2"><a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs text-text-secondary hover:text-gold">{url}</a><button disabled={mediaChecking === url} onClick={() => checkMedia(url)} className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-text-secondary disabled:opacity-50">{mediaChecking === url ? "Prüfe…" : "Erreichbarkeit prüfen"}</button>{check && <StatusBadge tone={check.status === "reachable" ? "success" : check.status === "external_reference" ? "muted" : "danger"}>{check.status === "reachable" ? `Erreichbar${check.contentType ? ` · ${check.contentType}` : ""}` : check.status === "missing_file" ? `Datei fehlt (${check.httpStatus})` : check.status === "access_problem" ? `Zugriffsproblem (${check.httpStatus})` : check.status === "external_reference" ? "Externe Quelle · manuell prüfen" : check.status === "connection_error" ? "Quelle nicht erreichbar" : check.message ?? check.status}</StatusBadge>}</div>; })}</div>}</Panel>)}</div>}
            <Pager page={mediaPage} total={mediaTotal} pageSize={25} onPage={setMediaPage} />
          </div>}

          {activeTab === "audit" && <div className="space-y-4">
            <div className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-text-secondary">Protokolliert werden Admin-ID, Zeitpunkt, Aktion, Datensatz, Begründung und Status. Es werden keine Passwörter, Codes, Sitzungstokens oder privaten Nachrichten protokolliert.</div>
            {auditError && <ErrorBox text={auditError} onRetry={() => setRefreshKey((key) => key + 1)} />}
            {auditLoading ? <p className="py-10 text-center text-sm text-text-muted">Adminaktionen werden geladen…</p> : !auditEntries.length ? <Empty title="Noch keine protokollierten Adminaktionen" /> : <div className="space-y-2">{auditEntries.map((entry) => <Panel key={entry.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-text-primary">{entry.action.replaceAll("_", " ")}</p><StatusBadge tone={entry.outcome === "succeeded" ? "success" : entry.outcome === "failed" ? "danger" : "warning"}>{entry.outcome}</StatusBadge></div><p className="mt-1 text-xs text-text-muted">{new Date(entry.created_at).toLocaleString("de-DE")} · Admin {entry.actor_user_id}</p><p className="mt-1 break-all font-mono text-[10px] text-text-muted">{entry.entity_type} · {entry.entity_id}</p><p className="mt-2 text-sm text-text-secondary">Begründung: {entry.reason}</p></div></div></Panel>)}</div>}
            <Pager page={auditPage} total={auditTotal} pageSize={50} onPage={setAuditPage} />
          </div>}

          {activeTab === "support" && <AdminSupportCenter />}
        </div>
      </main>
    </div>
  );
}
