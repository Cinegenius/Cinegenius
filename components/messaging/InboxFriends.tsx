"use client";

import type { OccupationForm } from "@/lib/occupation-form";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { Search, Star, Users } from "lucide-react";
import ContactCard from "@/components/ContactCard";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import { navigateMessageView } from "@/lib/message-navigation";
import { uiErrorMessage } from "@/lib/ui-error-message";

type Contact = { friendship_id: string; user_id: string; display_name: string; avatar_url: string | null; role: string; occupationForm?: OccupationForm; is_favorite?: boolean; profile_visible?: boolean };
const FRIENDSHIPS_CONTRACT = "cinegenius.friendships.v1";

/** Only accepted connections belong here; incoming requests live in Mitteilungen. */
export default function InboxFriends() {
  const t = useTranslations("Contacts");
  const messaging = useTranslations("Messaging");
  const locale = useLocale();
  const { userId, sessionId } = useAuth();
  const { leave } = useFormNavigation();
  const scope = JSON.stringify([userId, sessionId]);
  const currentScope = useRef(scope);
  const generation = useRef(0);
  const operations = useRef(new Set<string>());
  const region = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<{ scope: string; contacts: Contact[]; favoritesRead?: boolean; favoritesWrite?: boolean }>({ scope: "", contacts: [] });
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ scope: string; kind: "load" | "remove" | "favorite"; text?: string; locale?: string } | null>(null);
  const [pending, setPending] = useState(new Set<string>());
  const [searchState, setSearch] = useState({ scope, value: "" });
  const [filter, setFilter] = useState({ scope, homies: false });
  const search = searchState.scope === scope ? searchState.value : "";
  const onlyHomies = filter.scope === scope && filter.homies;
  const contacts = snapshot.scope === scope ? snapshot.contacts : [];
  const ready = snapshot.scope === scope;
  const error = failure?.scope === scope ? failure.kind === "load" ? t("loadError") : failure.locale === locale ? failure.text || t("error") : t("error") : "";

  useLayoutEffect(() => {
    currentScope.current = scope;
    return () => { currentScope.current = ""; generation.current += 1; };
  }, [scope]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setPending(new Set(operations.current)); });
    return () => { active = false; };
  }, [scope]);

  const load = useCallback(async () => {
    if (!userId) return;
    const version = ++generation.current;
    const isCurrent = () => currentScope.current === scope && version === generation.current;
    setLoading(true);
    try {
      const response = await fetch("/api/friendships", { cache: "no-store", headers: { "X-CineGenius-Native-Contract": FRIENDSHIPS_CONTRACT, "X-Contact-Account": userId }, signal: AbortSignal.timeout(15_000) });
      const data = await response.json();
      if (!isCurrent()) return;
      if (!response.ok || data.contract !== FRIENDSHIPS_CONTRACT || data.accountId !== userId || !Array.isArray(data.friends)) throw new Error();
      const favoritesRead = data.capabilities?.favoriteFriendsRead === true;
      if (favoritesRead && data.friends.some((contact: Contact) => typeof contact.is_favorite !== "boolean")) throw new Error();
      setSnapshot({ scope, contacts: data.friends, favoritesRead, favoritesWrite: favoritesRead && data.capabilities?.favoriteFriendsWrite === true });
      setFailure(null);
    } catch {
      if (isCurrent()) setFailure({ scope, kind: "load" });
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [userId, scope]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [load]);

  async function remove(id: string) {
    const key = `${scope}:${id}`;
    if (!userId || operations.current.has(key)) return false;
    operations.current.add(key);
    setPending(previous => new Set(previous).add(key));
    try {
      const response = await fetch(`/api/friendships/${encodeURIComponent(id)}`, {
        method: "DELETE", cache: "no-store", headers: { "X-Contact-Account": userId }, signal: AbortSignal.timeout(20_000),
      });
      const data = await response.json();
      if (currentScope.current !== scope) return false;
      if (!response.ok || data.success !== true) throw new Error(data.error || t("error"));
      // A concurrent, older GET must not restore the just-removed connection.
      generation.current += 1;
      setLoading(false);
      setSnapshot(previous => previous.scope === scope ? { ...previous, contacts: previous.contacts.filter(contact => contact.friendship_id !== id) } : previous);
      setFailure(null);
      region.current?.focus({ preventScroll: true });
      return true;
    } catch (cause) {
      if (currentScope.current === scope) setFailure({ scope, kind: "remove", text: uiErrorMessage(cause, t("error")), locale });
      return false;
    } finally {
      operations.current.delete(key);
      if (currentScope.current === scope) setPending(previous => { const next = new Set(previous); next.delete(key); return next; });
    }
  }

  async function favorite(contact: Contact) {
    const id = contact.friendship_id, key = `${scope}:${id}`;
    if (!userId || !ready || !snapshot.favoritesWrite || typeof contact.is_favorite !== "boolean" || operations.current.has(key)) return;
    const desired = !contact.is_favorite;
    operations.current.add(key);
    setPending(previous => new Set(previous).add(key));
    try {
      const response = await fetch(`/api/native/v1/friendships/${encodeURIComponent(id)}/favorite`, {
        method: "PUT", cache: "no-store", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ contract: FRIENDSHIPS_CONTRACT, accountId: userId, is_favorite: desired }),
      });
      const data = await response.json();
      if (currentScope.current !== scope) return;
      if (!response.ok || data.contract !== FRIENDSHIPS_CONTRACT || data.accountId !== userId || data.success !== true || data.friendship_id !== id || data.is_favorite !== desired) throw new Error();
      generation.current += 1;
      setLoading(false);
      setSnapshot(previous => previous.scope === scope ? { ...previous, contacts: previous.contacts.map(row => row.friendship_id === id ? { ...row, is_favorite: desired } : row) } : previous);
      setFailure(null);
    } catch {
      if (currentScope.current === scope) {
        // The server may have committed before a response was lost. Read back;
        // never optimistically flip the star or retry with an inverse value.
        await load();
        if (currentScope.current === scope) setFailure(previous => previous?.kind === "load" ? previous : { scope, kind: "favorite" });
      }
    } finally {
      operations.current.delete(key);
      if (currentScope.current === scope) setPending(previous => { const next = new Set(previous); next.delete(key); return next; });
    }
  }

  const query = search.trim().toLocaleLowerCase(locale);
  const visible = contacts.filter(contact => (!onlyHomies || contact.is_favorite === true) && `${contact.display_name} ${contact.role ?? ""}`.toLocaleLowerCase(locale).includes(query))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, locale));

  return <div ref={region} tabIndex={-1} role="region" aria-label={t("title")} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
    <div className="mx-auto max-w-3xl space-y-3 p-4 sm:p-6">
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3">
        <Search size={17} aria-hidden="true" className="shrink-0 text-text-muted" />
        <input type="search" value={search} onChange={event => setSearch({ scope, value: event.target.value })} placeholder={t("search")} aria-label={t("search")} className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none" />
      </label>
      {error && <div role="alert" className="text-sm text-red-400"><p>{error}</p>{failure?.kind === "load" && <button type="button" onClick={() => void load()} className="min-h-11 text-gold">{t("retry")}</button>}</div>}
      {ready && snapshot.favoritesRead && <div className="space-y-2"><div className="flex gap-2">
        <button type="button" aria-pressed={!onlyHomies} onClick={() => setFilter({ scope, homies: false })} className={`min-h-11 flex-1 rounded-xl border px-3 text-sm ${!onlyHomies ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-text-secondary"}`}>{t("title")}</button>
        <button type="button" aria-pressed={onlyHomies} onClick={() => setFilter({ scope, homies: true })} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm ${onlyHomies ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-text-secondary"}`}><Star size={16} aria-hidden="true" />{t("homies")}</button>
      </div>{onlyHomies && <p className="text-xs text-text-muted">{t("homiesHint")}</p>}</div>}
      {loading && !ready ? <p role="status" className="py-8 text-sm text-text-muted">{t("loading")}</p> : ready && !visible.length ? <div className="space-y-3 py-8 text-center text-sm text-text-muted"><Users size={26} className="mx-auto" /><p>{query ? messaging("noPeople") : onlyHomies ? t("homiesHint") : t("empty")}</p></div> : visible.map(contact => <ContactCard
        key={`${scope}:${contact.friendship_id}`} contact={contact} pending={pending.has(`${scope}:${contact.friendship_id}`)} error={error} onRemove={remove}
        favorite={snapshot.favoritesRead ? contact.is_favorite : undefined} favoriteDisabled={!snapshot.favoritesWrite} onFavorite={() => void favorite(contact)}
        messageHref={`/messages?to=${encodeURIComponent(contact.user_id)}`}
        onMessage={() => { if (userId) leave(() => navigateMessageView(window, userId, { recipientId: contact.user_id })); }}
      />)}
    </div>
  </div>;
}
