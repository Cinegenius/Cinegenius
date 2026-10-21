"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ArrowLeft, ArrowRight, Building2, Camera, CheckCircle2, Loader2,
  MapPin, Package, Search,
} from "lucide-react";
import { departments } from "@/lib/departments";
import { safeAuthRedirect } from "@/lib/auth-redirect";
import {
  findQuickStartRoles, getQuickStartProfileTypes, normalizeQuickStartDraft,
  QUICK_START_CATEGORIES, START_QUICK_START_DRAFT, validateQuickStartDetails,
  type QuickStartDraft, type QuickStartIntent,
} from "@/lib/quick-start-flow";

const paths: { id: QuickStartIntent; title: string; detail: string; Icon: typeof MapPin }[] = [
  { id: "search", title: "Ich möchte etwas finden", detail: "Menschen, Orte oder Dinge für ein Projekt", Icon: Search },
  { id: "location", title: "Ich möchte einen Ort anbieten", detail: "Zum Beispiel Wohnung, Haus, Café oder Studio", Icon: MapPin },
  { id: "equipment", title: "Ich möchte Dinge anbieten", detail: "Zum Beispiel Kamera, Licht, Kostüm oder Fahrzeug", Icon: Package },
  { id: "talent", title: "Ich möchte mit meinen Fähigkeiten gefunden werden", detail: "Zum Beispiel vor oder hinter der Kamera", Icon: Camera },
  { id: "company", title: "Ich möchte meine Firma vorstellen", detail: "Zum Beispiel Verleih, Studio oder Agentur", Icon: Building2 },
];
const suggestedRoles = ["Schauspieler", "Komparse", "Model", "Fotograf/in", "Editor", "Regisseur/in"]
  .map((term) => findQuickStartRoles(term, 1)[0])
  .filter((item) => Boolean(item));

type SaveState = "idle" | "saving" | "saved" | "error";
type Completion = { intent: QuickStartIntent; id?: string };

