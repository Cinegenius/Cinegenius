"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/components/MediaImage";
import { COMPANY_PUBLIC_TITLE_SUGGESTIONS, normalizeCompanyPublicTitles } from "@/lib/company-roles";

type Person = { user_id: string; display_name: string; avatar_url: string | null; slug: string | null; role: string | null; positions?: string[]; location: string | null };
type Invitation = { id: string; public_titles: string[]; status: string; created_at: string; expires_at: string; profile: Person | null; companies: { name: string; slug: string; logo_url: string | null } | null };
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Die Aktion konnte nicht gespeichert werden.");
  return result;
}
export function CompanyMemberInvitations({ companyId, mode }: { companyId?: string; mode: "add" | "list" | "received" }) {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [titles, setTitles] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const locked = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await request<{ data: Invitation[]; total: number }>(`/api/company-invitations?page=${page}${companyId ? `&company_id=${encodeURIComponent(companyId)}` : ""}`); setInvitations(result.data); setTotal(result.total ?? result.data.length); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Einladungen konnten nicht geladen werden."); }
    finally { setLoading(false); }
  }, [companyId, page]);
  useEffect(() => { if (mode !== "add") void load(); }, [load, mode]);
  useEffect(() => {
    if (mode !== "add" || !companyId || q.trim().length < 2) { setPeople([]); setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true); setError("");
    const timer = setTimeout(() => {
      void request<{ data: Person[] }>(`/api/company-member-search?company_id=${encodeURIComponent(companyId)}&q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((result) => setPeople(result.data))
        .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Suche fehlgeschlagen."); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); setSearching(false); };
  }, [q, companyId, mode]);
  async function invite() {
    const publicTitles = normalizeCompanyPublicTitles([...titles, customTitle.trim()]);
    if (!person || !publicTitles.length || locked.current) return;
    locked.current = true; setBusy(person.user_id); setError(""); setNotice("");
    try {
      await request("/api/company-invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company_id: companyId, recipient_user_id: person.user_id, public_titles: publicTitles }) });
      setNotice(`Einladung an ${person.display_name} gesendet. Erst nach Annahme wird die Zugehörigkeit öffentlich.`);
      setPerson(null); setPeople([]); setQ(""); setTitles([]); setCustomTitle("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Einladung fehlgeschlagen."); }
    finally { locked.current = false; setBusy(null); }
  }
  async function decide(id: string, decision: "accept" | "decline" | "revoke") {
    if (locked.current) return;
    locked.current = true; setBusy(id); setError(""); setNotice("");
    try {
      await request("/api/company-invitations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      setNotice(decision === "accept" ? "Einladung angenommen. Deine bestätigte Firmenzugehörigkeit ist jetzt öffentlich. Du erhältst dadurch keine Verwaltungsrechte." : decision === "decline" ? "Einladung abgelehnt." : "Einladung zurückgezogen.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Antwort konnte nicht gespeichert werden."); }
    finally { locked.current = false; setBusy(null); }
  }
  return <div className="space-y-4">
    {notice && <p role="status" className="rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-success">{notice}</p>}
    {error && <p role="alert" className="rounded-xl border border-crimson/20 bg-crimson/10 p-4 text-sm text-crimson-light">{error}</p>}
    {mode === "add" ? <section className="space-y-4 rounded-xl border border-border bg-bg-secondary p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-text-primary">Registriertes Mitglied hinzufügen</h3>
      <p className="text-sm text-text-muted">Suche die Person und lege die angebotene Funktion fest. Die Person bestätigt selbst, ob sie dem Team angehört. Eine Einladung ist keine Bewerbung und verleiht keine Verwaltungsrechte.</p>
      <label className="block text-sm text-text-secondary">Mitglied suchen<input type="search" value={q} disabled={Boolean(busy)} onChange={(event) => { setQ(event.target.value); setPerson(null); }} placeholder="Mindestens zwei Buchstaben des Namens" className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-text-primary" /></label>
      {searching ? <p role="status" className="text-sm text-text-muted">Mitglieder werden gesucht…</p> : q.trim().length >= 2 && !person && <div className="max-h-80 space-y-2 overflow-y-auto">{people.length ? people.map((p) => <button type="button" key={p.user_id} onClick={() => setPerson(p)} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-gold">{p.avatar_url && <Image src={p.avatar_url} alt="" width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-full object-cover" />}<span className="min-w-0"><strong className="block break-words text-sm text-text-primary">{p.display_name}</strong><span className="block break-words text-xs text-text-muted">{[p.role || p.positions?.slice(0, 2).join(" · "), p.location].filter(Boolean).join(" · ")}</span></span></button>) : <p className="text-sm text-text-muted">Keine verfügbaren Profile gefunden. Prüfe den Namen oder grenze die Suche ein. Bestehende Mitglieder, Anfragen und Einladungen werden nicht erneut angeboten.</p>}</div>}
      {person && <div className="space-y-4 border-t border-border pt-4">
        <p className="text-sm text-text-primary">Einladung an <Link href={`/profile/${person.slug || person.user_id}`} className="font-semibold text-gold">{person.display_name}</Link>{person.location ? ` · ${person.location}` : ""}</p>
        <fieldset><legend className="mb-2 text-sm text-text-secondary">Öffentliche Funktionen (bis zu fünf)</legend><div className="flex flex-wrap gap-2">{COMPANY_PUBLIC_TITLE_SUGGESTIONS.map((title) => <button type="button" key={title} disabled={Boolean(busy) || (!titles.includes(title) && titles.length >= 5)} aria-pressed={titles.includes(title)} onClick={() => setTitles((current) => current.includes(title) ? current.filter((t) => t !== title) : [...current, title])} className={`min-h-11 rounded-full border px-3 text-xs ${titles.includes(title) ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{title}</button>)}</div></fieldset>
        <label className="block text-sm text-text-secondary">Individuelle Berufsbezeichnung (optional)<input value={customTitle} disabled={Boolean(busy)} maxLength={80} onChange={(event) => setCustomTitle(event.target.value)} placeholder="z. B. Technische Leitung oder Catering-Leitung" className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-text-primary" /></label>
        <p className="text-xs text-text-muted">Verwaltungsrecht: Teammitglied. Berechtigungen lassen sich nach der Annahme separat durch die Kontoinhaberschaft vergeben.</p>
        <button type="button" disabled={Boolean(busy) || (!titles.length && !customTitle.trim()) || titles.length + (customTitle.trim() ? 1 : 0) > 5} onClick={() => void invite()} className="min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary disabled:opacity-50">{busy ? "Einladung wird gespeichert…" : "Einladung senden"}</button>
      </div>}
    </section> : <section className="space-y-3">
      <h3 className="text-lg font-semibold text-text-primary">{mode === "received" ? "Deine Teameinladungen" : "Ausstehende Einladungen"}</h3>
      {loading ? <p role="status" className="text-sm text-text-muted">Einladungen werden geladen…</p> : !invitations.length ? <p className="text-sm text-text-muted">Keine Einladungen vorhanden.</p> : invitations.map((invite) => {
        const pending = invite.status === "pending" && new Date(invite.expires_at).getTime() > Date.now();
        const label = pending ? "Bestätigung ausstehend" : invite.status === "claimed" ? "Angenommen" : invite.status === "declined" ? "Abgelehnt" : invite.status === "revoked" ? "Zurückgezogen" : "Abgelaufen";
        return <article key={invite.id} className="space-y-3 rounded-xl border border-border bg-bg-secondary p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><Link href={mode === "received" ? `/companies/${invite.companies?.slug}` : `/profile/${invite.profile?.slug || invite.profile?.user_id}`} className="break-words font-semibold text-text-primary hover:text-gold">{mode === "received" ? invite.companies?.name : invite.profile?.display_name || "Mitglied"}</Link><span className="text-xs text-text-muted">{label}</span></div>
          <p className="break-words text-sm text-text-secondary">{invite.public_titles.join(" · ")}</p>
          <p className="text-xs text-text-muted">{new Date(invite.created_at).toLocaleDateString("de-DE")} · Gültig bis {new Date(invite.expires_at).toLocaleDateString("de-DE")}</p>
          {pending && <div className="flex flex-wrap justify-end gap-2">{mode === "received" ? <><button disabled={Boolean(busy)} onClick={() => void decide(invite.id, "decline")} className="min-h-11 rounded-lg border border-border px-3 text-sm text-text-secondary">Ablehnen</button><button disabled={Boolean(busy)} onClick={() => void decide(invite.id, "accept")} className="min-h-11 rounded-lg bg-gold px-4 text-sm font-semibold text-bg-primary">{busy === invite.id ? "Wird gespeichert…" : "Einladung annehmen"}</button></> : <button disabled={Boolean(busy)} onClick={() => void decide(invite.id, "revoke")} className="min-h-11 rounded-lg border border-border px-3 text-sm text-text-secondary">{busy === invite.id ? "Wird gespeichert…" : "Einladung zurückziehen"}</button>}</div>}
        </article>;
      })}
      {total > 20 && <nav aria-label="Einladungsseiten" className="flex items-center justify-between gap-2 text-sm text-text-muted"><button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className="min-h-11 rounded-lg border border-border px-3 disabled:opacity-40">Zurück</button><span>Seite {page} · {total} Einladungen</span><button disabled={page * 20 >= total || loading} onClick={() => setPage(p => p + 1)} className="min-h-11 rounded-lg border border-border px-3 disabled:opacity-40">Weiter</button></nav>}
    </section>}
  </div>;
}
