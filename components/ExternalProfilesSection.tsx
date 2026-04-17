"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Plus, X, Pencil, ChevronUp, ChevronDown, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import {
  PLATFORMS,
  getPlatform,
  validatePlatformUrl,
  type ExternalProfileRow,
} from "@/lib/external-platforms";

type FormState = {
  platform_type: string;
  platform_name: string;
  url: string;
  custom_label: string;
  is_public: boolean;
};

const EMPTY_FORM: FormState = {
  platform_type: "crew_united",
  platform_name: "",
  url: "",
  custom_label: "",
  is_public: true,
};

export default function ExternalProfilesSection() {
  const { user } = useUser();
  const { addToast } = useToast();

  const [entries, setEntries] = useState<ExternalProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [urlWarning, setUrlWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/external-profiles")
      .then((r) => r.json())
      .then(({ profiles }) => setEntries(profiles ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setUrlWarning(null);
    setShowForm(true);
  }

  function openEdit(entry: ExternalProfileRow) {
    setEditingId(entry.id);
    setForm({
      platform_type: entry.platform_type,
      platform_name: entry.platform_name ?? "",
      url: entry.url,
      custom_label: entry.custom_label ?? "",
      is_public: entry.is_public,
    });
    setUrlWarning(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setUrlWarning(null);
  }

  function handleUrlChange(url: string) {
    setForm((p) => ({ ...p, url }));
    const warning = validatePlatformUrl(form.platform_type, url);
    setUrlWarning(warning && url.length > 5 ? warning : null);
  }

  function handlePlatformChange(type: string) {
    setForm((p) => ({ ...p, platform_type: type, platform_name: type === "other" ? p.platform_name : "" }));
    setUrlWarning(null);
  }

  async function handleSubmit() {
    if (!form.url.trim()) { setUrlWarning("URL ist Pflichtfeld"); return; }
    const warning = validatePlatformUrl(form.platform_type, form.url);
    if (warning) { setUrlWarning(warning); }

    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/external-profiles/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const d = await res.json();
        if (!res.ok) { addToast(d.error ?? "Fehler beim Aktualisieren", "error"); return; }
        setEntries((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...d.profile } : e)));
        addToast("Profil aktualisiert", "success");
      } else {
        const res = await fetch("/api/external-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, sort_order: entries.length }),
        });
        const d = await res.json();
        if (!res.ok) { addToast(d.error ?? "Fehler beim Speichern", "error"); return; }
        setEntries((prev) => [...prev, d.profile]);
        addToast("Profil hinzugefügt", "success");
      }
      cancelForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/external-profiles/${id}`, { method: "DELETE" });
      if (!res.ok) { addToast("Löschen fehlgeschlagen", "error"); return; }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      addToast("Entfernt", "success");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    const idx = entries.findIndex((e) => e.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === entries.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const next = [...entries];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const updated = next.map((e, i) => ({ ...e, sort_order: i }));
    setEntries(updated);
    await Promise.all([
      fetch(`/api/external-profiles/${updated[idx].id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: updated[idx].sort_order }),
      }),
      fetch(`/api/external-profiles/${updated[swapIdx].id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: updated[swapIdx].sort_order }),
      }),
    ]);
  }

  if (loading) {
    return (
      <div className="p-6 bg-bg-secondary border border-border rounded-xl flex items-center gap-2 text-text-muted text-sm">
        <Loader2 size={14} className="animate-spin" /> Lade externe Profile…
      </div>
    );
  }

  const selectedPlatform = getPlatform(form.platform_type);

  return (
    <div className="p-6 bg-bg-secondary border border-border rounded-xl">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="font-semibold text-text-primary mb-0.5">Externe Profile</h2>
          <p className="text-xs text-text-muted">
            Verlinke deine Profile auf anderen Plattformen. CineGenius speichert nur den Link — kein Import, kein Sync.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openAdd}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 border border-gold/20 text-gold text-xs font-semibold rounded-lg hover:bg-gold/20 transition-colors"
          >
            <Plus size={13} /> Profil hinzufügen
          </button>
        )}
      </div>

      {/* Existing entries */}
      {entries.length > 0 && (
        <div className="space-y-2 mb-4">
          {entries.map((entry, idx) => {
            const plat = getPlatform(entry.platform_type);
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 bg-bg-elevated border border-border rounded-xl group"
              >
                {/* Badge */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${plat.bgCls} ${plat.borderCls} ${plat.textCls}`}>
                  {plat.abbr}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary leading-tight">
                    {entry.platform_type === "other" && entry.platform_name
                      ? entry.platform_name
                      : plat.name}
                    {entry.custom_label && (
                      <span className="text-text-muted font-normal"> · {entry.custom_label}</span>
                    )}
                  </p>
                  <p className="text-xs text-text-muted truncate max-w-[220px]">{entry.url}</p>
                </div>

                {/* Visibility badge */}
                {!entry.is_public && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-bg-secondary border border-border text-text-muted rounded font-medium shrink-0">
                    Privat
                  </span>
                )}

                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleReorder(entry.id, "up")}
                    disabled={idx === 0}
                    className="p-0.5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-20"
                  >
                    <ChevronUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorder(entry.id, "down")}
                    disabled={idx === entries.length - 1}
                    className="p-0.5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-20"
                  >
                    <ChevronDown size={11} />
                  </button>
                </div>

                {/* Edit */}
                <button
                  type="button"
                  onClick={() => openEdit(entry)}
                  className="shrink-0 p-1.5 text-text-muted hover:text-gold transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Pencil size={13} />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  className="shrink-0 p-1.5 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                >
                  {deletingId === entry.id
                    ? <Loader2 size={13} className="animate-spin" />
                    : <X size={13} />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {entries.length === 0 && !showForm && (
        <div className="py-8 text-center border border-dashed border-border rounded-xl mb-4">
          <ExternalLink size={20} className="text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">Noch keine externen Profile hinterlegt.</p>
          <p className="text-xs text-text-muted mt-1">Klicke oben auf „Profil hinzufügen".</p>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="p-4 bg-bg-elevated border border-gold/20 rounded-xl space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-gold uppercase tracking-widest">
              {editingId ? "Profil bearbeiten" : "Neues externes Profil"}
            </p>
            <button type="button" onClick={cancelForm} className="text-text-muted hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Platform select */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">Plattform</label>
            <select
              value={form.platform_type}
              onChange={(e) => handlePlatformChange(e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
            >
              {PLATFORMS.map((p) => (
                <option key={p.type} value={p.type}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Custom name for "other" */}
          {form.platform_type === "other" && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">
                Plattformname <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.platform_name}
                onChange={(e) => setForm((p) => ({ ...p, platform_name: e.target.value }))}
                placeholder="z. B. Casting Network"
                className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          )}

          {/* URL */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">
              URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={
                selectedPlatform.urlHints[0]
                  ? `https://www.${selectedPlatform.urlHints[0]}/...`
                  : "https://..."
              }
              className={`w-full bg-bg-secondary border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${
                urlWarning ? "border-amber-500/60 focus:border-amber-400" : "border-border focus:border-gold"
              }`}
            />
            {urlWarning && (
              <div className="flex items-start gap-1.5 mt-1.5 text-xs text-amber-400">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                {urlWarning}
              </div>
            )}
          </div>

          {/* Optional: custom label */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold block mb-1">
              Kurzbezeichnung <span className="text-text-muted normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.custom_label}
              onChange={(e) => setForm((p) => ({ ...p, custom_label: e.target.value }))}
              placeholder="z. B. Regie-Profil, Demo Reel…"
              className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          {/* Visibility toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
            <div
              onClick={() => setForm((p) => ({ ...p, is_public: !p.is_public }))}
              className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${form.is_public ? "bg-gold" : "bg-bg-secondary border border-border"}`}
            >
              <span
                className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                style={{ left: form.is_public ? "calc(100% - 18px)" : "2px" }}
              />
            </div>
            <span className="text-xs text-text-secondary">Öffentlich sichtbar</span>
          </label>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !form.url.trim()}
            className="w-full py-2.5 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Speichern…</>
              : editingId ? "Änderungen speichern" : "Profil hinzufügen"}
          </button>
        </div>
      )}

      {/* Add more button at bottom (only shown when list non-empty and form closed) */}
      {entries.length > 0 && !showForm && (
        <button
          type="button"
          onClick={openAdd}
          className="w-full mt-1 py-2 border border-dashed border-border rounded-lg text-xs text-text-muted hover:border-gold/40 hover:text-gold transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus size={12} /> Weiteres Profil hinzufügen
        </button>
      )}
    </div>
  );
}
