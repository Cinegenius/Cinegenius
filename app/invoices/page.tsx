"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Receipt, Download, Search, Filter, ChevronDown, ChevronUp,
  ArrowLeft, Wallet, TrendingUp, FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PayoutStatus =
  | "auszahlung_abgeschlossen"
  | "auszahlung_freigegeben"
  | "auszahlung_ausstehend"
  | "provision_verbucht"
  | "bezahlt"
  | "zahlung_offen"
  | "storniert";

type Transaction = {
  id: string;
  listing: string;
  buyer: string;
  provider: string;
  amount: number;
  rate: number;
  commission: number;
  payout: number;
  status: PayoutStatus;
  date: string;
  category: string;
};

const payoutStatusMeta: Record<PayoutStatus, { label: string; color: string }> = {
  auszahlung_abgeschlossen: { label: "Abgeschlossen",  color: "border-success/30 bg-success/10 text-success" },
  auszahlung_freigegeben:   { label: "Freigegeben",    color: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  auszahlung_ausstehend:    { label: "Ausstehend",     color: "border-gold/30 bg-gold-subtle text-gold" },
  provision_verbucht:       { label: "Verbucht",       color: "border-violet-500/30 bg-violet-500/10 text-violet-400" },
  bezahlt:                  { label: "Bezahlt",        color: "border-success/30 bg-success/10 text-success" },
  zahlung_offen:            { label: "Zahlung offen",  color: "border-gold/30 bg-gold-subtle text-gold" },
  storniert:                { label: "Storniert",      color: "border-crimson/30 bg-crimson/10 text-crimson-light" },
};

const statusFilters: { id: PayoutStatus | "alle"; label: string }[] = [
  { id: "alle", label: "Alle" },
  { id: "auszahlung_abgeschlossen", label: "Abgeschlossen" },
  { id: "auszahlung_freigegeben", label: "Freigegeben" },
  { id: "auszahlung_ausstehend", label: "Ausstehend" },
  { id: "provision_verbucht", label: "Verbucht" },
  { id: "bezahlt", label: "Bezahlt" },
  { id: "zahlung_offen", label: "Offen" },
  { id: "storniert", label: "Storniert" },
];

const categoryFilters = ["Alle", "Locations", "Filmschaffende", "Requisiten", "Fahrzeuge"];

const typeToCategory: Record<string, string> = {
  location: "Locations",
  creator: "Filmschaffende",
  prop: "Requisiten",
  vehicle: "Fahrzeuge",
  job: "Jobs",
};

// ─── Row component (ready for real data) ──────────────────────────────────────

function InvoiceRow({ tx, expanded, onToggle }: { tx: Transaction; expanded: boolean; onToggle: () => void }) {
  const meta = payoutStatusMeta[tx.status];
  const isCancelled = tx.status === "storniert";

  return (
    <>
      <tr
        className={`border-b border-border hover:bg-bg-elevated/50 cursor-pointer transition-colors ${isCancelled ? "opacity-50" : ""}`}
        onClick={onToggle}
      >
        <td className="px-5 py-4 font-mono text-sm text-gold font-semibold whitespace-nowrap">{tx.id}</td>
        <td className="px-5 py-4">
          <div className="text-sm font-medium text-text-primary">{tx.listing}</div>
          <div className="text-xs text-text-muted mt-0.5">{tx.category}</div>
        </td>
        <td className="px-5 py-4 text-sm text-text-secondary whitespace-nowrap hidden md:table-cell">{tx.date}</td>
        <td className="px-5 py-4 text-sm font-semibold text-text-primary text-right whitespace-nowrap">
          {tx.amount.toLocaleString()} €
        </td>
        <td className="px-5 py-4 hidden lg:table-cell">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${meta.color}`}>
            {meta.label}
          </span>
        </td>
        <td className="px-5 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); }}
              disabled={isCancelled}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                isCancelled
                  ? "border-border text-text-muted cursor-not-allowed"
                  : "border-gold/40 text-gold hover:bg-gold-subtle"
              }`}
              title="Rechnung herunterladen"
            >
              <Download size={12} />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button className="text-text-muted hover:text-text-primary transition-colors p-1">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border bg-bg-elevated/30">
          <td colSpan={6} className="px-5 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-text-muted mb-1">Käufer</div>
                  <div className="text-sm font-medium text-text-primary">{tx.buyer}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-1">Anbieter</div>
                  <div className="text-sm font-medium text-text-primary">{tx.provider}</div>
                </div>
              </div>
              <div className="sm:col-span-2 bg-bg-secondary border border-border rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Abrechnung</div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Buchungsbetrag</span>
                  <span className="text-text-primary font-medium">{tx.amount.toLocaleString()} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Plattformgebühr ({tx.rate} %)</span>
                  <span className="text-text-primary">− {tx.commission.toLocaleString()} €</span>
                </div>
                <div className="pt-2 border-t border-border flex justify-between text-sm font-bold">
                  <span className="text-text-primary">Auszahlung an Anbieter</span>
                  <span className="text-success">{tx.payout.toLocaleString()} €</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 justify-center">
                <button
                  disabled={isCancelled}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg border font-medium transition-all ${
                    isCancelled
                      ? "border-border text-text-muted cursor-not-allowed"
                      : "border-gold text-gold hover:bg-gold-subtle"
                  }`}
                >
                  <Download size={14} /> Rechnung (PDF)
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | "alle">("alle");
  const [categoryFilter, setCategoryFilter] = useState("Alle");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetch("/api/bookings")
      .then(r => r.json())
      .then(({ bookings }) => {
        if (!Array.isArray(bookings)) return;
        const mapped: Transaction[] = bookings.map((b: {
          ref: string; listing_title: string; listing_type: string;
          total: number; platform_fee: number; subtotal: number;
          status: string; created_at: string; days: number; daily_rate: number;
        }) => ({
          id: b.ref,
          listing: b.listing_title,
          buyer: "Käufer",
          provider: "Anbieter",
          amount: b.total,
          rate: 10,
          commission: b.platform_fee ?? Math.round(b.total / 11),
          payout: (b.subtotal ?? b.total) - (b.platform_fee ?? Math.round(b.total / 11)),
          status: "bezahlt" as PayoutStatus,
          date: new Date(b.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" }),
          category: typeToCategory[b.listing_type] ?? b.listing_type,
        }));
        setAllTransactions(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return allTransactions
      .filter((tx) => {
        const matchStatus = statusFilter === "alle" || tx.status === statusFilter;
        const matchCategory = categoryFilter === "Alle" || tx.category === categoryFilter;
        const matchSearch =
          search === "" ||
          tx.id.toLowerCase().includes(search.toLowerCase()) ||
          tx.listing.toLowerCase().includes(search.toLowerCase()) ||
          tx.buyer.toLowerCase().includes(search.toLowerCase()) ||
          tx.provider.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchCategory && matchSearch;
      })
      .sort((a, b) => sortDir === "desc" ? b.amount - a.amount : a.amount - b.amount);
  }, [statusFilter, categoryFilter, search, sortDir, allTransactions]);

  const totals = useMemo(() => {
    const active = allTransactions.filter((tx) => tx.status !== "storniert");
    return {
      transactions: active.length,
      volume: active.reduce((s, tx) => s + tx.amount, 0),
      commission: active.reduce((s, tx) => s + tx.commission, 0),
      payout: active.reduce((s, tx) => s + tx.payout, 0),
    };
  }, [allTransactions]);

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-text-muted hover:text-gold hover:border-gold transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Rechnungen & Transaktionen</h1>
            <p className="text-sm text-text-muted mt-0.5">Alle Buchungen, Provisionen und Auszahlungen im Überblick</p>
          </div>
          <div className="ml-auto">
            <button
              disabled={allTransactions.length === 0 || loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={15} /> Alle exportieren
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: FileText,   label: "Transaktionen",    value: String(totals.transactions),               sub: "abgeschlossen" },
            { icon: TrendingUp, label: "Buchungsvolumen",  value: totals.volume.toLocaleString() + " €",     sub: "gesamt" },
            { icon: Receipt,    label: "Plattformgebühren",value: totals.commission.toLocaleString() + " €", sub: "eingenommen" },
            { icon: Wallet,     label: "Auszahlungen",     value: totals.payout.toLocaleString() + " €",     sub: "an Anbieter" },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-bg-secondary border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gold-subtle rounded-lg flex items-center justify-center">
                  <Icon size={16} className="text-gold" />
                </div>
                <span className="text-xs text-text-muted">{label}</span>
              </div>
              <div className="font-display text-2xl font-bold text-text-primary">{value}</div>
              <div className="text-xs text-text-muted mt-1">{sub}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-bg-secondary border border-border rounded-xl p-4 mb-6 space-y-4">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Referenz, Inserat, Käufer oder Anbieter suchen …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={13} className="text-text-muted shrink-0" />
            {statusFilters.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                  statusFilter === id
                    ? "bg-gold text-bg-primary border-gold font-semibold"
                    : "border-border text-text-secondary hover:border-gold/50 hover:text-gold"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted shrink-0 w-[13px]" />
            {categoryFilters.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                  categoryFilter === cat
                    ? "border-gold text-gold bg-gold-subtle font-semibold"
                    : "border-border text-text-muted hover:border-gold/50 hover:text-gold"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-8 h-8 border-2 border-gold/40 border-t-gold rounded-full animate-spin mb-4" />
              <p className="text-sm text-text-muted">Transaktionen werden geladen…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-14 h-14 bg-bg-elevated border border-border rounded-full flex items-center justify-center mb-4">
                <Receipt size={22} className="text-text-muted opacity-50" />
              </div>
              <h3 className="font-semibold text-text-primary mb-1">Noch keine Transaktionen</h3>
              <p className="text-sm text-text-muted max-w-sm leading-relaxed">
                Rechnungen und Transaktionen erscheinen hier sobald Buchungen bestätigt und bezahlt wurden.
              </p>
              <Link
                href="/dashboard?tab=bookings"
                className="mt-4 inline-flex items-center gap-2 text-xs text-gold hover:text-gold-light transition-colors"
              >
                Anfragen im Dashboard ansehen →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Referenz</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Inserat</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide hidden md:table-cell">Datum</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-text-muted uppercase tracking-wide">
                      <button
                        className="flex items-center gap-1 ml-auto hover:text-gold transition-colors"
                        onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                      >
                        Betrag
                        {sortDir === "desc" ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                      </button>
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide hidden lg:table-cell">Status</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-text-muted uppercase tracking-wide">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => (
                    <InvoiceRow
                      key={tx.id}
                      tx={tx}
                      expanded={expandedId === tx.id}
                      onToggle={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-5 py-3.5 border-t border-border flex items-center justify-between text-xs text-text-muted">
              <span>{filtered.length} Ergebnis{filtered.length !== 1 ? "se" : ""}</span>
              <span>
                Gesamtvolumen:{" "}
                <span className="text-text-primary font-semibold">
                  {filtered.filter(t => t.status !== "storniert").reduce((s, t) => s + t.amount, 0).toLocaleString()} €
                </span>
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-text-muted text-center mt-6">
          Rechnungen werden nach Buchungsabschluss automatisch generiert und 7 Jahre lang archiviert.
          Bei Fragen:{" "}
          <Link href="/dashboard" className="text-gold hover:underline">Support kontaktieren</Link>
        </p>
      </div>
    </div>
  );
}
