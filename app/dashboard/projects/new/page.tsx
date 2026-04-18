"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Clapperboard, CheckCircle, Loader2, X } from "lucide-react";
import Link from "next/link";

const PROJECT_TYPES = [
  "Spielfilm", "Kurzfilm", "Serie", "Dokumentation", "Musikvideo",
  "Werbefilm / Commercial", "Corporate Film", "Event / Live", "Foto / Shooting",
  "Social Media Content", "Imagefilm", "Sonstiges",
];

type TypeConfig = {
  rolePlaceholder: string;
  directorLabel: string;
  directorPlaceholder: string;
  genreLabel: string;
  genrePlaceholder: string;
  locationLabel: string;
  locationPlaceholder: string;
  companyLabel: string;
  companyPlaceholder: string;
  linkPlaceholder: string;
  descPlaceholder: string;
  titlePlaceholder: string;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  "Spielfilm": {
    rolePlaceholder: "z. B. Regisseur, Kameramann, Produzent",
    directorLabel: "Regie",
    directorPlaceholder: "Name des Regisseurs",
    genreLabel: "Genre",
    genrePlaceholder: "Drama, Thriller, Komödie …",
    locationLabel: "Drehort / Region",
    locationPlaceholder: "z. B. Berlin, Hamburg, Wien",
    companyLabel: "Produktionsfirma",
    companyPlaceholder: "z. B. X Filme, UFA",
    linkPlaceholder: "IMDb, Vimeo, YouTube …",
    descPlaceholder: "Worum geht es in diesem Film?",
    titlePlaceholder: "z. B. Der letzte Sommer",
  },
  "Kurzfilm": {
    rolePlaceholder: "z. B. Regisseur, Kameramann, Cutter",
    directorLabel: "Regie",
    directorPlaceholder: "Name des Regisseurs",
    genreLabel: "Genre",
    genrePlaceholder: "Drama, Komödie, Horror …",
    locationLabel: "Drehort / Region",
    locationPlaceholder: "z. B. München, Leipzig",
    companyLabel: "Hochschule / Produktionsfirma",
    companyPlaceholder: "z. B. HFF München, unabhängig",
    linkPlaceholder: "Vimeo, YouTube, Kurzfilmtage …",
    descPlaceholder: "Worum geht es in diesem Kurzfilm?",
    titlePlaceholder: "z. B. Stille Wasser",
  },
  "Serie": {
    rolePlaceholder: "z. B. Regisseur, Showrunner, DOP",
    directorLabel: "Regie / Showrunner",
    directorPlaceholder: "Name des Showrunners oder Regisseurs",
    genreLabel: "Genre",
    genrePlaceholder: "Drama, Krimi, Comedy …",
    locationLabel: "Drehort / Region",
    locationPlaceholder: "z. B. Köln, Berlin, Wien",
    companyLabel: "Produktionsfirma / Sender",
    companyPlaceholder: "z. B. Wiedemann & Berg, ARD",
    linkPlaceholder: "IMDb, Streaming-Link …",
    descPlaceholder: "Worum geht es in dieser Serie?",
    titlePlaceholder: "z. B. Dark Horizons",
  },
  "Dokumentation": {
    rolePlaceholder: "z. B. Regisseur, Kameramann, Cutter",
    directorLabel: "Regie",
    directorPlaceholder: "Name des Regisseurs",
    genreLabel: "Thema",
    genrePlaceholder: "Gesellschaft, Natur, Geschichte, Sport …",
    locationLabel: "Drehort / Region",
    locationPlaceholder: "z. B. weltweit, DACH, Berlin",
    companyLabel: "Produktionsfirma / Sender",
    companyPlaceholder: "z. B. NDR, ZDF, unabhängig",
    linkPlaceholder: "Mediathek, Vimeo, YouTube …",
    descPlaceholder: "Was ist das Thema dieser Dokumentation?",
    titlePlaceholder: "z. B. Am Rande der Welt",
  },
  "Musikvideo": {
    rolePlaceholder: "z. B. Regisseur, Kameramann, Colorist",
    directorLabel: "Regie",
    directorPlaceholder: "Name des Regisseurs",
    genreLabel: "Musikgenre",
    genrePlaceholder: "Pop, Hip-Hop, Rock, Electronic …",
    locationLabel: "Drehort / Region",
    locationPlaceholder: "z. B. Berlin, Studio, On Location",
    companyLabel: "Label / Künstler",
    companyPlaceholder: "z. B. Universal, Sony, Indie",
    linkPlaceholder: "YouTube, Vimeo, Spotify …",
    descPlaceholder: "Für welchen Künstler und Song wurde das Video gedreht?",
    titlePlaceholder: "z. B. Midnight Run – Max Mustermann",
  },
  "Werbefilm / Commercial": {
    rolePlaceholder: "z. B. Regisseur, Kameramann, Art Director",
    directorLabel: "Regie",
    directorPlaceholder: "Name des Regisseurs",
    genreLabel: "Format",
    genrePlaceholder: "TV-Spot, Online-Ad, Imagefilm, Product …",
    locationLabel: "Drehort / Region",
    locationPlaceholder: "z. B. Studio Berlin, München",
    companyLabel: "Agentur / Auftraggeber",
    companyPlaceholder: "z. B. BBDO, Jung von Matt, Markenname",
    linkPlaceholder: "YouTube, Vimeo, Agentur-Link …",
    descPlaceholder: "Für welches Produkt oder welche Marke wurde der Spot gedreht?",
    titlePlaceholder: "z. B. BMW Frühjahrs-Kampagne 2024",
  },
  "Corporate Film": {
    rolePlaceholder: "z. B. Kameramann, Produzent, Cutter",
    directorLabel: "Projektleitung",
    directorPlaceholder: "Verantwortliche Person oder Agentur",
    genreLabel: "Art des Films",
    genrePlaceholder: "Imagefilm, Employer Branding, Erklärfilm …",
    locationLabel: "Drehort / Unternehmen",
    locationPlaceholder: "z. B. Frankfurt, Hamburg, On Location",
    companyLabel: "Auftraggeber / Unternehmen",
    companyPlaceholder: "z. B. Siemens AG, Startup GmbH",
    linkPlaceholder: "Unternehmenswebsite, Vimeo, YouTube …",
    descPlaceholder: "Welches Unternehmen wurde porträtiert und was war das Ziel?",
    titlePlaceholder: "z. B. Imagefilm Muster GmbH",
  },
  "Event / Live": {
    rolePlaceholder: "z. B. Kameramann, Live-Cutter, Tonmeister",
    directorLabel: "Veranstaltungsort",
    directorPlaceholder: "z. B. Olympiastadion, Messe Hamburg",
    genreLabel: "Art des Events",
    genrePlaceholder: "Konzert, Festival, Konferenz, Messe …",
    locationLabel: "Stadt / Region",
    locationPlaceholder: "z. B. Berlin, München, Wien",
    companyLabel: "Veranstalter / Auftraggeber",
    companyPlaceholder: "z. B. Live Nation, Eventfirma",
    linkPlaceholder: "YouTube, Instagram, Event-Website …",
    descPlaceholder: "Welches Event wurde gefilmt? Was war besonders daran?",
    titlePlaceholder: "z. B. Rock am Ring 2024 – Backstage",
  },
  "Foto / Shooting": {
    rolePlaceholder: "z. B. Fotograf, Art Director, Stylist",
    directorLabel: "Art Direction",
    directorPlaceholder: "Name des Art Directors oder Stylisten",
    genreLabel: "Art des Shootings",
    genrePlaceholder: "Fashion, Portrait, Editorial, Werbung, Beauty …",
    locationLabel: "Location / Studio",
    locationPlaceholder: "z. B. Studio Berlin, On Location, Paris",
    companyLabel: "Agentur / Auftraggeber",
    companyPlaceholder: "z. B. Magazin, Marke, Modelagentur",
    linkPlaceholder: "Portfolio, Instagram, Behance …",
    descPlaceholder: "Worum ging es bei diesem Shooting? Wer war involviert?",
    titlePlaceholder: "z. B. Editorial Vogue DE Herbst 2024",
  },
  "Social Media Content": {
    rolePlaceholder: "z. B. Creator, Videograf, Editor",
    directorLabel: "Plattform / Kanal",
    directorPlaceholder: "z. B. @username auf TikTok, YouTube-Kanal",
    genreLabel: "Content-Art",
    genrePlaceholder: "TikTok, Reels, YouTube, Podcast, Story …",
    locationLabel: "Drehort / Setting",
    locationPlaceholder: "z. B. Homeoffice, On Location, Studio",
    companyLabel: "Brand Deal / Auftraggeber",
    companyPlaceholder: "z. B. Nike, eigener Kanal",
    linkPlaceholder: "TikTok, YouTube, Instagram …",
    descPlaceholder: "Was ist das Thema dieses Projekts? Für welche Plattform?",
    titlePlaceholder: "z. B. Travel-Serie Südostasien",
  },
  "Imagefilm": {
    rolePlaceholder: "z. B. Regisseur, Kameramann, Produzent",
    directorLabel: "Regie / Projektleitung",
    directorPlaceholder: "Verantwortliche Person",
    genreLabel: "Zielgruppe / Format",
    genrePlaceholder: "B2B, Employer Branding, Produktvideo …",
    locationLabel: "Drehort / Region",
    locationPlaceholder: "z. B. Köln, Hamburg, Zürich",
    companyLabel: "Auftraggeber",
    companyPlaceholder: "z. B. Unternehmensname, Agentur",
    linkPlaceholder: "Vimeo, Unternehmenswebsite …",
    descPlaceholder: "Welches Unternehmen oder Produkt wurde präsentiert?",
    titlePlaceholder: "z. B. Imagevideo Musterfirma AG",
  },
  "Sonstiges": {
    rolePlaceholder: "z. B. Regisseur, Kameramann, Produzent",
    directorLabel: "Regie / Verantwortlich",
    directorPlaceholder: "Name der verantwortlichen Person",
    genreLabel: "Kategorie / Thema",
    genrePlaceholder: "Beliebige Kategorie",
    locationLabel: "Drehort / Region",
    locationPlaceholder: "z. B. Berlin, Wien, Zürich",
    companyLabel: "Auftraggeber / Firma",
    companyPlaceholder: "Auftraggeber oder Produktionsfirma",
    linkPlaceholder: "Website, YouTube, Vimeo …",
    descPlaceholder: "Beschreib dein Projekt.",
    titlePlaceholder: "Projekttitel eingeben",
  },
};

