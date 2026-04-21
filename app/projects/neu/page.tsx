"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clapperboard, Loader2, Check } from "lucide-react";
import ProfileGuard from "@/components/ProfileGuard";

const PROJECT_TYPES = [
  "Spielfilm", "Kurzfilm", "Serie", "Dokumentation",
  "Werbefilm", "Imagefilm", "Musikvideo", "Corporate",
  "Social Media", "Foto / Shooting", "Event", "Sonstiges",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 40 }, (_, i) => CURRENT_YEAR - i);

export default function NeuesProjektPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    year: String(CURRENT_YEAR),
    type: "",
    director: "",
    description: "",
    myRole: "",
    genre: "",
    productionCompany: "",
  });

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Titel ist Pflichtfeld"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          year: form.year || null,
          type: form.type || null,
          director: form.director.trim() || null,
          description: form.description.trim() || null,
          myRole: form.myRole.trim() || null,
          genre: form.genre.trim() || null,
          productionCompany: form.productionCompany.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Fehler beim Speichern"); return; }
      router.push(`/projects/${json.project.id}`);
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileGuard>
      <div className="pt-16 min-h-screen bg-bg-primary">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

          {/* Back */}
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-gold transition-colors mb-8">
            <ArrowLeft size={14} /> Zurück zu Projekten
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
              <Clapperboard size={22} className="text-gold" />
            </div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Neues Projekt</h1>
            <p className="text-sm text-text-muted mt-1">
              Füge ein Filmprojekt zu deinem Portfolio hinzu und verlinke Crew-Mitglieder.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Titel */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">
                Projekttitel <span className="text-gold">*</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="z. B. „Der letzte Schnitt""
                className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>

            {/* Typ + Jahr (2 cols) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Typ</label>
                <select
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                  className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary focus:outline-none focus:border-gold transition-colors appearance-none"
                >
                  <option value="">Typ wählen</option>
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Jahr</label>
                <select
                  value={form.year}
                  onChange={(e) => set("year", e.target.value)}
                  className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary focus:outline-none focus:border-gold transition-colors appearance-none"
                >
                  <option value="">Jahr wählen</option>
                  {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Meine Rolle */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">
                Meine Rolle im Projekt
              </label>
              <input
                value={form.myRole}
                onChange={(e) => set("myRole", e.target.value)}
                placeholder="z. B. Regisseur, Kameramann, Editor …"
                className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
              <p className="text-xs text-text-muted mt-1.5">Dein Name erscheint im Projekt unter dieser Rolle.</p>
            </div>

            {/* Regie + Produktionsfirma (2 cols) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Regie</label>
                <input
                  value={form.director}
                  onChange={(e) => set("director", e.target.value)}
                  placeholder="Name des Regisseurs"
                  className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Produktionsfirma</label>
                <input
                  value={form.productionCompany}
                  onChange={(e) => set("productionCompany", e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>

            {/* Genre */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Genre</label>
              <input
                value={form.genre}
                onChange={(e) => set("genre", e.target.value)}
                placeholder="z. B. Drama, Thriller, Komödie …"
                className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>

            {/* Beschreibung */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Beschreibung</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                placeholder="Kurze Inhaltsbeschreibung, Festivalteilnahmen, besondere Erwähnungen …"
                className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !form.title.trim()}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? "Wird gespeichert…" : "Projekt erstellen"}
              </button>
              <Link href="/projects" className="px-4 py-3 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors">
                Abbrechen
              </Link>
            </div>
          </form>
        </div>
      </div>
    </ProfileGuard>
  );
}
