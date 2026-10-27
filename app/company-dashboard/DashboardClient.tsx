"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2, LayoutDashboard, Package, Users, Settings,
  ExternalLink, Plus, Pencil, Trash2, Loader2, X, Check,
  Truck, Shield, CheckCircle,
  Clock, UserMinus, Crown, ArrowUpRight, ToggleLeft, ToggleRight,
  AlertCircle, Briefcase,
} from "lucide-react";
import {
  EQUIPMENT_CATEGORIES, EQUIPMENT_CATEGORY_BY_ID,
  CONDITION_LABELS, CONDITION_COLORS, SERVICE_TYPES, SERVICE_TYPE_BY_ID,
} from "@/lib/equipment-categories";
import { CompanyMemberInvitations } from "@/components/CompanyMemberInvitations";
import { canCompanyRoleManageTarget, normalizeCompanyPublicTitles, COMPANY_PUBLIC_TITLE_SUGGESTIONS } from "@/lib/company-roles";

// ─── Types ────────────────────────────────────────────────────────────────────

type Company = {
  id: string; slug: string; name: string; logo_url: string | null;
  city: string; categories: string[]; published: boolean;
  tagline: string | null; description: string | null;
  social_links: Record<string, string> | null;
};

type ServiceItem = {
  id: string; company_id: string; type: string; title: string;
  description: string | null; use_cases: string[]; price_on_request: boolean;
  price_note: string | null; order: number;
};

type EquipmentItem = {
  id: string; company_id: string; category: string; subcategory: string | null;
  name: string; brand: string | null; model: string | null; description: string | null;
  images: string[]; condition: string; available: boolean; price_day: number | null;
  price_week: number | null; price_on_request: boolean; currency: string;
  pickup_available: boolean; delivery_available: boolean; delivery_radius_km: number | null;
  shipping_available: boolean; insured: boolean; deposit_required: boolean;
  deposit_amount: number | null; quantity: number;
};

type Member = {
  id: string; user_id: string; role?: string; title: string | null; public_titles?: string[]; status: string;
  request_message?: string; created_at?: string;
  profile: { display_name: string; avatar_url: string | null; slug: string | null; role: string | null } | null;
};

type TitleChangeRequest = {
  id: string; company_id: string; company_member_id: string; user_id: string;
  requested_public_titles: string[]; current_public_titles: string[]; message: string;
  status: string; created_at: string;
  profile: { display_name: string; avatar_url: string | null; slug: string | null; role: string | null } | null;
};

type Tab = "overview" | "services" | "equipment" | "team";

// ─── Main component ────────────────────────────────────────────────────────────