const DEFAULT_CONFIG: TypeConfig = TYPE_CONFIG["Spielfilm"];

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

  const cfg: TypeConfig = form.type ? (TYPE_CONFIG[form.type] ?? DEFAULT_CONFIG) : DEFAULT_CONFIG;

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

          {/* Produktionsart first — drives all other labels */}
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

          {/* Titel + Jahr */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                Projekttitel <span className="text-gold">*</span>
              </label>
              <input
                type="text"
                placeholder={cfg.titlePlaceholder}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                required
              />
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

          {/* Meine Rolle + Regie/Art Direction/Plattform */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                Meine Rolle
              </label>
              <input
                type="text"
                placeholder={cfg.rolePlaceholder}
                value={form.myRole}
                onChange={(e) => set("myRole", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                {cfg.directorLabel}
              </label>
              <input
                type="text"
                placeholder={cfg.directorPlaceholder}
                value={form.director}
                onChange={(e) => set("director", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          {/* Genre/Thema + Auftraggeber/Firma */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                {cfg.genreLabel}
              </label>
              <input
                type="text"
                placeholder={cfg.genrePlaceholder}
                value={form.genre}
                onChange={(e) => set("genre", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                {cfg.companyLabel}
              </label>
              <input
                type="text"
                placeholder={cfg.companyPlaceholder}
                value={form.productionCompany}
                onChange={(e) => set("productionCompany", e.target.value)}
                className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          {/* Drehort/Location */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
              {cfg.locationLabel}
            </label>
            <input
              type="text"
              placeholder={cfg.locationPlaceholder}
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
              placeholder={cfg.descPlaceholder}
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
              Link
            </label>
            <input
              type="url"
              placeholder={cfg.linkPlaceholder}
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
