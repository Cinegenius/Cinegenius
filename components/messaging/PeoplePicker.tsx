"use client";
import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";
import {Check, Loader2, Search, User, X} from "lucide-react";
import UnoptimizedImage from "@/components/UnoptimizedImage";
import {messagingPeople, type MessagePerson} from "@/lib/messaging-ui";

export default function PeoplePicker({contacts, selected, onChange, exclude = [], disabled = false, maxSelection = 49}: {contacts: MessagePerson[]; selected: MessagePerson[]; onChange: (people: MessagePerson[]) => void; exclude?: string[]; disabled?: boolean; maxSelection?: number}) {
  const t = useTranslations("Messaging");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{query: string; people: MessagePerson[]}>({query:"", people:[]});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true); setError(false);
      void fetch(`/api/conversations/users?q=${encodeURIComponent(search)}`, {signal: controller.signal, cache:"no-store"}).then(async response => {
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.users)) throw new Error();
        if (!controller.signal.aborted) setResults({query:search, people:payload.users});
      }).catch(() => {if (!controller.signal.aborted) setError(true);}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    }, 250);
    return () => {controller.abort(); window.clearTimeout(timer);};
  }, [query, attempt]);
  const search = query.trim();
  const remotePeople = search.length >= 2 && results.query === search ? results.people : [];
  const people = messagingPeople(contacts, remotePeople, search, exclude);
  function toggle(person: MessagePerson) {onChange(selected.some(value => value.id === person.id) ? selected.filter(value => value.id !== person.id) : [...selected, {id:person.id, name:person.name}].slice(0,maxSelection));}
  return <div className="min-w-0 space-y-3">
    <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3"><Search size={18} className="shrink-0 text-text-muted"/><input type="search" disabled={disabled} value={query} maxLength={80} onChange={event => setQuery(event.target.value)} placeholder={t("searchPeople")} aria-label={t("searchPeople")} className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none"/></label>
    {selected.length > 0 && <div className="flex flex-wrap gap-2">{selected.map(person => <button key={person.id} type="button" disabled={disabled} onClick={() => toggle(person)} aria-label={t("removeSelection", {name:person.name})} className="flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 text-sm text-gold"><span className="break-words [overflow-wrap:anywhere]">{person.name}</span><X size={16} className="shrink-0"/></button>)}</div>}
    {search.length < 2 && <p className="text-xs text-text-muted">{t(contacts.length ? "yourContacts" : "searchHint")}</p>}
    {search.length >= 2 && loading && <p role="status" className="flex items-center gap-2 text-sm text-text-muted"><Loader2 size={16} className="animate-spin"/>{t("searching")}</p>}
    {search.length >= 2 && error && <div role="alert" className="text-sm text-red-400 [[data-theme=light]_&]:text-red-700"><p>{t("searchError")}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-11 text-gold">{t("retry")}</button></div>}
    <div className="divide-y divide-border">{people.map(person => <button key={person.id} type="button" disabled={disabled || selected.length >= maxSelection && !selected.some(value => value.id === person.id)} aria-pressed={selected.some(value => value.id === person.id)} onClick={() => toggle(person)} className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-bg-elevated disabled:opacity-40"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated">{person.avatar ? <UnoptimizedImage src={person.avatar} alt="" className="h-full w-full object-cover"/> : <User size={18} className="text-text-muted"/>}</span><span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium [overflow-wrap:anywhere]">{person.name}</span>{person.role && <span className="block truncate text-xs text-text-muted">{person.role}</span>}</span><span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full border " + (selected.some(value => value.id === person.id) ? "border-gold bg-gold text-bg-primary" : "border-border")}>{selected.some(value => value.id === person.id) && <Check size={15}/>}</span></button>)}</div>
    {search.length >= 2 && !loading && !error && results.query === search && people.length === 0 && <p className="text-sm text-text-muted">{t("noPeople")}</p>}
  </div>;
}
