"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard, DollarSign, Percent, Users, List, BarChart2,
  TrendingUp, CheckCircle, Eye,
  Save, Shield, Settings, ChevronRight, ArrowDownCircle,
  Plus, Minus, Wallet, ShieldCheck,
  Activity, Film, Package,
  Briefcase, FileCheck,
} from "lucide-react";
import {
  defaultTiers, CommissionTier, calculateCommission,
} from "@/lib/commission";

const navItems = [
  { icon: LayoutDashboard, label: "Übersicht",      id: "overview" },
  { icon: BarChart2,       label: "Analytics",       id: "analytics" },
  { icon: ShieldCheck,     label: "Verifizierungen", id: "verifications" },
  { icon: Percent,         label: "Provision",       id: "commission" },
  { icon: ArrowDownCircle, label: "Auszahlungen",    id: "payouts" },
  { icon: Users,           label: "Benutzer",        id: "users" },
  { icon: List,            label: "Inserate",        id: "listings" },
  { icon: DollarSign,      label: "Transaktionen",   id: "transactions" },
];


type RealListing = { id: string; type: string; title: string; city: string; price: number; published: boolean; created_at: string };
type VerifRequest = { id: string; user_id: string; display_name: string | null; status: string; notes: string | null; submitted_at: string; reviewed_at: string | null };