export default function DashboardClient({ company, permissionRole, companyOptions = [] }: {
  company: Company;
  permissionRole: "owner" | "admin" | "editor" | "member";
  companyOptions?: Array<Pick<Company, "id" | "name" | "slug" | "logo_url" | "city">>;
}) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => searchParams.get("tab") === "team" ? "team" : "overview");
  const isOwner = permissionRole === "owner";
  const canManageTeam = permissionRole === "owner" || permissionRole === "admin";
  const canEditCompany = permissionRole !== "member";

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview",  label: "Übersicht",  icon: LayoutDashboard },
    { id: "services",  label: "Services",   icon: Briefcase },
    { id: "equipment", label: "Equipment",  icon: Package },
    { id: "team",      label: "Team",       icon: Users },
  ];

  return (
    <div className="pt-16 min-h-screen bg-bg-primary flex">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border bg-bg-secondary min-h-screen sticky top-16 self-start" style={{ height: "calc(100vh - 64px)" }}>

        {/* Company identity */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-14 h-9 rounded-lg bg-bg-elevated border border-border overflow-hidden flex items-center justify-center shrink-0">
              {company.logo_url
                ? <img src={company.logo_url} alt="" className="w-full h-full object-contain p-1" /> // eslint-disable-line @next/next/no-img-element
                : <Building2 size={16} className="text-text-muted" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{company.name}</p>
              <p className="text-[11px] text-text-muted">{company.city}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors text-left ${
                tab === id
                  ? "bg-gold/10 text-gold font-semibold"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              }`}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer links */}
        <div className="p-2 border-t border-border space-y-0.5">
          {canEditCompany && <Link href={`/company-setup?company_id=${company.id}`}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
            <Settings size={14} /> Einstellungen
          </Link>}
          <Link href={`/companies/${company.slug}`}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors">
            <ExternalLink size={14} /> Profil ansehen
          </Link>
        </div>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {companyOptions.length > 1 && (
          <div className="border-b border-border bg-bg-primary px-4 py-3 sm:px-6 lg:px-8">
            <label className="flex min-h-11 max-w-xl items-center gap-3 text-xs text-text-muted">
              <span className="shrink-0">Firma wechseln</span>
              <select value={company.id} onChange={(event) => window.location.assign(`/company-dashboard?company_id=${encodeURIComponent(event.target.value)}`)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary">
                {companyOptions.map((option) => <option key={option.id} value={option.id}>{option.name}{option.city ? ` · ${option.city}` : ""}</option>)}
              </select>
            </label>
          </div>
        )}

        {/* Mobile tab bar */}
        <div className="lg:hidden flex border-b border-border bg-bg-secondary overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm shrink-0 border-b-2 transition-colors ${
                tab === id
                  ? "border-gold text-gold font-semibold"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="p-6 lg:p-8 max-w-3xl">
          {tab === "overview"  && <OverviewTab company={company} setTab={setTab} canDelete={isOwner} />}
          {tab === "services"  && <ServicesTab companyId={company.id} canEdit={canEditCompany} />}
          {tab === "equipment" && <EquipmentTab companyId={company.id} canEdit={canEditCompany} />}
          {tab === "team"      && <TeamTab companyId={company.id} permissionRole={permissionRole} canManageTeam={canManageTeam} />}
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ company, setTab, canDelete }: { company: Company; setTab: (t: Tab) => void; canDelete: boolean }) {
  const [stats, setStats] = useState({ services: 0, equipment: 0, members: 0 });
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/company-services?company_id=${company.id}`).then(r => r.json()),
      fetch(`/api/company-equipment?company_id=${company.id}`).then(r => r.json()),
      fetch(`/api/company-members?company_id=${company.id}`).then(r => r.json()),
    ]).then(([sv, eq, tm]) => {
      setStats({
        services: sv.data?.length ?? 0,
        equipment: eq.data?.length ?? 0,
        members: (tm.data ?? []).filter((m: Member) => m.status === "accepted").length,
      });
    });
  }, [company.id]);

  const hasSocialLinks = !!(company.social_links && Object.values(company.social_links).some(v => v?.trim()));
  const checks = [
    { label: "Logo hochgeladen",          done: !!company.logo_url },
    { label: "Tagline / Beschreibung",    done: !!(company.tagline?.trim() || company.description?.trim()) },
    { label: "Mindestens 1 Service",      done: stats.services > 0 },
    { label: "Equipment eingetragen",     done: stats.equipment > 0 },
    { label: "Teammitglied hinzugefügt",  done: stats.members > 0 },
    { label: "Social-Media-Link gesetzt", done: hasSocialLinks },
    { label: "Profil veröffentlicht",     done: company.published },
  ];
  const score = Math.round((checks.filter(c => c.done).length / checks.length) * 100);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary mb-1">Übersicht</h1>
        <p className="text-sm text-text-muted">Verwalte dein Firmenprofil auf CineGenius.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Services",    value: stats.services,  tab: "services"  as Tab, icon: Briefcase },
          { label: "Equipment",   value: stats.equipment, tab: "equipment" as Tab, icon: Package },
          { label: "Teammitglieder", value: stats.members, tab: "team"     as Tab, icon: Users },
        ].map(({ label, value, tab, icon: Icon }) => (
          <button key={label} onClick={() => setTab(tab)}
            className="p-4 bg-bg-secondary border border-border rounded-xl text-left hover:border-gold/40 transition-colors group">
            <Icon size={16} className="text-text-muted mb-2 group-hover:text-gold transition-colors" />
            <p className="text-2xl font-bold text-text-primary">{value}</p>
            <p className="text-xs text-text-muted mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* Completeness */}
      <div className="bg-bg-secondary border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-text-primary">Profil-Vollständigkeit</p>
          <span className={`text-sm font-bold ${score === 100 ? "text-emerald-400" : "text-gold"}`}>{score}%</span>
        </div>
        <div className="w-full h-1.5 bg-bg-elevated rounded-full mb-4">
          <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${score}%` }} />
        </div>
        <div className="space-y-2">
          {checks.map(({ label, done }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              {done
                ? <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                : <AlertCircle size={14} className="text-text-muted shrink-0" />
              }
              <span className={done ? "text-text-secondary" : "text-text-muted"}>{label}</span>
              {!done && (
                <Link href="/company-setup" className="ml-auto text-xs text-gold hover:underline">
                  Hinzufügen
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setTab("services")}
          className="flex items-center gap-2 p-3 bg-bg-secondary border border-border rounded-xl text-sm text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
          <Plus size={14} /> Service hinzufügen
        </button>
        <button onClick={() => setTab("equipment")}
          className="flex items-center gap-2 p-3 bg-bg-secondary border border-border rounded-xl text-sm text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
          <Plus size={14} /> Equipment hinzufügen
        </button>
        <Link href="/company-setup"
          className="flex items-center gap-2 p-3 bg-bg-secondary border border-border rounded-xl text-sm text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
          <Settings size={14} /> Firmendaten bearbeiten
        </Link>
        <Link href={`/companies/${company.slug}`}
          className="flex items-center gap-2 p-3 bg-bg-secondary border border-border rounded-xl text-sm text-text-secondary hover:border-gold/40 hover:text-gold transition-colors">
          <ExternalLink size={14} /> Öffentliches Profil
        </Link>
      </div>

      {/* Danger zone */}
      {canDelete && <div className="border border-red-500/20 rounded-xl p-4 bg-red-500/5">
        <p className="text-sm font-semibold text-red-400 mb-1">Gefahrenzone</p>
        <p className="text-xs text-text-muted mb-3">
          Firma dauerhaft löschen — alle Services, Equipment und Teammitglieder werden entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
        </p>
        <button
          onClick={() => { setDeleteModal(true); setDeleteConfirm(""); setDeleteError(""); }}
          className="flex items-center gap-2 px-3 py-2 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={13} /> Firma löschen
        </button>
      </div>}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-secondary border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary">Firma löschen?</h3>
                <p className="text-xs text-text-muted">Nicht rückgängig zu machen</p>
              </div>
            </div>
            <p className="text-sm text-text-muted mb-4">
              Tippe <span className="font-bold text-text-primary">{company.name}</span> ein um zu bestätigen:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={company.name}
              className="w-full px-3 py-2.5 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50 transition-colors mb-3"
            />
            {deleteError && (
              <p className="text-xs text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModal(false)}
                className="flex-1 px-3 py-2.5 border border-border text-text-secondary rounded-xl text-sm hover:border-border-hover transition-colors"
              >
                Abbrechen
              </button>
              <button
                disabled={deleteConfirm !== company.name || deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError("");
                  try {
                    const res = await fetch("/api/companies", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: company.id }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error ?? "Fehler beim Löschen");
                    window.location.href = "/dashboard";
                  } catch (err: unknown) {
                    setDeleteError(err instanceof Error ? err.message : "Unbekannter Fehler");
                    setDeleting(false);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? "Löschen …" : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Services Tab ──────────────────────────────────────────────────────────────

const BLANK_SERVICE = { type: "equipment_rental", title: "", description: "", use_cases: [] as string[], price_on_request: true, price_note: "" };

function ServicesTab({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState(BLANK_SERVICE);
  const [usecaseInput, setUsecaseInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/company-services?company_id=${companyId}`)
      .then(r => r.json()).then(({ data }) => setItems(data ?? []))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setForm(BLANK_SERVICE);
    setUsecaseInput("");
    setError("");
    setView("form");
  }

  function openEdit(item: ServiceItem) {
    setEditing(item);
    setForm({ type: item.type, title: item.title, description: item.description ?? "", use_cases: item.use_cases ?? [], price_on_request: item.price_on_request, price_note: item.price_note ?? "" });
    setUsecaseInput("");
    setError("");
    setView("form");
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Titel ist Pflicht."); return; }
    setSaving(true); setError("");
    try {
      const body = editing
        ? { id: editing.id, ...form }
        : { company_id: companyId, ...form };
      const res = await fetch("/api/company-services", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { error: err } = await res.json();
      if (err) throw new Error(err);
      load();
      setView("list");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/company-services?id=${id}`, { method: "DELETE" });
    setItems(p => p.filter(x => x.id !== id));
  }

  if (view === "form" && canEdit) return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setView("list")} className="text-text-muted hover:text-text-primary transition-colors">
          <X size={18} />
        </button>
        <h2 className="font-display text-xl font-bold text-text-primary">
          {editing ? "Service bearbeiten" : "Service hinzufügen"}
        </h2>
      </div>

      <div className="space-y-4">
        <FormField label="Typ">
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors">
            {SERVICE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </FormField>

        <FormField label="Titel" required>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="z.B. Komplettes Lichtpaket ab 2 Tagen"
            className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
        </FormField>

        <FormField label="Beschreibung">
          <textarea rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Was ist enthalten? Für welche Produktionsgrößen geeignet?"
            className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors resize-none" />
        </FormField>

        <FormField label="Einsatzgebiete (optional)">
          <div className="space-y-2">
            {form.use_cases.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.use_cases.map(u => (
                  <span key={u} className="flex items-center gap-1 px-2.5 py-1 bg-bg-elevated border border-border rounded-full text-xs text-text-secondary">
                    {u}
                    <button onClick={() => setForm(p => ({ ...p, use_cases: p.use_cases.filter(x => x !== u) }))}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={usecaseInput} onChange={e => setUsecaseInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && usecaseInput.trim()) { e.preventDefault(); setForm(p => ({ ...p, use_cases: [...p.use_cases, usecaseInput.trim()] })); setUsecaseInput(""); }}}
                placeholder="z.B. Spielfilm, Werbung... (Enter)"
                className="flex-1 bg-bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors" />
            </div>
          </div>
        </FormField>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setForm(p => ({ ...p, price_on_request: !p.price_on_request }))}
            className="text-text-muted hover:text-gold transition-colors">
            {form.price_on_request ? <ToggleRight size={22} className="text-gold" /> : <ToggleLeft size={22} />}
          </button>
          <span className="text-sm text-text-secondary">Preis auf Anfrage</span>
        </div>

        {!form.price_on_request && (
          <FormField label="Preishinweis">
            <input value={form.price_note} onChange={e => setForm(p => ({ ...p, price_note: e.target.value }))}
              placeholder="z.B. ab 500 €/Tag, Pauschalpreise möglich"
              className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
          </FormField>
        )}
      </div>

      {error && <p className="text-sm text-crimson-light">{error}</p>}

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {editing ? "Speichern" : "Hinzufügen"}
        </button>
        <button onClick={() => setView("list")} className="px-4 py-2.5 text-sm text-text-muted hover:text-text-primary transition-colors">
          Abbrechen
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-text-primary">Services</h2>
          <p className="text-sm text-text-muted mt-0.5">Was bietet deine Firma an?</p>
        </div>
        {canEdit && <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors">
          <Plus size={14} /> Hinzufügen
        </button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gold" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Noch keine Services"
          description="Zeige der Filmbranche, was du anbietest."
          action={canEdit ? "Service hinzufügen" : undefined}
          onAction={canEdit ? openNew : undefined}
        />
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="flex items-start gap-4 p-4 bg-bg-secondary border border-border rounded-xl group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-text-muted px-2 py-0.5 bg-bg-elevated border border-border rounded-full">
                    {SERVICE_TYPE_BY_ID[item.type]?.label ?? item.type}
                  </span>
                  {!item.price_on_request && item.price_note && (
                    <span className="text-[10px] text-gold">{item.price_note}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                {item.description && <p className="text-xs text-text-muted mt-1 line-clamp-2">{item.description}</p>}
                {item.use_cases?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.use_cases.map(u => (
                      <span key={u} className="text-[10px] px-2 py-0.5 bg-bg-elevated rounded-full text-text-muted border border-border">{u}</span>
                    ))}
                  </div>
                )}
              </div>
              {canEdit && <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-gold transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-crimson/10 text-text-muted hover:text-crimson-light transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Equipment Tab ─────────────────────────────────────────────────────────────

const BLANK_EQUIPMENT = {
  category: "kamera", subcategory: "", name: "", brand: "", model: "",
  description: "", condition: "gut", available: true,
  price_day: "", price_week: "", price_on_request: true,
  pickup_available: false, delivery_available: false, delivery_radius_km: "",
  shipping_available: false, insured: false, deposit_required: false, deposit_amount: "",
  quantity: "1",
};

function EquipmentTab({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("alle");
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<EquipmentItem | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>(BLANK_EQUIPMENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/company-equipment?company_id=${companyId}`)
      .then(r => r.json()).then(({ data }) => setItems(data ?? []))
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const filtered = catFilter === "alle" ? items : items.filter(i => i.category === catFilter);
  const usedCats = [...new Set(items.map(i => i.category))];

  function openNew() {
    setEditing(null); setForm(BLANK_EQUIPMENT); setError(""); setView("form");
  }
  function openEdit(item: EquipmentItem) {
    setEditing(item);
    setForm({
      category: item.category, subcategory: item.subcategory ?? "",
      name: item.name, brand: item.brand ?? "", model: item.model ?? "",
      description: item.description ?? "", condition: item.condition,
      available: item.available, price_day: item.price_day?.toString() ?? "",
      price_week: item.price_week?.toString() ?? "", price_on_request: item.price_on_request,
      pickup_available: item.pickup_available, delivery_available: item.delivery_available,
      delivery_radius_km: item.delivery_radius_km?.toString() ?? "",
      shipping_available: item.shipping_available, insured: item.insured,
      deposit_required: item.deposit_required, deposit_amount: item.deposit_amount?.toString() ?? "",
      quantity: item.quantity.toString(),
    });
    setError(""); setView("form");
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name ist Pflicht."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        ...(editing ? { id: editing.id } : { company_id: companyId }),
        category: form.category,
        subcategory: form.subcategory || null,
        name: form.name.trim(),
        brand: form.brand || null,
        model: form.model || null,
        description: form.description || null,
        condition: form.condition,
        available: form.available,
        price_day: form.price_day ? Number(form.price_day) : null,
        price_week: form.price_week ? Number(form.price_week) : null,
        price_on_request: form.price_on_request,
        pickup_available: form.pickup_available,
        delivery_available: form.delivery_available,
        delivery_radius_km: form.delivery_radius_km ? Number(form.delivery_radius_km) : null,
        shipping_available: form.shipping_available,
        insured: form.insured,
        deposit_required: form.deposit_required,
        deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
        quantity: Number(form.quantity) || 1,
      };
      const res = await fetch("/api/company-equipment", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const { error: err } = await res.json();
      if (err) throw new Error(err);
      load(); setView("list");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/company-equipment?id=${id}`, { method: "DELETE" });
    setItems(p => p.filter(x => x.id !== id));
  }

  async function toggleAvailable(item: EquipmentItem) {
    await fetch("/api/company-equipment", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, available: !item.available }),
    });
    setItems(p => p.map(x => x.id === item.id ? { ...x, available: !x.available } : x));
  }

  const set = (k: string, v: unknown) => setForm((p: typeof BLANK_EQUIPMENT) => ({ ...p, [k]: v }));

  if (view === "form" && canEdit) return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setView("list")} className="text-text-muted hover:text-text-primary transition-colors"><X size={18} /></button>
        <h2 className="font-display text-xl font-bold text-text-primary">{editing ? "Equipment bearbeiten" : "Equipment hinzufügen"}</h2>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Kategorie" required>
            <select value={form.category} onChange={e => set("category", e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors">
              {EQUIPMENT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Unterkategorie">
            <input value={form.subcategory} onChange={e => set("subcategory", e.target.value)}
              placeholder="z.B. Zoom Lens, LED Panel"
              className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
          </FormField>
        </div>

        <FormField label="Name / Bezeichnung" required>
          <input value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="z.B. ARRI Alexa Mini LF"
            className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Marke">
            <input value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="z.B. ARRI"
              className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
          </FormField>
          <FormField label="Modell">
            <input value={form.model} onChange={e => set("model", e.target.value)} placeholder="z.B. Alexa Mini LF"
              className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Zustand">
            <select value={form.condition} onChange={e => set("condition", e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors">
              {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </FormField>
          <FormField label="Anzahl">
            <input type="number" min="1" value={form.quantity} onChange={e => set("quantity", e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
          </FormField>
        </div>

        <FormField label="Beschreibung">
          <textarea rows={2} value={form.description} onChange={e => set("description", e.target.value)}
            placeholder="Besonderheiten, Zubehör, Spezifikationen..."
            className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors resize-none" />
        </FormField>

        {/* Preise */}
        <div className="pt-2 border-t border-border">
          <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-semibold mb-3">Preise</p>
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => set("price_on_request", !form.price_on_request)} className="text-text-muted hover:text-gold transition-colors">
              {form.price_on_request ? <ToggleRight size={22} className="text-gold" /> : <ToggleLeft size={22} />}
            </button>
            <span className="text-sm text-text-secondary">Preis auf Anfrage</span>
          </div>
          {!form.price_on_request && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tagespreis (€)">
                <input type="number" value={form.price_day} onChange={e => set("price_day", e.target.value)} placeholder="0"
                  className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
              </FormField>
              <FormField label="Wochenpreis (€)">
                <input type="number" value={form.price_week} onChange={e => set("price_week", e.target.value)} placeholder="0"
                  className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
              </FormField>
            </div>
          )}
        </div>

        {/* Logistik */}
        <div className="pt-2 border-t border-border">
          <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-semibold mb-3">Logistik</p>
          <div className="space-y-2">
            {[
              { key: "pickup_available", label: "Abholung möglich" },
              { key: "delivery_available", label: "Lieferung möglich" },
              { key: "shipping_available", label: "Versand möglich" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <button onClick={() => set(key, !form[key])} className="text-text-muted hover:text-gold transition-colors">
                  {form[key] ? <ToggleRight size={20} className="text-gold" /> : <ToggleLeft size={20} />}
                </button>
                <span className="text-sm text-text-secondary">{label}</span>
              </div>
            ))}
            {form.delivery_available && (
              <FormField label="Lieferradius (km)">
                <input type="number" value={form.delivery_radius_km} onChange={e => set("delivery_radius_km", e.target.value)} placeholder="50"
                  className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
              </FormField>
            )}
          </div>
        </div>

        {/* Versicherung */}
        <div className="pt-2 border-t border-border">
          <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-semibold mb-3">Versicherung & Kaution</p>
          <div className="space-y-2">
            {[
              { key: "insured", label: "Versichert" },
              { key: "deposit_required", label: "Kaution erforderlich" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <button onClick={() => set(key, !form[key])} className="text-text-muted hover:text-gold transition-colors">
                  {form[key] ? <ToggleRight size={20} className="text-gold" /> : <ToggleLeft size={20} />}
                </button>
                <span className="text-sm text-text-secondary">{label}</span>
              </div>
            ))}
            {form.deposit_required && (
              <FormField label="Kautionsbetrag (€)">
                <input type="number" value={form.deposit_amount} onChange={e => set("deposit_amount", e.target.value)} placeholder="0"
                  className="w-full bg-bg-secondary border border-border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-gold transition-colors" />
              </FormField>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-crimson-light">{error}</p>}

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {editing ? "Speichern" : "Hinzufügen"}
        </button>
        <button onClick={() => setView("list")} className="px-4 py-2.5 text-sm text-text-muted hover:text-text-primary transition-colors">
          Abbrechen
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-text-primary">Equipment</h2>
          <p className="text-sm text-text-muted mt-0.5">{items.length} {items.length === 1 ? "Eintrag" : "Einträge"}</p>
        </div>
        {canEdit && <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors">
          <Plus size={14} /> Hinzufügen
        </button>}
      </div>

      {/* Category filter */}
      {usedCats.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {["alle", ...usedCats].map(cat => {
            const info = cat === "alle" ? null : EQUIPMENT_CATEGORY_BY_ID[cat];
            return (
              <button key={cat} onClick={() => setCatFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  catFilter === cat
                    ? "bg-gold/10 border-gold/30 text-gold"
                    : "bg-bg-secondary border-border text-text-muted hover:text-text-primary hover:border-border-hover"
                }`}>
                {info ? `${info.emoji} ${info.label}` : "Alle"}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gold" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={catFilter === "alle" ? "Noch kein Equipment" : "Nichts in dieser Kategorie"}
          description="Trage Equipment und Inventar ein, das du vermietest oder einsetzt."
          action={canEdit ? "Equipment hinzufügen" : undefined}
          onAction={canEdit ? openNew : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const cat = EQUIPMENT_CATEGORY_BY_ID[item.category];
            return (
              <div key={item.id} className="flex items-center gap-4 p-3.5 bg-bg-secondary border border-border rounded-xl group">
                <div className="w-8 h-8 rounded-lg bg-bg-elevated border border-border flex items-center justify-center shrink-0 text-base">
                  {cat?.emoji ?? "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text-primary truncate">{item.name}</p>
                    {item.brand && <span className="text-xs text-text-muted">{item.brand}</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CONDITION_COLORS[item.condition]}`}>
                      {CONDITION_LABELS[item.condition]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-text-muted">
                    {cat && <span>{cat.label}</span>}
                    {item.subcategory && <span>· {item.subcategory}</span>}
                    {!item.price_on_request && item.price_day && <span className="text-gold">· {item.price_day} €/Tag</span>}
                    {item.delivery_available && <span className="flex items-center gap-0.5"><Truck size={9} /> Lieferung</span>}
                    {item.insured && <span className="flex items-center gap-0.5"><Shield size={9} /> Versichert</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canEdit && <button onClick={() => toggleAvailable(item)} title={item.available ? "Verfügbar" : "Nicht verfügbar"}
                    className={`text-xs px-2 py-1 rounded-full border font-medium transition-colors ${item.available ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-text-muted bg-bg-elevated border-border"}`}>
                    {item.available ? "Verfügbar" : "Nicht verfügbar"}
                  </button>}
                  {canEdit && <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-gold transition-colors">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-crimson/10 text-text-muted hover:text-crimson-light transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Team Tab ──────────────────────────────────────────────────────────────────

function TeamTab({ companyId, permissionRole, canManageTeam }: { companyId: string; permissionRole: "owner" | "admin" | "editor" | "member"; canManageTeam: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [titleChangeRequests, setTitleChangeRequests] = useState<TitleChangeRequest[]>([]);
  const [teamView, setTeamView] = useState<"members" | "requests" | "invitations" | "add">(canManageTeam ? "requests" : "members");
  const [loading, setLoading] = useState(true);
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "member">("member");
  const [inviteTitles, setInviteTitles] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membersResponse, titleRequestsResponse] = await Promise.all([
        fetch(`/api/company-members?company_id=${companyId}`),
        canManageTeam ? fetch(`/api/company-member-title-change-requests?company_id=${companyId}`) : Promise.resolve(null),
      ]);
      const [memberResult, titleRequestResult] = await Promise.all([
        membersResponse.json().catch(() => ({})),
        titleRequestsResponse?.json().catch(() => ({})) ?? Promise.resolve({}),
      ]);
      if (!membersResponse.ok) throw new Error(memberResult.error ?? "Teamdaten konnten nicht geladen werden.");
      setMembers(memberResult.data ?? []);
      if (titleRequestsResponse?.ok) setTitleChangeRequests(titleRequestResult.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Teamdaten konnten nicht geladen werden.");
    } finally { setLoading(false); }
  }, [canManageTeam, companyId]);

  useEffect(() => { load(); }, [load]);

  const accepted = members.filter(m => m.status === "accepted").sort((a, b) => a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0);
  const pending  = members.filter(m => m.status === "pending");
  const requestCount = pending.length + titleChangeRequests.length;

  async function handleAccept(id: string, rawTitles: string) {
    const public_titles = normalizeCompanyPublicTitles(rawTitles);
    if (!public_titles.length) { setError("Bitte lege mindestens eine öffentliche Funktion fest."); return; }
    const response = await fetch("/api/company-members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "accepted", public_titles }) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); setError(result.error ?? "Anfrage konnte nicht bestätigt werden."); return; }
    const result = await response.json().catch(() => ({}));
    setMembers((current) => current.map((member) => member.id === id ? { ...member, status: "accepted", public_titles, title: public_titles[0] } : member));
    setNotice(result.data?.public_titles?.join(" · ") ? `Beitritt bestätigt. Freigegebene Funktion: ${result.data.public_titles.join(" · ")}.` : "Beitritt bestätigt.");
  }

  async function handleRemove(id: string) {
    const pendingRequest = members.some((member) => member.id === id && member.status === "pending");
    const response = await fetch(`/api/company-members?id=${id}`, { method: "DELETE" });
    if (!response.ok) { const result = await response.json().catch(() => ({})); setError(result.error ?? "Mitglied konnte nicht entfernt werden."); return; }
    setMembers((current) => current.filter((member) => member.id !== id));
    setNotice(pendingRequest ? "Beitrittsanfrage abgelehnt. Die Person wurde informiert." : "Mitglied wurde aus dem Team entfernt.");
  }

  async function handleRoleChange(id: string, role: string) {
    const response = await fetch("/api/company-members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, role }) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); setError(result.error ?? "Berechtigung konnte nicht geändert werden."); return; }
    setMembers((current) => current.map((member) => member.id === id ? { ...member, role } : member));
  }

  async function handleTitlesChange(id: string, rawTitles: string) {
    const public_titles = normalizeCompanyPublicTitles(rawTitles);
    const response = await fetch("/api/company-members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, public_titles }) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); setError(result.error ?? "Öffentliche Funktion konnte nicht gespeichert werden."); return; }
    setMembers((current) => current.map((member) => member.id === id ? { ...member, public_titles, title: public_titles[0] ?? null } : member));
  }

  async function handleTitleRequestDecision(id: string, status: "accepted" | "rejected", rawTitles = "") {
    const public_titles = status === "accepted" ? normalizeCompanyPublicTitles(rawTitles) : undefined;
    if (status === "accepted" && !public_titles?.length) { setError("Lege mindestens eine öffentliche Funktion fest."); return; }
    const response = await fetch("/api/company-member-title-change-requests", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, ...(public_titles ? { public_titles } : {}) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error ?? "Funktionsanfrage konnte nicht bearbeitet werden."); return; }
    setTitleChangeRequests((current) => current.filter((request) => request.id !== id));
    if (status === "accepted" && result.data?.company_member_id) {
      setMembers((current) => current.map((member) => member.id === result.data.company_member_id
        ? { ...member, public_titles: public_titles ?? [], title: public_titles?.[0] ?? null }
        : member));
    }
    setNotice(status === "accepted" ? "Funktionsänderung bestätigt. Die betroffene Person wurde informiert." : "Funktionsanfrage abgelehnt. Die bisherige Funktion bleibt bestehen.");
  }

  async function createInvite() {
    setInviteBusy(true); setError(""); setNotice(""); setInviteUrl("");
    try {
      const response = await fetch("/api/company-invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company_id: companyId, permission_role: inviteRole, public_titles: normalizeCompanyPublicTitles(inviteTitles) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Einladung konnte nicht erstellt werden.");
      setInviteUrl(result.invite_url);
      setNotice("Einladungslink erstellt. Er läuft in 14 Tagen ab und wird erst nach deiner Bestätigung als Teammitglied sichtbar.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Einladung konnte nicht erstellt werden."); }
    finally { setInviteBusy(false); }
  }

  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteUrl); setNotice("Einladungslink kopiert."); }
    catch { setError("Der Link konnte nicht kopiert werden. Du kannst ihn markieren und kopieren."); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gold" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-bold text-text-primary">Team</h2>
        <p className="text-sm text-text-muted mt-0.5">Öffentliche Funktion und Verwaltungsrechte werden getrennt verwaltet.</p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-crimson/20 bg-crimson/10 p-3 text-sm text-crimson-light">{error}</p>}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3" role="tablist" aria-label="Teamverwaltung">
        <button type="button" role="tab" aria-selected={teamView === "members"} onClick={() => setTeamView("members")}
          className={`min-h-11 rounded-lg px-4 text-sm font-medium ${teamView === "members" ? "bg-bg-elevated text-gold" : "text-text-muted hover:bg-bg-secondary hover:text-text-primary"}`}>
          Teammitglieder ({accepted.length})
        </button>
        {canManageTeam && <button type="button" role="tab" aria-selected={teamView === "requests"} onClick={() => setTeamView("requests")}
          className={`min-h-11 rounded-lg px-4 text-sm font-medium ${teamView === "requests" ? "bg-bg-elevated text-gold" : "text-text-muted hover:bg-bg-secondary hover:text-text-primary"}`}>
          Anfragen ({requestCount})
        </button>}
      </div>
      {canManageTeam && <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTeamView("add")} className="min-h-11 rounded-lg border border-gold/30 px-4 text-sm text-gold">Mitglied hinzufügen</button>
        <button type="button" onClick={() => setTeamView("invitations")} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary">Ausstehende Einladungen</button>
      </div>}
      {canManageTeam && (teamView === "add" || teamView === "invitations") && <CompanyMemberInvitations companyId={companyId} mode={teamView === "add" ? "add" : "list"} />}
      {canManageTeam && <datalist id="company-public-title-options">{COMPANY_PUBLIC_TITLE_SUGGESTIONS.map((title) => <option key={title} value={title} />)}</datalist>}

      {notice && <p role="status" className="rounded-xl border border-success/20 bg-success/5 p-3 text-sm text-success">{notice}</p>}

      {teamView === "requests" && canManageTeam && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-amber-400 font-semibold mb-3 flex items-center gap-1.5">
            <Clock size={10} /> Ausstehende Firmenanfragen ({requestCount})
          </p>
          {requestCount === 0 ? <p className="rounded-xl border border-border bg-bg-secondary p-4 text-sm text-text-muted">Zurzeit gibt es keine offenen Anfragen.</p> : <div className="space-y-3">
            {pending.map((member) => <JoinRequestCard key={member.id} member={member}
              onAccept={(titles) => void handleAccept(member.id, titles)} onReject={() => void handleRemove(member.id)} />)}
            {titleChangeRequests.map((request) => <TitleChangeRequestCard key={request.id} request={request}
              onAccept={(titles) => void handleTitleRequestDecision(request.id, "accepted", titles)}
              onReject={() => void handleTitleRequestDecision(request.id, "rejected")} />)}
          </div>}
        </div>
      )}

      {teamView === "add" && canManageTeam && <details className="space-y-3 rounded-xl border border-border bg-bg-secondary p-4">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-text-primary">Person ohne Konto per privatem Link einladen</summary>
        <p className="text-xs leading-5 text-text-muted">Erstelle einen privaten, einmal verwendbaren Link. Die eingeladene Person kann sich anmelden oder neu registrieren; du bestätigst danach den Beitritt. Der Link wird nicht automatisch per E-Mail versendet.</p>
        <label className="block text-xs text-text-secondary">CineGenius-Funktion (optional, mehrere mit Komma trennen)<input list="company-public-title-options" value={inviteTitles} onChange={(event) => setInviteTitles(event.target.value)} maxLength={400} placeholder="z.B. Catering-Leitung, Setkoch" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary" /></label>
        <label className="block text-xs text-text-secondary">Verwaltungsrecht<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "admin" | "editor" | "member")} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary"><option value="member">Teammitglied – ansehen</option><option value="editor">Bearbeiter/in – Firmendaten und Angebote bearbeiten</option>{permissionRole === "owner" && <option value="admin">Administrator/in – Team verwalten</option>}</select></label>
        <button onClick={() => void createInvite()} disabled={inviteBusy} className="min-h-11 rounded-lg bg-gold px-4 text-sm font-bold text-bg-primary disabled:opacity-50">{inviteBusy ? "Wird erstellt …" : "Einladungslink erstellen"}</button>
        {inviteUrl && <div className="space-y-2"><input readOnly value={inviteUrl} aria-label="Einladungslink" className="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-xs text-text-primary" /><button onClick={() => void copyInvite()} className="min-h-10 rounded-lg border border-border px-3 text-xs text-gold">Link kopieren</button></div>}
        {notice && <p role="status" className="text-xs text-success">{notice}</p>}
      </details>}
      {teamView === "members" && <div className="space-y-6">
        <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-semibold mb-3">
          Aktive Mitglieder ({accepted.length})
        </p>
        {accepted.length === 0 ? (
          <p className="text-sm text-text-muted">Noch keine Mitglieder. Mitglieder können auf dem öffentlichen Firmenprofil beitreten.</p>
        ) : (
          <div className="space-y-2">
            {accepted.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3.5 bg-bg-secondary border border-border rounded-xl group">
                <MemberAvatar member={m} size={38} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${m.profile?.slug ?? m.user_id}`}
                      className="text-sm font-semibold text-text-primary hover:text-gold transition-colors truncate flex items-center gap-1">
                      {m.profile?.display_name ?? "Unbekannt"}
                      <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                    </Link>
                    {m.role === "owner" && <Crown size={11} className="text-gold shrink-0" />}
                  </div>
                  <p className="text-xs text-text-muted truncate">Öffentliche Funktion: {(m.public_titles?.length ? m.public_titles : m.title ? [m.title] : []).join(" · ") || "noch nicht angegeben"}</p>
                  {canManageTeam && <PublicTitlesEditor member={m} onSave={(value) => void handleTitlesChange(m.id, value)} />}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                {permissionRole === "owner" && m.role !== "owner" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)}
                      aria-label={`Verwaltungsrechte für ${m.profile?.display_name ?? "Mitglied"}`}
                      className="text-xs bg-bg-elevated border border-border rounded-lg px-2 py-2 focus:outline-none focus:border-gold transition-colors">
                      <option value="admin">Administrator</option>
                      <option value="editor">Bearbeiter/in</option>
                      <option value="member">Teammitglied</option>
                    </select>
                  </div>
                )}
                {m.role !== "owner" && canCompanyRoleManageTarget(permissionRole, m.role) && <button onClick={() => void handleRemove(m.id)} aria-label={`${m.profile?.display_name ?? "Mitglied"} entfernen`} className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-crimson/10 hover:text-crimson-light"><UserMinus size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>


      </div>}
    </div>
  );
}

function JoinRequestCard({ member, onAccept, onReject }: { member: Member; onAccept: (titles: string) => void; onReject: () => void }) {
  const [titles, setTitles] = useState((member.public_titles?.length ? member.public_titles : member.title ? [member.title] : []).join(", "));
  const name = member.profile?.display_name ?? "Unbekannt";
  const profileHref = `/profile/${member.profile?.slug ?? member.user_id}`;
  return (
    <article className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <MemberAvatar member={member} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={profileHref} className="text-sm font-semibold text-text-primary hover:text-gold">{name}</Link>
            <span className="text-[11px] text-amber-400">Ausstehend{member.created_at ? ` · ${formatRequestDate(member.created_at)}` : ""}</span>
          </div>
          {member.profile?.role && <p className="text-xs text-text-muted">{member.profile.role}</p>}
        </div>
      </div>
      {member.request_message && <p className="rounded-lg border border-border bg-bg-primary/60 p-3 text-sm leading-relaxed text-text-secondary">„{member.request_message}“</p>}
      <label className="block text-xs text-text-secondary">
        Funktion(en) für die Freigabe überprüfen oder anpassen
        <input list="company-public-title-options" value={titles} onChange={(event) => setTitles(event.target.value)} maxLength={400}
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary" />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onReject} className="min-h-11 rounded-lg px-3 text-sm text-text-muted hover:bg-crimson/10 hover:text-crimson-light">Ablehnen</button>
        <button type="button" onClick={() => onAccept(titles)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-success/10 px-3 text-sm font-semibold text-success hover:bg-success/20"><Check size={14} /> Annehmen</button>
      </div>
    </article>
  );
}

function TitleChangeRequestCard({ request, onAccept, onReject }: { request: TitleChangeRequest; onAccept: (titles: string) => void; onReject: () => void }) {
  const [titles, setTitles] = useState(request.requested_public_titles.join(", "));
  const name = request.profile?.display_name ?? "Unbekannt";
  return (
    <article className="space-y-3 rounded-xl border border-border bg-bg-secondary p-4">
      <div className="flex items-start gap-3">
        <MemberAvatar member={{ ...request, title: null, public_titles: request.requested_public_titles, status: request.status }} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/profile/${request.profile?.slug ?? request.user_id}`} className="text-sm font-semibold text-text-primary hover:text-gold">{name}</Link>
            <span className="text-[11px] text-amber-400">Ausstehend · {formatRequestDate(request.created_at)}</span>
          </div>
          <p className="mt-1 text-xs text-text-muted">Bisher bestätigt: {request.current_public_titles.join(" · ") || "keine Funktion hinterlegt"}</p>
        </div>
      </div>
      {request.message && <p className="rounded-lg border border-border bg-bg-primary/60 p-3 text-sm leading-relaxed text-text-secondary">„{request.message}“</p>}
      <label className="block text-xs text-text-secondary">
        Neue Funktion(en) prüfen oder anpassen
        <input list="company-public-title-options" value={titles} onChange={(event) => setTitles(event.target.value)} maxLength={400}
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary" />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onReject} className="min-h-11 rounded-lg px-3 text-sm text-text-muted hover:bg-crimson/10 hover:text-crimson-light">Ablehnen</button>
        <button type="button" onClick={() => onAccept(titles)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-success/10 px-3 text-sm font-semibold text-success hover:bg-success/20"><Check size={14} /> Annehmen</button>
      </div>
    </article>
  );
}

function formatRequestDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Datum unbekannt" : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}

function PublicTitlesEditor({ member, onSave }: { member: Member; onSave: (value: string) => void }) {
  const [value, setValue] = useState((member.public_titles?.length ? member.public_titles : member.title ? [member.title] : []).join(", "));
  return <label className="mt-2 block text-[11px] text-text-muted">Funktion(en), öffentlich sichtbar<input list="company-public-title-options" value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => onSave(value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSave(value); } }} maxLength={400} placeholder="z.B. Technische Leitung, Oberbeleuchter" className="mt-1 min-h-10 w-full rounded-lg border border-border bg-bg-primary px-3 text-xs text-text-primary" /></label>;
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-semibold block mb-1.5">
        {label}{required && <span className="text-crimson-light ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action, onAction }: {
  icon: React.ElementType; title: string; description: string; action?: string; onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center mb-4">
        <Icon size={20} className="text-text-muted" />
      </div>
      <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
      <p className={`text-xs text-text-muted max-w-xs ${action ? "mb-5" : ""}`}>{description}</p>
      {action && onAction && <button onClick={onAction}
        className="flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary rounded-xl text-sm font-semibold hover:bg-gold-light transition-colors">
        <Plus size={14} /> {action}
      </button>}
    </div>
  );
}

function MemberAvatar({ member, size = 40 }: { member: Member; size?: number }) {
  const name = member.profile?.display_name ?? "?";
  return (
    <div className="rounded-full bg-bg-elevated border border-border overflow-hidden shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, minWidth: size }}>
      {member.profile?.avatar_url
        ? <img src={member.profile.avatar_url} alt={name} className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
        : <span className="text-xs font-bold text-text-muted">{name[0]?.toUpperCase()}</span>
      }
    </div>
  );
}
