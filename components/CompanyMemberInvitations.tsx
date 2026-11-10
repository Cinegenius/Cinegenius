"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/components/MediaImage";
import { COMPANY_PUBLIC_TITLE_SUGGESTIONS, normalizeCompanyPublicTitles } from "@/lib/company-roles";
import { useTranslations, useLocale } from "next-intl";
import { uiErrorMessage } from "@/lib/ui-error-message";


type Person = { user_id: string; display_name: string; avatar_url: string | null; slug: string | null; role: string | null; positions?: string[]; location: string | null };
type Invitation = { id: string; public_titles: string[]; status: string; created_at: string; expires_at: string; profile: Person | null; companies: { name: string; slug: string; logo_url: string | null } | null };
async function request<T>(translate: (key: string, values?: Record<string, string | number>) => string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? translate("Ui.text_4aa1f446bb4ea4"));
  return result;
}
export function CompanyMemberInvitations({ companyId, mode }: { companyId?: string; mode: "add" | "list" | "received" }) {
  const uiText = useTranslations();
  const uiLocale = useLocale();

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
    try { const result = await request<{ data: Invitation[]; total: number }>(uiText, `/api/company-invitations?page=${page}${companyId ? `&company_id=${encodeURIComponent(companyId)}` : ""}`); setInvitations(result.data); setTotal(result.total ?? result.data.length); }
    catch (cause) { setError(uiErrorMessage(cause, uiText("Ui.text_b77995ad4e9f3c"))); }
    finally { setLoading(false); }
  }, [companyId, page]);
  useEffect(() => { if (mode !== "add") void load(); }, [load, mode]);
  useEffect(() => {
    if (mode !== "add" || !companyId || q.trim().length < 2) { setPeople([]); setSearching(false); return; }
    const controller = new AbortController();
    setSearching(true); setError("");
    const timer = setTimeout(() => {
      void request<{ data: Person[] }>(uiText, `/api/company-member-search?company_id=${encodeURIComponent(companyId)}&q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((result) => setPeople(result.data))
        .catch((cause) => { if (!controller.signal.aborted) setError(uiErrorMessage(cause, uiText("Ui.text_7489b73002be55"))); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); setSearching(false); };
  }, [q, companyId, mode]);
  async function invite() {
    const publicTitles = normalizeCompanyPublicTitles([...titles, customTitle.trim()]);
    if (!person || !publicTitles.length || locked.current) return;
    locked.current = true; setBusy(person.user_id); setError(""); setNotice("");
    try {
      await request(uiText, "/api/company-invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company_id: companyId, recipient_user_id: person.user_id, public_titles: publicTitles }) });
      setNotice(uiText("Ui.text_81ca08b4ab30c3", { value1: String(person.display_name) }));
      setPerson(null); setPeople([]); setQ(""); setTitles([]); setCustomTitle("");
    } catch (cause) { setError(uiErrorMessage(cause, uiText("Ui.text_672d385dc04fdd"))); }
    finally { locked.current = false; setBusy(null); }
  }
  async function decide(id: string, decision: "accept" | "decline" | "revoke") {
    if (locked.current) return;
    locked.current = true; setBusy(id); setError(""); setNotice("");
    try {
      await request(uiText, "/api/company-invitations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      setNotice(decision === "accept" ? uiText("Ui.text_def51c277c8e29") : decision === "decline" ? uiText("OrganizationAccess.declined") : uiText("Ui.text_c6e2c905071350"));
      await load();
    } catch (cause) { setError(uiErrorMessage(cause, uiText("Ui.text_f52de6983c27a6"))); }
    finally { locked.current = false; setBusy(null); }
  }
  return <div className="space-y-4">
    {notice && <p role="status" className="rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-success">{notice}</p>}
    {error && <p role="alert" className="rounded-xl border border-crimson/20 bg-crimson/10 p-4 text-sm text-crimson-light">{error}</p>}
    {mode === "add" ? <section className="space-y-4 rounded-xl border border-border bg-bg-secondary p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-text-primary">{uiText("Ui.text_e477e6999224a7")}</h3>
      <p className="text-sm text-text-muted">{uiText("Ui.text_8c8a7e245c5277")}</p>
      <label className="block text-sm text-text-secondary">{uiText.rich("Ui.text_173f683d0d085a", { part1: () => (<input type="search" value={q} disabled={Boolean(busy)} onChange={(event) => { setQ(event.target.value); setPerson(null); }} placeholder={uiText("Ui.text_3f8a206572bfd5")} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-text-primary" />) })}</label>
      {searching ? <p role="status" className="text-sm text-text-muted">{uiText("Ui.text_c852e0f72228bf")}</p> : q.trim().length >= 2 && !person && <div className="max-h-80 space-y-2 overflow-y-auto">{people.length ? people.map((p) => <button type="button" key={p.user_id} onClick={() => setPerson(p)} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-gold">{p.avatar_url && <Image src={p.avatar_url} alt="" width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-full object-cover" />}<span className="min-w-0"><strong className="block break-words text-sm text-text-primary">{p.display_name}</strong><span className="block break-words text-xs text-text-muted">{[p.role || p.positions?.slice(0, 2).join(" · "), p.location].filter(Boolean).join(" · ")}</span></span></button>) : <p className="text-sm text-text-muted">{uiText("Ui.text_07811712154396")}</p>}</div>}
      {person && <div className="space-y-4 border-t border-border pt-4">
        <p className="text-sm text-text-primary">{uiText.rich("Ui.text_be5e5ecff5116c", { value2: () => (person.display_name), part1: chunks => (<Link href={`/profile/${person.slug || person.user_id}`} className="font-semibold text-gold">{chunks}</Link>), value3: () => (person.location ? uiText("Ui.text_f6b53f9c8ab3ef", { value1: String(person.location) }) : "") })}</p>
        <fieldset><legend className="mb-2 text-sm text-text-secondary">{uiText("Ui.text_49ce51164b271b")}</legend><div className="flex flex-wrap gap-2">{COMPANY_PUBLIC_TITLE_SUGGESTIONS.map((title) => <button type="button" key={title} disabled={Boolean(busy) || (!titles.includes(title) && titles.length >= 5)} aria-pressed={titles.includes(title)} onClick={() => setTitles((current) => current.includes(title) ? current.filter((t) => t !== title) : [...current, title])} className={`min-h-11 rounded-full border px-3 text-xs ${titles.includes(title) ? "border-gold bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{title}</button>)}</div></fieldset>
        <label className="block text-sm text-text-secondary">{uiText.rich("Ui.text_bc48d3e887b241", { part1: () => (<input value={customTitle} disabled={Boolean(busy)} maxLength={80} onChange={(event) => setCustomTitle(event.target.value)} placeholder={uiText("Ui.text_f0589b7fb57f1a")} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-text-primary" />) })}</label>
        <p className="text-xs text-text-muted">{uiText("Ui.text_f0f0788b1ba00e")}</p>
        <button type="button" disabled={Boolean(busy) || (!titles.length && !customTitle.trim()) || titles.length + (customTitle.trim() ? 1 : 0) > 5} onClick={() => void invite()} className="min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary disabled:opacity-50">{busy ? uiText("Ui.text_4ad154019b736c") : uiText("Ui.text_19a03bdda18e10")}</button>
      </div>}
    </section> : <section className="space-y-3">
      <h3 className="text-lg font-semibold text-text-primary">{mode === "received" ? uiText("Ui.text_a37ff2e95062cf") : uiText("OrganizationAccess.pendingInvites")}</h3>
      {loading ? <p role="status" className="text-sm text-text-muted">{uiText("Ui.text_5b7a90c83acc2c")}</p> : !invitations.length ? <p className="text-sm text-text-muted">{uiText("Ui.text_fa25f47dfd8f88")}</p> : invitations.map((invite) => {
        const pending = invite.status === "pending" && new Date(invite.expires_at).getTime() > Date.now();
        const label = pending ? uiText("OrganizationAccess.pending") : invite.status === "claimed" ? uiText("Ui.text_5fb36cf9e74bd2") : invite.status === "declined" ? uiText("OfferModeration.statuses.rejected") : invite.status === "revoked" ? uiText("Ui.text_d8f4549c58bbcf") : uiText("Ui.text_8e93f2e8507d3d");
        return <article key={invite.id} className="space-y-3 rounded-xl border border-border bg-bg-secondary p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><Link href={mode === "received" ? `/companies/${invite.companies?.slug}` : `/profile/${invite.profile?.slug || invite.profile?.user_id}`} className="break-words font-semibold text-text-primary hover:text-gold">{mode === "received" ? invite.companies?.name : invite.profile?.display_name || uiText("Ui.text_4d338cce824968")}</Link><span className="text-xs text-text-muted">{label}</span></div>
          <p className="break-words text-sm text-text-secondary">{invite.public_titles.join(" · ")}</p>
          <p className="text-xs text-text-muted">{uiText.rich("Ui.text_a98a77f55796b6", { value1: () => (new Date(invite.created_at).toLocaleDateString(uiLocale)), value2: () => (new Date(invite.expires_at).toLocaleDateString(uiLocale)) })}</p>
          {pending && <div className="flex flex-wrap justify-end gap-2">{mode === "received" ? <><button disabled={Boolean(busy)} onClick={() => void decide(invite.id, "decline")} className="min-h-11 rounded-lg border border-border px-3 text-sm text-text-secondary">{uiText("OfferModeration.reject")}</button><button disabled={Boolean(busy)} onClick={() => void decide(invite.id, "accept")} className="min-h-11 rounded-lg bg-gold px-4 text-sm font-semibold text-bg-primary">{busy === invite.id ? uiText("AdminReview.saving") : uiText("Ui.text_38b5d0fd4dafaa")}</button></> : <button disabled={Boolean(busy)} onClick={() => void decide(invite.id, "revoke")} className="min-h-11 rounded-lg border border-border px-3 text-sm text-text-secondary">{busy === invite.id ? uiText("AdminReview.saving") : uiText("Ui.text_986e7d5106f710")}</button>}</div>}
        </article>;
      })}
      {total > 20 && <nav aria-label={uiText("Ui.text_1f408643e87f58")} className="flex items-center justify-between gap-2 text-sm text-text-muted"><button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className="min-h-11 rounded-lg border border-border px-3 disabled:opacity-40">{uiText("setup.copy99")}</button><span>{uiText.rich("Ui.text_4ecc1184e0c1e3", { value1: () => (page), value2: () => (total) })}</span><button disabled={page * 20 >= total || loading} onClick={() => setPage(p => p + 1)} className="min-h-11 rounded-lg border border-border px-3 disabled:opacity-40">{uiText("setup.copy102")}</button></nav>}
    </section>}
  </div>;
}