export default function ProfileSetupWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useUser();
  const redirectTo = safeAuthRedirect(params.get("redirect") ?? undefined, "", ["/sign-in", "/sign-up", "/profile-setup", "/guided-profile", "/guided-listing", "/company-setup"]);
  const [draft, setDraft] = useState<QuickStartDraft>(START_QUICK_START_DRAFT);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [pendingIntent, setPendingIntent] = useState<QuickStartIntent | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/onboarding", { cache: "no-store" }).then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Der gespeicherte Fortschritt konnte nicht geladen werden.");
        return result.draft;
      }),
      fetch("/api/profile", { cache: "no-store" }).then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Dein Profilstatus konnte nicht geprüft werden.");
        return result;
      }),
    ]).then(([saved, profile]) => {
      if (!active) return;
      if (profile?.exists) {
        router.replace(redirectTo ?? "/dashboard");
        return;
      }
      if (saved?.setupComplete) {
        router.replace(saved.intent === "search" ? (redirectTo ?? "/search") : (redirectTo ?? "/dashboard"));
        return;
      }
      const quickStart = saved?.quickStart ? normalizeQuickStartDraft(saved.quickStart) : null;
      setDraft(quickStart?.intent ? quickStart : START_QUICK_START_DRAFT);
      setReady(true);
    }).catch((cause) => {
      if (!active) return;
      setLoadError(cause instanceof Error ? cause.message : "Dein Start konnte nicht geladen werden.");
      setReady(true);
    });
    return () => { active = false; };
  }, [loadAttempt, redirectTo, router]);

  useEffect(() => {
    if (!ready || !draft.intent || draft.step < 2 || completion) return;
    if (draft.intent === "talent" && !draft.name && user?.fullName) {
      setDraft((current) => current.name ? current : { ...current, name: user.fullName ?? "" });
    }
  }, [ready, draft.intent, draft.step, draft.name, user?.fullName, completion]);

  const persist = useCallback((value: QuickStartDraft, setupComplete = false) => {
    setSaveState("saving");
    const queued = saveQueue.current.catch(() => false).then(async () => {
      try {
        const response = await fetch("/api/onboarding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: value.intent,
            setupComplete,
            quickStart: value,
            updatedAt: new Date().toISOString(),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Dein Fortschritt konnte nicht gespeichert werden.");
        setSaveState("saved");
        return true;
      } catch (cause) {
        setSaveState("error");
        setError(cause instanceof Error ? cause.message : "Dein Fortschritt konnte nicht gespeichert werden.");
        return false;
      }
    });
    saveQueue.current = queued;
    return queued;
  }, []);

  useEffect(() => {
    if (!ready || !draft.intent || draft.step < 2 || completion) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(draft); }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [ready, draft, completion, persist]);

  const roleMatches = useMemo(() => findQuickStartRoles(roleSearch), [roleSearch]);

  function update<K extends keyof QuickStartDraft>(key: K, value: QuickStartDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function choose(intent: QuickStartIntent, confirmedSwitch = false) {
    setError("");
    if (!confirmedSwitch && draft.intent && draft.intent !== intent
      && (draft.name.trim() || draft.city.trim() || draft.category || draft.title.trim() || draft.role)) {
      setPendingIntent(intent);
      return;
    }
    setPendingIntent(null);
    if (intent === "search") {
      setSaving(true);
      const next = { ...draft, intent, step: 3 as const };
      try {
        const ok = await persist(next, true);
        if (!ok) return;
        const response = await fetch("/api/onboarding?type=quick-start", { method: "DELETE" });
        if (!response.ok) throw new Error("Deine Suche ist bereit, aber der Einrichtungsstatus konnte nicht abgeschlossen werden. Bitte versuche es erneut.");
        router.replace(redirectTo ?? "/search");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Der Start konnte nicht abgeschlossen werden.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const samePath = draft.intent === intent;
    const next = {
      ...(samePath ? draft : { ...START_QUICK_START_DRAFT, name: draft.name, city: draft.city }),
      intent,
      step: 2 as const,
    };
    setSaving(true);
    const ok = await persist(next);
    if (ok) {
      setDraft(next);
      setRoleSearch("");
    }
    setSaving(false);
  }

  async function moveTo(step: 1 | 2 | 3) {
    setError("");
    if (step === 3) {
      const validation = validateQuickStartDetails(draft);
      if (validation) {
        setError(validation.message);
        document.getElementById(`quick-start-${validation.field}`)?.focus();
        return;
      }
    }
    const next = { ...draft, step };
    if (await persist(next)) setDraft(next);
  }

  async function clearAndContinue(result: Completion) {
    const response = await fetch("/api/onboarding?type=quick-start", { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Dein Einrichtungsstand konnte nicht abgeschlossen werden.");
    setCompletion(null);
    router.replace(redirectTo ?? (result.intent === "search" ? "/search" : "/dashboard"));
  }

  async function finish() {
    if (!draft.intent) return;
    const validation = validateQuickStartDetails(draft);
    if (validation) {
      setError(validation.message);
      document.getElementById(`quick-start-${validation.field}`)?.focus();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    const review = { ...draft, step: 3 as const };
    setSaving(true);
    setError("");
    try {
      if (!(await persist(review))) return;
      let result: Completion = { intent: draft.intent };
      if (draft.intent === "talent") {
        const profileTypes = getQuickStartProfileTypes(draft.departmentId, draft.role);
        const response = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: draft.name.trim(), location: draft.city.trim(),
            profile_types: profileTypes, profile_type: profileTypes[0] ?? null,
            positions: [draft.role], available: true,
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Dein Profil konnte nicht erstellt werden.");
      } else if (draft.intent === "location" || draft.intent === "equipment") {
        const vehicle = draft.intent === "equipment" && draft.category === "Bild-Fahrzeug";
        const response = await fetch("/api/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: vehicle ? "vehicle" : draft.intent === "location" ? "location" : "prop",
            category: draft.category,
            title: draft.title.trim(), city: draft.city.trim(), description: "", price: 0,
            image_url: null, draft: true, metadata: { price_on_request: true },
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.data?.id) throw new Error(body.error ?? "Der private Entwurf konnte nicht gespeichert werden.");
        result = { intent: draft.intent, id: body.data.id };
      } else if (draft.intent === "company") {
        const response = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: draft.name.trim(), city: draft.city.trim(), draft: true }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.data?.id) throw new Error(body.error ?? "Der private Firmenentwurf konnte nicht gespeichert werden.");
        result = { intent: "company", id: body.data.id };
      }
      setCompletion(result);
      await clearAndContinue(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dein Start konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function retryFinish() {
    if (!completion) return;
    setSaving(true);
    setError("");
    try { await clearAndContinue(completion); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Der Einrichtungsstatus konnte nicht abgeschlossen werden."); }
    finally { setSaving(false); }
  }

  const roleDepartment = departments.find((department) => department.id === draft.departmentId);
  const intent = draft.intent;
  const categoryOptions = intent === "location" || intent === "equipment" ? QUICK_START_CATEGORIES[intent] : [];
  const selectedCategory = categoryOptions.find((item) => item.value === draft.category);
  const savedLabel = saveState === "saving" ? "Speichert …" : saveState === "saved" ? "Gespeichert" : saveState === "error" ? "Nicht gespeichert" : "";

  if (!ready) return <main className="min-h-screen bg-bg-primary px-4 pt-32 text-center text-sm text-text-muted"><Loader2 className="mx-auto mb-3 animate-spin" />Dein Start wird geladen …</main>;

  if (loadError) return <main className="min-h-[75vh] bg-bg-primary px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-24 sm:pt-28"><section className="mx-auto max-w-xl rounded-2xl border border-border bg-bg-secondary p-6 text-center"><p role="alert" className="text-sm leading-6 text-red-300">{loadError}</p><p className="mt-2 text-xs leading-5 text-text-muted">Damit kein gespeicherter Fortschritt verloren geht, starte bitte erst weiter, wenn der Status geladen wurde.</p><button type="button" onClick={() => { setReady(false); setLoadError(""); setLoadAttempt((value) => value + 1); }} className="mt-5 min-h-12 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary">Erneut versuchen</button></section></main>;

  if (completion) return <main className="min-h-[75vh] bg-bg-primary px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-24 sm:pt-28"><section className="mx-auto max-w-xl rounded-3xl border border-border bg-bg-secondary p-6 text-center sm:p-9"><CheckCircle2 size={42} className="mx-auto mb-4 text-gold" /><h1 className="mb-2 font-display text-2xl font-bold text-text-primary">Deine Angaben sind gespeichert</h1><p className="mb-6 text-sm leading-6 text-text-muted">{completion.intent === "talent" ? "Dein Profil wurde mit deiner Zustimmung erstellt und ist für andere Mitglieder sichtbar." : "Dein Entwurf ist privat. Du kannst ihn später ergänzen und selbst ausdrücklich veröffentlichen."}</p>{error && <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}<button disabled={saving} onClick={() => void retryFinish()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : null}Weiter zu CineGenius</button></section></main>;

  return (
    <main className="min-h-[75vh] bg-bg-primary px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-24 sm:pt-28">
      <div className="mx-auto max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Dein Start auf CineGenius</p>
        <h1 className="mb-2 font-display text-3xl font-bold text-text-primary sm:text-4xl">
          {draft.step === 1 ? "Was möchtest du hier machen?" : draft.step === 2 ? "Die wichtigsten Angaben" : "Prüfen und loslegen"}
        </h1>
        <p className="mb-6 max-w-2xl text-sm leading-6 text-text-muted">
          {draft.step === 1 ? "Wähle den Weg, der am besten zu dir passt. Weitere Angaben kannst du später ergänzen." : draft.step === 2 ? "Nur das Nötigste für deinen gewählten Weg. Du kannst den Fortschritt später fortsetzen." : "Prüfe kurz die Angaben. Nichts wird ohne deine ausdrückliche Bestätigung veröffentlicht."}
        </p>

        <div className="mb-6" aria-label={`Schritt ${draft.step} von 3`}>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-text-muted"><span>Schritt {draft.step} von 3</span><span aria-live="polite">{savedLabel}</span></div>
          <div className="h-1.5 rounded-full bg-bg-elevated"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${draft.step / 3 * 100}%` }} /></div>
        </div>

        <section className="rounded-2xl border border-border bg-bg-secondary p-4 sm:p-7">
          {draft.step === 1 && <>
          {pendingIntent && <div role="group" aria-label="Weg wechseln" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4"><p className="text-sm font-medium text-text-primary">Möchtest du den Weg wirklich wechseln?</p><p className="mt-1 text-xs leading-5 text-text-muted">Deine bisherigen Eingaben für diesen Weg werden dabei gelöscht.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void choose(pendingIntent, true)} className="min-h-11 rounded-lg bg-amber-400/20 px-3 text-xs font-semibold text-amber-100">Weg wechseln und Angaben löschen</button><button type="button" onClick={() => setPendingIntent(null)} className="min-h-11 rounded-lg border border-border px-3 text-xs text-text-primary">Weiter bearbeiten</button></div></div>}
          <div className="grid gap-3 sm:grid-cols-2">
            {paths.map(({ id, title, detail, Icon }) => <button key={id} type="button" disabled={saving} onClick={() => void choose(id)} className="group flex min-h-24 min-w-0 items-center gap-4 rounded-2xl border border-border bg-bg-primary p-4 text-left transition hover:border-gold/60 hover:bg-bg-elevated disabled:opacity-60">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold"><Icon size={20} /></span>
              <span className="min-w-0 flex-1"><strong className="block break-words text-sm leading-5 text-text-primary">{title}</strong><span className="mt-1 block text-xs leading-5 text-text-muted">{detail}</span></span>
              {saving ? <Loader2 className="shrink-0 animate-spin text-gold" size={18} /> : <ArrowRight className="shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-gold" size={18} />}
            </button>)}
          </div>
          </>}

          {draft.step === 2 && intent && <div className="space-y-5">
            {(intent === "location" || intent === "equipment") && <>
              <fieldset>
                <legend className="mb-3 text-sm font-medium text-text-primary">{intent === "location" ? "Was für einen Ort möchtest du anbieten?" : "Was möchtest du anbieten?"} <span className="text-gold">*</span></legend>
                <div className="grid gap-2 sm:grid-cols-2">{categoryOptions.map((item) => <button key={item.value} type="button" aria-pressed={draft.category === item.value} onClick={() => update("category", item.value)} className={`min-h-14 rounded-xl border px-4 py-3 text-left transition ${draft.category === item.value ? "border-gold bg-gold/10" : "border-border bg-bg-primary hover:border-gold/40"}`}><strong className="block text-sm text-text-primary">{item.label}</strong><span className="mt-1 block text-xs leading-4 text-text-muted">{item.example}</span></button>)}</div>
              </fieldset>
              <div><label htmlFor="quick-start-title" className="mb-2 block text-sm font-medium text-text-primary">Wie soll dein Angebot heißen? <span className="text-gold">*</span></label><input id="quick-start-title" maxLength={200} autoComplete="off" value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder={intent === "location" ? "Zum Beispiel Helle Wohnung mit Balkon" : "Zum Beispiel LED-Leuchte mit Stativen"} className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div>
            </>}

            {intent === "talent" && <>
              <div><label htmlFor="quick-start-name" className="mb-2 block text-sm font-medium text-text-primary">Wie dürfen wir dich nennen? <span className="text-gold">*</span></label><input id="quick-start-name" autoComplete="name" maxLength={120} value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Vor- und Nachname oder Künstlername" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div>
              <div><label htmlFor="quick-start-role" className="mb-2 block text-sm font-medium text-text-primary">Was machst du? <span className="text-gold">*</span></label><div className="relative"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" /><input id="quick-start-role" autoComplete="off" value={roleSearch || (draft.role ? draft.role : "")} onChange={(event) => { setRoleSearch(event.target.value); if (draft.role) setDraft((current) => ({ ...current, role: "", departmentId: "" })); }} placeholder="Zum Beispiel Model, Schauspiel oder Kamera" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary pl-10 pr-4 text-sm text-text-primary outline-none focus:border-gold" aria-describedby="quick-start-role-help" /></div><p id="quick-start-role-help" className="mt-2 text-xs leading-5 text-text-muted">Suche nach einem Beruf oder einer Tätigkeit. Du kannst später weitere ergänzen.</p>
                {draft.role && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">{draft.role}{roleDepartment ? ` · ${roleDepartment.label}` : ""}</span><button type="button" onClick={() => { update("role", ""); update("departmentId", ""); setRoleSearch(""); }} className="min-h-11 rounded-lg px-2 text-xs text-text-muted underline">Ändern</button></div>}
                {roleSearch.trim() && <ul role="listbox" aria-label="Passende Tätigkeiten" className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-bg-primary p-1">{roleMatches.map((item) => <li key={`${item.departmentId}:${item.role}`}><button type="button" role="option" aria-selected={draft.role === item.role && draft.departmentId === item.departmentId} onClick={() => { update("role", item.role); update("departmentId", item.departmentId); setRoleSearch(""); }} className="flex min-h-11 w-full flex-col justify-center rounded-lg px-3 py-2 text-left hover:bg-bg-elevated"><span className="text-sm text-text-primary">{item.role}</span><span className="text-[11px] text-text-muted">{item.departmentLabel}</span></button></li>)}{roleMatches.length === 0 && <li className="px-3 py-4 text-sm text-text-muted">Keine passende Tätigkeit gefunden. Versuche einen anderen Begriff.</li>}</ul>}
                {!roleSearch.trim() && !draft.role && <div className="mt-3 flex flex-wrap gap-2">{suggestedRoles.map((item) => <button key={`${item.departmentId}:${item.role}`} type="button" onClick={() => { update("role", item.role); update("departmentId", item.departmentId); }} className="min-h-11 rounded-full border border-border px-3 text-xs text-text-muted hover:border-gold/50 hover:text-text-primary">{item.role}</button>)}</div>}
              </div>
            </>}

            {intent === "company" && <div><label htmlFor="quick-start-name" className="mb-2 block text-sm font-medium text-text-primary">Wie heißt deine Firma? <span className="text-gold">*</span></label><input id="quick-start-name" autoComplete="organization" maxLength={120} value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Firmenname" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /></div>}

            <div><label htmlFor="quick-start-city" className="mb-2 block text-sm font-medium text-text-primary">{intent === "talent" ? "Wohnort oder Region" : "Wo befindet sich das?"} <span className="text-gold">*</span></label><input id="quick-start-city" autoComplete="address-level2" maxLength={100} value={draft.city} onChange={(event) => update("city", event.target.value)} placeholder="Zum Beispiel Leipzig" className="min-h-12 w-full rounded-xl border border-border bg-bg-primary px-4 text-sm text-text-primary outline-none focus:border-gold" /><p className="mt-2 text-xs leading-5 text-text-muted">Stadt oder Region genügt. Eine genaue Privatadresse brauchst du hier nicht.</p></div>
          </div>}

          {draft.step === 3 && intent && <div className="space-y-4">
            {intent === "talent" ? <>
              <ReviewRow label="Name" value={draft.name} />
              <ReviewRow label="Tätigkeit" value={draft.role} />
              <ReviewRow label="Gewerk" value={departmentsLabel(draft.departmentId)} />
              <ReviewRow label="Wohnort oder Region" value={draft.city} />
              <p className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 text-xs leading-5 text-text-muted">Mit dem folgenden Button erstellst du dein Profil sichtbar für andere Mitglieder. Foto, weitere Tätigkeiten und ausführliche Angaben kannst du danach ergänzen.</p>
            </> : intent === "company" ? <>
              <ReviewRow label="Firma" value={draft.name} />
              <ReviewRow label="Standort" value={draft.city} />
              <p className="rounded-xl border border-border bg-bg-primary p-3 text-xs leading-5 text-text-muted">Dein Firmenprofil wird als privater Entwurf angelegt. Erst wenn du es später ausdrücklich veröffentlichst, ist es für andere sichtbar.</p>
            </> : <>
              <ReviewRow label="Angebot" value={draft.title} />
              <ReviewRow label="Art" value={selectedCategory?.label ?? draft.category} />
              <ReviewRow label="Standort" value={draft.city} />
              <p className="rounded-xl border border-border bg-bg-primary p-3 text-xs leading-5 text-text-muted">Dein Angebot wird als privater Entwurf gespeichert. Es erscheint nicht öffentlich, bis du es später ausdrücklich veröffentlichst.</p>
            </>}
          </div>}
        </section>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        {draft.step > 1 && <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center"><button type="button" disabled={saving} onClick={() => void moveTo(draft.step === 3 ? 2 : 1)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm text-text-primary disabled:opacity-50"><ArrowLeft size={16} /> Zurück</button>{draft.step === 2 ? <button type="button" disabled={saving} onClick={() => void moveTo(3)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">Weiter <ArrowRight size={16} /></button> : <button type="button" disabled={saving} onClick={() => void finish()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-bg-primary disabled:opacity-50">{saving ? <><Loader2 size={16} className="animate-spin" /> Wird gespeichert …</> : <>{intent === "talent" ? "Profil öffentlich erstellen" : intent === "company" ? "Privaten Firmenentwurf speichern" : "Privaten Angebotsentwurf speichern"} <ArrowRight size={16} /></>}</button>}</div>}
        {draft.step === 1 && <p className="mt-4 text-center text-xs text-text-muted">Deine Auswahl wird privat gespeichert. Du kannst später weitermachen.</p>}
      </div>
    </main>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-bg-primary px-4 py-3"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 break-words text-sm font-medium text-text-primary">{value || "—"}</p></div>;
}

function departmentsLabel(departmentId: string) {
  const item = departments.find((department) => department.id === departmentId);
  return item?.label ?? "";
}