export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [tiers, setTiers] = useState<CommissionTier[]>(defaultTiers);
  const [saved, setSaved] = useState(false);
  const [previewAmount, setPreviewAmount] = useState(500);

  const [listings, setListings] = useState<RealListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [verifRequests, setVerifRequests] = useState<VerifRequest[]>([]);
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifActing, setVerifActing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/listings")
      .then((r) => r.json())
      .then(({ data }) => setListings(data ?? []))
      .catch(() => {})
      .finally(() => setListingsLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "verifications") return;
    setVerifLoading(true);
    fetch("/api/verification-requests")
      .then((r) => r.json())
      .then(({ data }) => setVerifRequests(data ?? []))
      .catch(() => {})
      .finally(() => setVerifLoading(false));
  }, [activeTab]);

  const handleVerifAction = async (requestId: string, action: "approve" | "reject") => {
    setVerifActing(requestId);
    try {
      await fetch("/api/verification-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      setVerifRequests((prev) =>
        prev.map((r) => r.id === requestId ? { ...r, status: action === "approve" ? "approved" : "rejected", reviewed_at: new Date().toISOString() } : r)
      );
    } finally {
      setVerifActing(null);
    }
  };

  const typeLabel: Record<string, string> = {
    location: "Drehort", prop: "Requisite", vehicle: "Fahrzeug", job: "Job", creator: "Crew",
  };

  const previewCalc = calculateCommission(previewAmount, tiers);

  const handleSaveCommission = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="pt-16 min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-56 border-r border-border bg-bg-secondary flex-col fixed left-0 top-16 bottom-0 z-40">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-crimson/20 border border-crimson/30 flex items-center justify-center">
              <Shield size={16} className="text-crimson-light" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Admin Panel</p>
              <p className="text-xs text-text-muted">CineGenius</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ icon: Icon, label, id }) => {
              const pendingCount = id === "verifications" ? verifRequests.filter((r) => r.status === "pending").length : 0;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === id
                      ? "bg-crimson/10 text-crimson-light border-l-2 border-crimson pl-2.5"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                  }`}
                >
                  <Icon size={15} />
                  <span className="flex-1 text-left">{label}</span>
                  {pendingCount > 0 && (
                    <span className="w-5 h-5 bg-gold text-bg-primary text-[10px] font-bold rounded-full flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>
        <div className="p-3 border-t border-border">
          <p className="text-xs text-text-muted px-3">v1.0.0 · Admin</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-56">
        <div className="sticky top-16 z-30 bg-bg-primary/80 backdrop-blur-nav border-b border-border px-6 py-3">
          <h1 className="font-display text-lg font-bold text-text-primary">
            {navItems.find(n => n.id === activeTab)?.label ?? "Admin"}
          </h1>
        </div>

        <div className="p-6">
          {/* ── ÜBERSICHT ── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: List,      label: "Aktive Inserate",          value: listingsLoading ? "…" : String(listings.filter(l => l.published).length), sub: `${listings.length} gesamt`, color: "text-gold" },
                  { icon: Film,      label: "Drehorte",                 value: listingsLoading ? "…" : String(listings.filter(l => l.type === "location").length), sub: "Inserate", color: "text-sky-400" },
                  { icon: Briefcase, label: "Jobs & Crew",              value: listingsLoading ? "…" : String(listings.filter(l => l.type === "job" || l.type === "creator").length), sub: "Inserate", color: "text-emerald-400" },
                  { icon: Package,   label: "Marktplatz",               value: listingsLoading ? "…" : String(listings.filter(l => l.type === "prop" || l.type === "vehicle").length), sub: "Inserate", color: "text-violet-400" },
                ].map(({ icon: Icon, label, value, sub, color }) => (
                  <div key={label} className="p-5 rounded-xl border border-border bg-bg-secondary">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-text-muted uppercase tracking-widest leading-tight">{label}</span>
                      <div className="w-7 h-7 rounded-md bg-gold/10 flex items-center justify-center">
                        <Icon size={14} className={color} />
                      </div>
                    </div>
                    <div className={`text-2xl font-bold font-display mb-1 ${color}`}>{value}</div>
                    <div className="text-xs text-text-muted">{sub}</div>
                  </div>
                ))}
              </div>

              {/* Recent Listings */}
              <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-border">
                  <h2 className="font-semibold text-text-primary">Neueste Inserate</h2>
                  <button onClick={() => setActiveTab("listings")} className="text-xs text-gold flex items-center gap-1">
                    Alle <ChevronRight size={12} />
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {listingsLoading && (
                    <div className="px-5 py-8 text-center text-xs text-text-muted">Laden…</div>
                  )}
                  {!listingsLoading && listings.length === 0 && (
                    <div className="px-5 py-8 text-center text-xs text-text-muted">Noch keine Inserate</div>
                  )}
                  {listings.slice(0, 5).map((l) => (
                    <div key={l.id} className="flex items-center gap-4 px-5 py-3 hover:bg-bg-elevated transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{l.title}</p>
                        <p className="text-xs text-text-muted">{typeLabel[l.type] ?? l.type} · {l.city}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium shrink-0 ${l.published ? "text-success border-success/30 bg-success/10" : "text-text-muted border-border bg-bg-elevated"}`}>
                        {l.published ? "Aktiv" : "Inaktiv"}
                      </span>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-gold font-mono">{l.price > 0 ? `${l.price.toLocaleString()} €` : "Auf Anfrage"}</p>
                        <p className="text-xs text-text-muted">{new Date(l.created_at).toLocaleDateString("de-DE")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── PROVISION (GESTAFFELT) ── */}
          {activeTab === "commission" && (
            <div className="space-y-6 max-w-3xl">
              {saved && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
                  <CheckCircle size={15} /> Provisionsstaffelung gespeichert!
                </div>
              )}

              {/* Info */}
              <div className="p-4 bg-bg-elevated border border-border rounded-xl text-sm text-text-secondary leading-relaxed">
                <p className="font-semibold text-text-primary mb-1">Gestaffelte Provisionen</p>
                Das System wählt automatisch den passenden Provisionssatz anhand des Buchungsbetrags.
                Niedrigere Beträge tragen eine höhere Rate, große Buchungen eine günstigere — das schützt das Plattformvolumen.
              </div>

              {/* Staffelungstabelle */}
              <div className="p-6 rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-text-primary">Provisionsstaffeln</h2>
                  <button
                    onClick={() => setTiers(prev => [...prev, {
                      id: `t${Date.now()}`, label: "Neue Staffel",
                      minAmount: 0, maxAmount: null, rate: 10, active: true,
                    }])}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gold/30 text-gold text-xs font-semibold rounded-lg hover:bg-gold-subtle transition-colors"
                  >
                    <Plus size={12} /> Staffel hinzufügen
                  </button>
                </div>

                <div className="space-y-3">
                  {tiers.map((tier, i) => (
                    <div key={tier.id} className={`grid grid-cols-[1fr_100px_100px_80px_80px_36px] gap-3 items-center p-3 rounded-xl border transition-colors ${
                      tier.active ? "border-border bg-bg-elevated" : "border-border/50 bg-bg-elevated/50 opacity-60"
                    }`}>
                      {/* Label */}
                      <input
                        value={tier.label}
                        onChange={e => setTiers(p => p.map((t, j) => j === i ? {...t, label: e.target.value} : t))}
                        className="bg-transparent border-b border-border text-sm font-medium text-text-primary focus:outline-none focus:border-gold pb-0.5 transition-colors"
                        placeholder="Bezeichnung"
                      />
                      {/* Min */}
                      <div className="relative">
                        <input
                          type="number" min={0}
                          value={tier.minAmount}
                          onChange={e => setTiers(p => p.map((t, j) => j === i ? {...t, minAmount: Number(e.target.value)} : t))}
                          className="w-full bg-bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors pr-5"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">€</span>
                      </div>
                      {/* Max */}
                      <div className="relative">
                        <input
                          type="number" min={0}
                          value={tier.maxAmount ?? ""}
                          onChange={e => setTiers(p => p.map((t, j) => j === i ? {...t, maxAmount: e.target.value === "" ? null : Number(e.target.value)} : t))}
                          placeholder="∞"
                          className="w-full bg-bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-gold transition-colors pr-5"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">€</span>
                      </div>
                      {/* Rate */}
                      <div className="relative">
                        <input
                          type="number" min={0} max={50} step={0.5}
                          value={tier.rate}
                          onChange={e => setTiers(p => p.map((t, j) => j === i ? {...t, rate: Number(e.target.value)} : t))}
                          className="w-full bg-bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm font-bold text-gold focus:outline-none focus:border-gold transition-colors pr-5"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gold">%</span>
                      </div>
                      {/* Active toggle */}
                      <button
                        onClick={() => setTiers(p => p.map((t, j) => j === i ? {...t, active: !t.active} : t))}
                        className={`text-xs px-2 py-1.5 rounded-lg border font-medium transition-colors ${
                          tier.active
                            ? "border-success/30 text-success bg-success/10"
                            : "border-border text-text-muted bg-bg-secondary"
                        }`}
                      >
                        {tier.active ? "Aktiv" : "Aus"}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => setTiers(p => p.filter((_, j) => j !== i))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:border-crimson/40 hover:text-crimson-light transition-colors"
                      >
                        <Minus size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Column labels */}
                <div className="grid grid-cols-[1fr_100px_100px_80px_80px_36px] gap-3 mt-2 px-3">
                  {["Bezeichnung", "Ab (€)", "Bis (€)", "Satz", "Status", ""].map(h => (
                    <p key={h} className="text-[10px] uppercase tracking-widest text-text-muted">{h}</p>
                  ))}
                </div>
              </div>

              {/* Live-Rechner */}
              <div className="p-6 rounded-xl border border-gold/20 bg-gold-subtle">
                <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Settings size={15} className="text-gold" /> Live-Rechner
                </h2>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={previewAmount}
                      onChange={e => setPreviewAmount(Number(e.target.value))}
                      min={0}
                      className="w-full bg-bg-secondary border border-border rounded-xl py-3 px-4 pr-8 text-lg font-bold text-text-primary focus:outline-none focus:border-gold transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-bold">€</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-bg-secondary border border-border rounded-xl text-center">
                    <p className="text-xs text-text-muted mb-1">Buchungsbetrag</p>
                    <p className="text-lg font-bold text-text-primary font-display">{previewAmount.toLocaleString()} €</p>
                  </div>
                  <div className="p-3 bg-bg-secondary border border-border rounded-xl text-center">
                    <p className="text-xs text-text-muted mb-1">Provision ({previewCalc.rate} %)</p>
                    <p className="text-lg font-bold text-gold font-display">{previewCalc.commission.toLocaleString()} €</p>
                  </div>
                  <div className="p-3 bg-bg-secondary border border-border rounded-xl text-center">
                    <p className="text-xs text-text-muted mb-1">Auszahlung Anbieter</p>
                    <p className="text-lg font-bold text-success font-display">{previewCalc.payout.toLocaleString()} €</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}
                className="flex items-center gap-2 px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors"
              >
                <Save size={15} /> Staffelung speichern
              </button>
            </div>
          )}

          {/* ── AUSZAHLUNGEN ── */}
          {activeTab === "payouts" && (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl space-y-3">
              <Wallet size={32} className="text-text-muted mx-auto opacity-30" />
              <p className="font-semibold text-text-primary">Noch keine Auszahlungen</p>
              <p className="text-sm text-text-muted max-w-sm mx-auto">
                Auszahlungsdaten erscheinen hier sobald die Stripe-Zahlungsanbindung aktiv ist.
              </p>
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {activeTab === "analytics" && (() => {
            const typeCounts = ["location", "job", "creator", "prop", "vehicle"].map((t) => ({
              type: t,
              label: typeLabel[t] ?? t,
              count: listings.filter((l) => l.type === t).length,
            }));
            const maxCount = Math.max(...typeCounts.map((t) => t.count), 1);
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: List,      label: "Inserate gesamt",    value: String(listings.length),                                color: "text-gold" },
                    { icon: Film,      label: "Aktiv",               value: String(listings.filter(l => l.published).length),      color: "text-success" },
                    { icon: Activity,  label: "Inaktiv",             value: String(listings.filter(l => !l.published).length),     color: "text-text-muted" },
                    { icon: ShieldCheck, label: "Verifizierungen ausstehend", value: String(verifRequests.filter((r) => r.status === "pending").length), color: "text-gold" },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="p-5 rounded-xl border border-border bg-bg-secondary">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-text-muted uppercase tracking-widest">{label}</span>
                        <Icon size={14} className={color} />
                      </div>
                      <div className={`text-2xl font-bold font-display mb-1 ${color}`}>{listingsLoading ? "…" : value}</div>
                    </div>
                  ))}
                </div>

                {/* Listings by type chart */}
                <div className="p-6 rounded-xl border border-border bg-bg-secondary">
                  <h2 className="font-semibold text-text-primary mb-6">Inserate nach Kategorie</h2>
                  <div className="flex items-end gap-4 h-40">
                    {typeCounts.map((t) => {
                      const height = Math.round((t.count / maxCount) * 100);
                      return (
                        <div key={t.type} className="flex flex-col items-center gap-2 flex-1">
                          <span className="text-xs font-semibold text-text-muted">{t.count}</span>
                          <div className="w-full flex items-end" style={{ height: "96px" }}>
                            <div className="w-full bg-gold/20 border border-gold/30 rounded-t-lg transition-all" style={{ height: t.count === 0 ? "4px" : `${height}%` }} />
                          </div>
                          <span className="text-[10px] text-text-muted text-center leading-tight">{t.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                  <p className="text-sm font-semibold text-text-primary mb-1">Transaktions-Analytics</p>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Umsatz-, Provisions- und Zahlungsdaten werden verfügbar sobald die Zahlungsanbindung (Stripe) aktiviert ist.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* ── VERIFIZIERUNGEN ── */}
          {activeTab === "verifications" && (
            <div className="space-y-4 max-w-4xl">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Ausstehend", value: verifRequests.filter((r) => r.status === "pending").length, color: "text-gold" },
                  { label: "Genehmigt", value: verifRequests.filter((r) => r.status === "approved").length, color: "text-success" },
                  { label: "Abgelehnt", value: verifRequests.filter((r) => r.status === "rejected").length, color: "text-text-muted" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-5 rounded-xl border border-border bg-bg-secondary">
                    <p className="text-xs text-text-muted uppercase tracking-widest mb-2">{label}</p>
                    <p className={`text-3xl font-bold font-display ${color}`}>{verifLoading ? "…" : value}</p>
                  </div>
                ))}
              </div>

              {verifLoading && (
                <div className="text-center py-16 text-xs text-text-muted">Laden…</div>
              )}

              {!verifLoading && verifRequests.length === 0 && (
                <div className="text-center py-20 border border-dashed border-border rounded-2xl space-y-3">
                  <ShieldCheck size={32} className="text-text-muted mx-auto opacity-30" />
                  <p className="font-semibold text-text-primary">Keine Verifizierungsanfragen</p>
                  <p className="text-sm text-text-muted max-w-sm mx-auto">
                    Sobald Nutzer eine Verifizierung einreichen, erscheinen die Anfragen hier.
                  </p>
                </div>
              )}

              {!verifLoading && verifRequests.length > 0 && (
                <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                  <div className="divide-y divide-border">
                    {verifRequests.map((r) => (
                      <div key={r.id} className="flex items-center gap-4 px-5 py-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary">{r.display_name ?? r.user_id}</p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {new Date(r.submitted_at).toLocaleString("de-DE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            {r.reviewed_at && <span> · Geprüft {new Date(r.reviewed_at).toLocaleDateString("de-DE")}</span>}
                          </p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded border font-medium shrink-0 ${
                          r.status === "approved" ? "bg-success/10 border-success/30 text-success" :
                          r.status === "rejected" ? "bg-crimson/10 border-crimson/30 text-crimson-light" :
                          "bg-gold/10 border-gold/30 text-gold"
                        }`}>
                          {r.status === "approved" ? "Genehmigt" : r.status === "rejected" ? "Abgelehnt" : "Ausstehend"}
                        </span>
                        {r.status === "pending" && (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleVerifAction(r.id, "approve")}
                              disabled={verifActing === r.id}
                              className="px-3 py-1.5 text-xs font-semibold bg-success/10 border border-success/30 text-success rounded-lg hover:bg-success/20 transition-colors disabled:opacity-50"
                            >
                              {verifActing === r.id ? "…" : "Genehmigen"}
                            </button>
                            <button
                              onClick={() => handleVerifAction(r.id, "reject")}
                              disabled={verifActing === r.id}
                              className="px-3 py-1.5 text-xs font-semibold bg-crimson/10 border border-crimson/30 text-crimson-light rounded-lg hover:bg-crimson/20 transition-colors disabled:opacity-50"
                            >
                              Ablehnen
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── BENUTZER ── */}
          {activeTab === "users" && (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl space-y-3">
              <Users size={32} className="text-text-muted mx-auto opacity-30" />
              <p className="font-semibold text-text-primary">Benutzerverwaltung</p>
              <p className="text-sm text-text-muted max-w-sm mx-auto">
                Die Benutzerliste wird über die Clerk-Dashboard-Integration bereitgestellt.
                Nutzerdetails, Sperren und Rollenmanagement sind direkt im Clerk Admin verfügbar.
              </p>
            </div>
          )}

          {/* ── INSERATE ── */}
          {activeTab === "listings" && (
            <div className="space-y-4">
              <p className="text-sm text-text-muted">
                {listingsLoading ? "Laden…" : (
                  <><span className="text-text-primary font-semibold">{listings.length}</span> Inserate</>
                )}
              </p>
              {!listingsLoading && listings.length === 0 && (
                <div className="text-center py-20 border border-dashed border-border rounded-2xl space-y-3">
                  <List size={32} className="text-text-muted mx-auto opacity-30" />
                  <p className="font-semibold text-text-primary">Noch keine Inserate</p>
                </div>
              )}
              <div className="space-y-3">
                {listings.map((l) => (
                  <div key={l.id} className="flex items-center gap-4 p-5 rounded-xl border border-border bg-bg-secondary">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium text-text-primary text-sm">{l.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${l.published ? "text-success border-success/30 bg-success/10" : "text-text-muted border-border bg-bg-elevated"}`}>
                          {l.published ? "Aktiv" : "Inaktiv"}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">
                        {typeLabel[l.type] ?? l.type} · {l.city} · {l.price > 0 ? `${l.price.toLocaleString()} €/Tag` : "Preis auf Anfrage"} · {new Date(l.created_at).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/${l.type === "location" ? "locations" : l.type === "prop" ? "props" : l.type === "vehicle" ? "vehicles" : l.type === "job" ? "jobs" : "creators"}/${l.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 text-xs font-medium border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-all flex items-center gap-1"
                      >
                        <Eye size={12} /> Ansehen
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TRANSAKTIONEN ── */}
          {activeTab === "transactions" && (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl space-y-3">
              <DollarSign size={32} className="text-text-muted mx-auto opacity-30" />
              <p className="font-semibold text-text-primary">Noch keine Transaktionen</p>
              <p className="text-sm text-text-muted max-w-sm mx-auto">
                Transaktionsdaten erscheinen hier sobald die Stripe-Zahlungsanbindung aktiv ist.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
