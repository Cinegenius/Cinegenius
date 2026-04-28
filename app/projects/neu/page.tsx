"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Clapperboard, Loader2, Check, Search, Plus, X,
  ChevronRight, ShieldCheck, AlertCircle,
} from "lucide-react";
import ProfileGuard from "@/components/ProfileGuard";
import RoleDropdown from "@/components/RoleDropdown";
import { departments } from "@/lib/departments";

const ALL_ROLES = departments.flatMap((d) => d.roles);

const PROJECT_TYPES = [
  "Spielfilm", "Kurzfilm", "Serie", "Dokumentation",
  "Werbefilm", "Imagefilm", "Musikvideo", "Corporate",
  "Social Media", "Foto / Shooting", "Event", "Sonstiges",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 40 }, (_, i) => CURRENT_YEAR - i);

type ExistingProject = {
  id: string;
  title: string;
  year: number | null;
  type: string | null;
  director: string | null;
  poster_url: string | null;
  verified?: boolean;
};

export default function NeuesProjektPage() {
  const router = useRouter();

  // ── Step 1: search ───────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExistingProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/projects?q=${encodeURIComponent(query.trim())}&limit=8`);
        const json = await res.json();
        setResults(json.projects ?? []);
        setSearched(true);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query]);

  // ── Join existing ─────────────────────────────────────────────────────────────
  const [joining, setJoining] = useState<string | null>(null);
  const [joinRole, setJoinRole] = useState("");
  const [joinTarget, setJoinTarget] = useState<ExistingProject | null>(null);
  const [joinSaving, setJoinSaving] = useState(false);
  const [joinError, setJoinError] = useState("");

  async function handleJoin() {
    if (!joinTarget || !joinRole.trim()) { setJoinError("Bitte Rolle eingeben"); return; }
    setJoinSaving(true); setJoinError("");
    try {
      const res = await fetch("/api/project-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: joinTarget.id, role: joinRole.trim() }),
      });
      if (!res.ok) { const j = await res.json(); setJoinError(j.error ?? "Fehler"); return; }
      router.push(`/projects/${joinTarget.id}`);
    } finally {
      setJoinSaving(false);
    }
  }

  // ── Step 2: create new ────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const [form, setForm] = useState({
    title: "",
    year: String(CURRENT_YEAR),
    type: "",
    director: "",
    description: "",
    myRole: "",
    productionCompany: "",
  });

  // Team members (ghost profiles)
  type TeamMember = { name: string; role: string };
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");

  function addMember() {
    const name = memberName.trim();
    const role = memberRole.trim();
    if (!name || !role) return;
    setTeamMembers((prev) => [...prev, { name, role }]);
    setMemberName("");
    setMemberRole("");
  }

  function removeMember(idx: number) {
    setTeamMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  function openCreate() {
    setForm((f) => ({ ...f, title: query }));
    setShowCreate(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setCreateError("Titel ist Pflichtfeld"); return; }
    setSaving(true); setCreateError("");
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
          productionCompany: form.productionCompany.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json.error ?? "Fehler"); return; }

      const projectId = json.project.id;

      // Add ghost profile credits for each team member
      if (teamMembers.length > 0) {
        await Promise.allSettled(
          teamMembers.map(async (member) => {
            const profileRes = await fetch("/api/unclaimed-profiles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: member.name, primary_role: member.role }),
            });
            if (!profileRes.ok) return;
            const profileJson = await profileRes.json();
            await fetch("/api/project-credits", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                project_id: projectId,
                role: member.role,
                unclaimed_profile_id: profileJson.profile.id,
              }),
            });
          })
        );
      }

      router.push(`/projects/${projectId}`);
    } catch {
      setCreateError("Netzwerkfehler — bitte erneut versuchen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileGuard>
      <div className="pt-16 min-h-screen bg-bg-primary">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

          <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-gold transition-colors mb-8">
            <ArrowLeft size={14} /> Zurück zu Projekten
          </Link>

          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
              <Clapperboard size={22} className="text-gold" />
            </div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Projekt hinzufügen</h1>
            <p className="text-sm text-text-muted mt-1">
              Suche zuerst ob das Projekt bereits existiert — so verhindern wir Duplikate.
            </p>
          </div>

          {/* ── SUCHE ─────────────────────────────────────────────────────── */}
          {!showCreate && (
            <>
              <div className="relative mb-2">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Projektitel suchen, z. B. "Bibi Blocksberg"'
                  className="w-full pl-10 pr-4 py-3.5 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                  autoFocus
                />
                {searching && (
                  <Loader2 size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />
                )}
              </div>

              {/* Results */}
              {searched && results.length > 0 && !joining && (
                <div className="border border-border rounded-xl overflow-hidden bg-bg-secondary mb-6">
                  <p className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-text-muted font-semibold border-b border-border">
                    Bestehende Projekte — zum Beitreten auswählen
                  </p>
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setJoinTarget(p); setJoining(p.id); }}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-bg-elevated transition-colors text-left group"
                    >
                      <div className="w-8 h-12 rounded bg-bg-elevated border border-border shrink-0 flex items-center justify-center overflow-hidden">
                        {p.poster_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.poster_url} alt="" className="w-full h-full object-cover" />
                          : <Clapperboard size={14} className="text-text-muted" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-text-primary truncate group-hover:text-gold transition-colors">
                            {p.title}
                          </span>
                          {p.verified && (
                            <ShieldCheck size={12} className="text-emerald-400 shrink-0" aria-label="Verifiziert" />
                          )}
                        </div>
                        <span className="text-xs text-text-muted">
                          {[p.type, p.year, p.director].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-text-muted group-hover:text-gold transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Join form */}
              {joining && joinTarget && (
                <div className="border border-gold/30 rounded-xl p-5 bg-gold/5 mb-6">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1">Beitreten</p>
                  <p className="text-sm font-bold text-text-primary mb-4">
                    {joinTarget.title} {joinTarget.year ? `(${joinTarget.year})` : ""}
                  </p>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">
                      Deine Rolle <span className="text-gold">*</span>
                    </label>
                    <RoleDropdown
                      value={joinRole}
                      onChange={setJoinRole}
                      options={ALL_ROLES}
                      placeholder="Rolle eingeben oder wählen…"
                    />
                  </div>
                  {joinError && (
                    <p className="text-xs text-red-400 mb-3 flex items-center gap-1.5">
                      <AlertCircle size={12} /> {joinError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleJoin}
                      disabled={joinSaving || !joinRole.trim()}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-50 text-sm"
                    >
                      {joinSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {joinSaving ? "Wird hinzugefügt…" : "Zum Projekt hinzufügen"}
                    </button>
                    <button
                      onClick={() => { setJoining(null); setJoinTarget(null); setJoinError(""); }}
                      className="px-4 py-2.5 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors"
                    >
                      Zurück
                    </button>
                  </div>
                </div>
              )}

              {/* Not found / create */}
              {!joining && (
                <div className={`rounded-xl border p-5 ${searched && results.length === 0 ? "border-gold/30 bg-gold/5" : "border-border bg-bg-secondary"}`}>
                  {searched && results.length === 0 ? (
                    <div className="flex items-start gap-3">
                      <AlertCircle size={16} className="text-gold shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-text-primary mb-1">
                          Kein passendes Projekt gefunden
                        </p>
                        <p className="text-xs text-text-muted mb-4">
                          Du kannst es neu anlegen. Es wird als ungeprüft markiert und kann später verifiziert werden.
                        </p>
                        <button
                          onClick={openCreate}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary font-semibold rounded-lg text-sm hover:bg-gold-light transition-colors"
                        >
                          <Plus size={14} /> Neues Projekt anlegen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">Projekt nicht dabei?</p>
                        <p className="text-xs text-text-muted mt-0.5">Erst suchen, dann neu anlegen</p>
                      </div>
                      <button
                        onClick={openCreate}
                        disabled={!searched}
                        className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-sm rounded-lg hover:border-gold hover:text-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus size={14} /> Neu anlegen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── NEUES PROJEKT ERSTELLEN ────────────────────────────────────── */}
          {showCreate && (
            <>
              <button
                onClick={() => setShowCreate(false)}
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors mb-6"
              >
                <ArrowLeft size={12} /> Zurück zur Suche
              </button>

              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
                <AlertCircle size={14} className="text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300">
                  Neues Projekt wird als <strong>ungeprüft</strong> angelegt. Bitte nur echte Produktionen eintragen.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">
                    Projekttitel <span className="text-gold">*</span>
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder='z. B. "Der letzte Schnitt"'
                    className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Typ</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
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
                      onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                      className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary focus:outline-none focus:border-gold transition-colors appearance-none"
                    >
                      <option value="">Jahr wählen</option>
                      {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">
                    Meine Rolle <span className="text-gold">*</span>
                  </label>
                  <RoleDropdown
                    value={form.myRole}
                    onChange={(v) => setForm((f) => ({ ...f, myRole: v }))}
                    options={ALL_ROLES}
                    placeholder="Rolle eingeben oder wählen…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Regie</label>
                    <input
                      value={form.director}
                      onChange={(e) => setForm((f) => ({ ...f, director: e.target.value }))}
                      placeholder="Name des Regisseurs"
                      className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Produktionsfirma</label>
                    <input
                      value={form.productionCompany}
                      onChange={(e) => setForm((f) => ({ ...f, productionCompany: e.target.value }))}
                      placeholder="Optional"
                      className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">Beschreibung</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder="Kurzbeschreibung, Festivalteilnahmen …"
                    className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
                  />
                </div>

                {/* Team members (ghost profiles) */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">
                    Teammitglieder <span className="text-text-muted font-normal normal-case">(optional — auch nicht registrierte Personen)</span>
                  </label>

                  {teamMembers.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {teamMembers.map((m, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-bg-elevated border border-border rounded-xl">
                          <div className="w-6 h-6 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-gold">{m.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-text-primary truncate">{m.name}</span>
                            <span className="text-text-muted mx-1.5">·</span>
                            <span className="text-xs text-text-muted">{m.role}</span>
                          </div>
                          <button type="button" onClick={() => removeMember(idx)} className="text-text-muted hover:text-red-400 transition-colors shrink-0">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      placeholder="Name der Person"
                      className="flex-1 min-w-0 px-3 py-2.5 bg-bg-secondary border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMember(); } }}
                    />
                    <div className="w-40 shrink-0">
                      <RoleDropdown
                        value={memberRole}
                        onChange={setMemberRole}
                        options={ALL_ROLES}
                        placeholder="Rolle…"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addMember}
                      disabled={!memberName.trim() || !memberRole.trim()}
                      className="px-3 py-2.5 bg-bg-elevated border border-border rounded-xl text-text-secondary hover:border-gold hover:text-gold transition-colors disabled:opacity-40 shrink-0"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1.5">
                    Sobald sie sich bei CineGenius anmelden, können sie das Profil übernehmen.
                  </p>
                </div>

                {createError && (
                  <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                    {createError}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving || !form.title.trim()}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {saving ? "Wird gespeichert…" : "Projekt anlegen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-3 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </ProfileGuard>
  );
}
