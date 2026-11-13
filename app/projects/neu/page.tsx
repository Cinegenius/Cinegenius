"use client";
import { projectTypeLabel } from "@/lib/project-type-labels";
import { useFormRouter as useRouter } from "@/lib/use-form-router";

import { useFormDraft } from "@/lib/use-form-draft";
import FormDraftStatus from "@/components/FormDraftStatus";
import { useState, useEffect } from "react";

import Link from "next/link";
import {
  ArrowLeft, Clapperboard, Loader2, Check, Search, Plus, X,
  ChevronRight, ShieldCheck, AlertCircle,
} from "lucide-react";
import ProjectFlowSteps from "@/components/ProjectFlowSteps";
import MediaImage from "@/components/MediaImage";
import ProfileGuard from "@/components/ProfileGuard";
import RoleDropdown from "@/components/RoleDropdown";
import { departments } from "@/lib/departments";
import { useTranslations } from "next-intl";


const ALL_ROLES = departments.flatMap((d) => d.roles);

const PROJECT_TYPES = [
  "Spielfilm", "Kurzfilm", "Serie", "Dokumentation",
  "Werbefilm", "Imagefilm", "Musikvideo", "Corporate",
  "Social Media", "Foto / Shooting", "Event", "Sonstiges",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR + 6 - 1900 }, (_, i) => CURRENT_YEAR + 5 - i);

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
  const uiText = useTranslations();
  const uiOptionLabels: Record<string, string> = {
    "Spielfilm": uiText("Ui.text_031b1c1fc4b241"),
    "Kurzfilm": uiText("Ui.text_75b346d26e4973"),
    "Serie": uiText("Ui.text_ab7743a4ad9a44"),
    "Dokumentation": uiText("projects.catDokumentation"),
    "Werbefilm": uiText("Ui.text_5c634ccc3ba66d"),
    "Imagefilm": uiText("Ui.text_411e73c2f310f4"),
    "Musikvideo": uiText("projects.catMusikvideo"),
    "Corporate": uiText("projects.catCorporate"),
    "Social Media": uiText("home.showcaseSocial"),
    "Foto / Shooting": uiText("Ui.text_f1ff7fc6fb8449"),
    "Event": uiText("Organizations.entryType.event"),
    "Sonstiges": uiText("profile.typeOther"),
  };






  const router = useRouter();

  // ── Step 1: search ───────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExistingProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchAttempt, setSearchAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/projects?q=${encodeURIComponent(query.trim())}&limit=8`, { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) throw new Error("search_failed");
        if (!controller.signal.aborted) { setResults(json.projects ?? []); setSearched(true); }
      } catch {
        if (!controller.signal.aborted) setSearchError(uiText("System.requestFailed"));
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, searchAttempt, uiText]);

  // ── Join existing ─────────────────────────────────────────────────────────────
  const [joining, setJoining] = useState<string | null>(null);
  const [joinRole, setJoinRole] = useState("");
  const [joinTarget, setJoinTarget] = useState<ExistingProject | null>(null);
  const [joinSaving, setJoinSaving] = useState(false);
  const [joinError, setJoinError] = useState("");

  async function handleJoin() {
    if (!joinTarget || !joinRole.trim()) { setJoinError(uiText("Ui.text_82470efaf4a588")); return; }
    setJoinSaving(true); setJoinError("");
    try {
      const res = await fetch("/api/project-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: joinTarget.id, role: joinRole.trim() }),
      });
      if (!res.ok) { const j = await res.json(); setJoinError(j.error ?? uiText("Ui.text_f6cc01cb7edbf0")); return; }
      router.push(`/projects/${joinTarget.id}`);
    } catch {
      setJoinError(uiText("System.requestFailed"));
    } finally {
      setJoinSaving(false);
    }
  }

  // ── Step 2: create new ────────────────────────────────────────────────────────
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
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

  const projectDraft = useFormDraft({ formKey: "project:quick", value: { form, teamMembers, memberName, memberRole, requestKey },
    restore: (draft) => { if (draft.requestKey) setRequestKey(draft.requestKey); setForm(draft.form); setTeamMembers(draft.teamMembers); setMemberName(draft.memberName); setMemberRole(draft.memberRole); setShowCreate(true); },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectDraft.loaded) return;
    if (!form.title.trim()) { setCreateError(uiText("Ui.text_c2018abde6e3d8")); return; }
    setSaving(true); setCreateError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey,
          title: form.title.trim(),
          year: form.year || null,
          type: form.type || null,
          director: form.director.trim() || null,
          description: form.description.trim() || null,
          myRole: form.myRole.trim() || null,
          productionCompany: form.productionCompany.trim() || null,
          crew_entries: teamMembers.map((member) => ({
            name: member.name,
            role: member.role,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json.error ?? uiText("Ui.text_f6cc01cb7edbf0")); return; }
      if (!json.draft?.id) throw new Error(uiText("Ui.text_0d36134dd2e27a"));
      await projectDraft.complete();
      router.push(`/dashboard/projects/drafts/${json.draft.id}`);
    } catch {
      setCreateError(uiText("Ui.text_294a4d573e5e5f"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileGuard>
      <div className="pt-16 min-h-screen bg-bg-primary mobile-bottom-nav-clear">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

          <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-gold transition-colors mb-8">{uiText.rich("Ui.text_3613d87ef6ba76", { part1: () => (<ArrowLeft size={14} />) })}</Link>

          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
              <Clapperboard size={22} className="text-gold" />
            </div>
            <h1 className="font-display text-2xl font-bold text-text-primary">{uiText("Ui.text_4fa2d0afa57f46")}</h1>
            <p className="text-sm text-text-muted mt-1">{uiText("Ui.text_50c0a8ba7046f3")}</p>
          </div>

          <ProjectFlowSteps current={showCreate ? 1 : 0} />
          <p className="mb-6 text-sm leading-relaxed text-text-muted">{uiText("projects.publishingRules")}</p>

          {/* ── SUCHE ─────────────────────────────────────────────────────── */}
          {!showCreate && (
            <>
              <div className="relative mb-2">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setResults([]); setSearched(false); setSearchError(""); setSearching(false); }}
                  placeholder={uiText("Ui.text_2df366bc58aa2c")}
                  className="w-full pl-10 pr-4 py-3.5 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                  autoFocus
                />
                {searching && (
                  <Loader2 size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />
                )}
              </div>

              {searchError && <div role="alert" className="mb-4 rounded-xl border border-border p-4 text-sm text-text-secondary"><p>{searchError}</p><button type="button" className="mt-2 min-h-11 text-gold" onClick={() => setSearchAttempt(value => value + 1)}>{uiText("setup.copy49")}</button></div>}
              {/* Results */}
              {searched && results.length > 0 && !joining && (
                <div className="border border-border rounded-xl overflow-hidden bg-bg-secondary mb-6">
                  <p className="px-4 py-2.5 text-[10px] uppercase tracking-widest text-text-muted font-semibold border-b border-border">{uiText("Ui.text_8296bde358a2ac")}</p>
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setJoinTarget(p); setJoining(p.id); }}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-bg-elevated transition-colors text-left group"
                    >
                      <div className="w-8 h-12 rounded bg-bg-elevated border border-border shrink-0 flex items-center justify-center overflow-hidden">
                        {p.poster_url
                          ? <MediaImage src={p.poster_url} width={32} height={48} alt="" className="w-full h-full object-cover" />
                          : <Clapperboard size={14} className="text-text-muted" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-text-primary truncate group-hover:text-gold transition-colors">
                            {p.title}
                          </span>
                          {p.verified && (
                            <ShieldCheck size={12} className="text-emerald-400 shrink-0" aria-label={uiText("common.verified")} />
                          )}
                        </div>
                        <span className="text-xs text-text-muted">
                          {[p.type ? projectTypeLabel(p.type, uiText) : p.type, p.year, p.director].filter(Boolean).join(" · ")}
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
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-1">{uiText("Ui.text_82a93e81d1397c")}</p>
                  <p className="text-sm font-bold text-text-primary mb-4">
                    {joinTarget.title} {joinTarget.year ? uiText("Ui.text_1a37d34e227808", { value1: String(joinTarget.year) }) : ""}
                  </p>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">{uiText.rich("Ui.text_14df02841f6a38", { part1: chunks => (<span className="text-gold">{chunks}</span>) })}</label>
                    <RoleDropdown
                      value={joinRole}
                      onChange={setJoinRole}
                      options={ALL_ROLES}
                      placeholder={uiText("Ui.text_050e4c4db66fb2")}
                    />
                  </div>
                  <p className="mb-3 text-xs leading-relaxed text-text-muted">{uiText("projects.creditsNotice")}</p>
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
                      {joinSaving ? uiText("Ui.text_24c82e62f86e8a") : uiText("Ui.text_3f8a40824fc2e4")}
                    </button>
                    <button
                      onClick={() => { setJoining(null); setJoinTarget(null); setJoinError(""); }}
                      className="px-4 py-2.5 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors"
                    >{uiText("setup.copy99")}</button>
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
                        <p className="text-sm font-semibold text-text-primary mb-1">{uiText("Ui.text_0dc05b94ba2d4c")}</p>
                        <p className="text-xs text-text-muted mb-4">{uiText("Ui.text_ab401a4bdbf122")}</p>
                        <button
                          onClick={openCreate}
                          className="inline-flex min-h-11 items-center gap-2 px-4 py-2 bg-gold text-bg-primary font-semibold rounded-lg text-sm hover:bg-gold-light transition-colors"
                        >{uiText.rich("Ui.text_bfc831b36e6f61", { part1: () => (<Plus size={14} />) })}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{uiText("Ui.text_dbd4e52434c787")}</p>
                        <p className="text-xs text-text-muted mt-0.5">{uiText("Ui.text_1b35653109e48d")}</p>
                      </div>
                      <button
                        onClick={openCreate}
                        disabled={!searched || searching || Boolean(searchError)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-sm rounded-lg hover:border-gold hover:text-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >{uiText.rich("Ui.text_3d70e5d8e24436", { part1: () => (<Plus size={14} />) })}</button>
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
              >{uiText.rich("Ui.text_463eb948b49aea", { part1: () => (<ArrowLeft size={12} />) })}</button>

              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
                <AlertCircle size={14} className="text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300">{uiText.rich("Ui.text_cb835b6411725a", { part1: chunks => (<strong>{chunks}</strong>) })}</p>
              </div>

              <FormDraftStatus draft={projectDraft} /><form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">{uiText.rich("Ui.text_021a7d57480275", { part1: chunks => (<span className="text-gold">{chunks}</span>) })}</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder={uiText("Ui.text_0803d108114dda")}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">{uiText("projects.colType")}</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                      className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary focus:outline-none focus:border-gold transition-colors appearance-none"
                    >
                      <option value="">{uiText("Ui.text_fe64193742c376")}</option>
                      {PROJECT_TYPES.map((t) => <option key={t} value={t}>{(uiOptionLabels[t] ?? t)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">{uiText("projects.filterYear")}</label>
                    <select
                      value={form.year}
                      onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                      className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary focus:outline-none focus:border-gold transition-colors appearance-none"
                    >
                      <option value="">{uiText("Ui.text_4420e2c948470e")}</option>
                      {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">{uiText.rich("Ui.text_baf8a1a1d96fc5", { part1: chunks => (<span className="text-gold">{chunks}</span>) })}</label>
                  <RoleDropdown
                    value={form.myRole}
                    onChange={(v) => setForm((f) => ({ ...f, myRole: v }))}
                    options={ALL_ROLES}
                    placeholder={uiText("Ui.text_050e4c4db66fb2")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">{uiText("menu.crewDirection")}</label>
                    <input
                      value={form.director}
                      onChange={(e) => setForm((f) => ({ ...f, director: e.target.value }))}
                      placeholder={uiText("Ui.text_98a89ad69959cc")}
                      className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">{uiText("profile.labelProductionCompany")}</label>
                    <input
                      value={form.productionCompany}
                      onChange={(e) => setForm((f) => ({ ...f, productionCompany: e.target.value }))}
                      placeholder={uiText("setup.copy38")}
                      className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">{uiText("setup.description")}</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder={uiText("Ui.text_2096a7deadd6f7")}
                    className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
                  />
                </div>

                {/* Team members (ghost profiles) */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-widest mb-2">{uiText.rich("Ui.text_6970c8fe537d71", { part1: chunks => (<span className="text-text-muted font-normal normal-case">{chunks}</span>) })}</label>

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
                      placeholder={uiText("Ui.text_a4f19fdc93c825")}
                      className="flex-1 min-w-0 px-3 py-2.5 bg-bg-secondary border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-gold transition-colors"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMember(); } }}
                    />
                    <div className="w-40 shrink-0">
                      <RoleDropdown
                        value={memberRole}
                        onChange={setMemberRole}
                        options={ALL_ROLES}
                        placeholder={uiText("Ui.text_21e932322d0ac7")}
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
                  <p className="text-[11px] text-text-muted mt-1.5">{uiText("Ui.text_2ac390d94b6af5")}</p>
                </div>

                {createError && (
                  <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                    {createError}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={!projectDraft.loaded || saving || !form.title.trim()}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {saving ? uiText("AdminReview.saving") : uiText("Ui.text_bdbe2a07aebfbc")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-3 border border-border text-text-secondary text-sm rounded-xl hover:border-gold hover:text-gold transition-colors"
                  >{uiText("home.boardCancel")}</button>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </ProfileGuard>
  );
}
