"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Clapperboard, CheckCircle, Loader2, Upload, X } from "lucide-react";
import Link from "next/link";

const PROJECT_TYPES = [
  "Spielfilm", "Kurzfilm", "Serie", "Dokumentation", "Musikvideo",
  "Werbefilm / Commercial", "Corporate Film", "Event / Live", "Foto / Shooting",
  "Social Media Content", "Imagefilm", "Sonstiges",
];

export default function NewProjectPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  const [form, setForm] = useState({
    title: "",
    type: "",
    year: "",
    director: "",
    myRole: "",
    genre: "",
    productionCompany: "",
    location: "",
    description: "",
    poster_url: "",
    link: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn) {
    return (
      <div className="pt-16 min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-muted">Bitte einloggen.</p>
      </div>
    );
  }

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Titel ist Pflichtfeld"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          type: form.type || null,
          year: form.year || null,
          director: form.director || null,
          myRole: form.myRole || null,
          genre: form.genre || null,
          productionCompany: form.productionCompany || null,
          location: form.location || null,
          description: form.description || null,
          poster_url: form.poster_url || null,
          link: form.link || null,
          images: [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Speichern");
      router.push(`/projects/${json.project.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  return (
    <div className="pt-16 min-h-screen bg-bg-primary">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/projects" className="text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/25 flex items-center justify-center">
            <Clapperboard size={18} className="text-gold" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-text-primary leading-tight">Projekt eintragen</h1>
            <p className="text-xs text-text-muted">Zeig der Community deine Arbeit</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Titel */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
              Projekttitel <span className="text-gold">*</span>
            </label>
            <input
              type="text"
              placeholder="z. B. Der letzte Sommer"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              required
            />
          </div>

          {/* Type + Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                Produktionsart
              </label>
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-gold transition-colors appearance-none"
              >
                <option value="">Bitte wählen</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                Jahr
              </label>
              <input
                type="number"
                placeholder="2024"
                min="1900"
                max="2030"
                value={form.year}
                onChange={(e) => set("year", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          {/* Meine Rolle + Regie */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                Meine Rolle
              </label>
              <input
                type="text"
                placeholder="z. B. Kameramann, Regisseur"
                value={form.myRole}
                onChange={(e) => set("myRole", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                Regie
              </label>
              <input
                type="text"
                placeholder="Name des Regisseurs"
                value={form.director}
                onChange={(e) => set("director", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          {/* Genre + Produktionsfirma */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                Genre
              </label>
              <input
                type="text"
                placeholder="Drama, Komödie, Thriller …"
                value={form.genre}
                onChange={(e) => set("genre", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                Produktionsfirma
              </label>
              <input
                type="text"
                placeholder="Firma oder Auftraggeber"
                value={form.productionCompany}
                onChange={(e) => set("productionCompany", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          {/* Drehort */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
              Drehort / Region
            </label>
            <input
              type="text"
              placeholder="z. B. Berlin, Wien, München"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
              Beschreibung
            </label>
            <textarea
              rows={4}
              placeholder="Worum geht es in diesem Projekt?"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
            />
          </div>

          {/* Poster URL */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
              Poster / Titelbild URL
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={form.poster_url}
              onChange={(e) => set("poster_url", e.target.value)}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          {/* Link */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
              Link (IMDb, YouTube, Vimeo …)
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={form.link}
              onChange={(e) => set("link", e.target.value)}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              <X size={14} />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link
              href="/projects"
              className="flex-1 px-4 py-3 border border-border text-text-secondary rounded-xl hover:border-border-hover hover:text-text-primary transition-all text-sm font-medium text-center"
            >
              Abbrechen
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {saving ? "Speichern …" : "Projekt eintragen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
