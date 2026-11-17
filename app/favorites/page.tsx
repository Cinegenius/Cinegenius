"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Heart, ArrowLeft, MapPin, Car, Package, Briefcase, Users, Trash2, PawPrint, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import ListingImage from "@/components/ListingImage";
import BrowseSelect from "@/components/BrowseSelect";
import { listingDetailPath } from "@/lib/listing-routes";

type Favorite = {
  id: string; listing_id: string; listing_type: string; listing_title: string | null;
  listing_city: string | null; listing_price: number | null; listing_image: string | null;
  priceLabel?: string; href?: string; created_at: string;
};
const TYPE_ICONS = { location: MapPin, vehicle: Car, prop: Package, job: Briefcase, creator: Users, animal: PawPrint };

export default function FavoritesPage() {
  const ui = useTranslations();
  const t = useTranslations("Favorites");
  const locale = useLocale();
  const { userId, sessionId, isLoaded } = useAuth();
  const scope = JSON.stringify([userId, sessionId]);
  const currentScope = useRef(scope), generation = useRef(0), operations = useRef(new Set<string>());
  const [snapshot, setSnapshot] = useState<{ scope: string; favorites: Favorite[] }>({ scope: "", favorites: [] });
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ scope: string; kind: "load" | "remove" } | null>(null);
  const [pending, setPending] = useState(new Set<string>());
  const [filter, setFilter] = useState({ scope: "", value: "all" });
  const favorites = snapshot.scope === scope ? snapshot.favorites : [];
  const ready = snapshot.scope === scope;
  const activeFilter = filter.scope === scope ? filter.value : "all";
  const error = failure?.scope === scope ? t(failure.kind === "load" ? "loadError" : "removeError") : "";

  useLayoutEffect(() => {
    currentScope.current = scope;
    return () => { currentScope.current = ""; generation.current += 1; };
  }, [scope]);

  const load = useCallback(async () => {
    if (!userId) return;
    const version = ++generation.current;
    const isCurrent = () => currentScope.current === scope && version === generation.current;
    setLoading(true);
    try {
      const response = await fetch("/api/favorites", { cache: "no-store", headers: { "X-Favorites-Account": userId, "Accept-Language": locale }, signal: AbortSignal.timeout(15_000) });
      const data = await response.json();
      if (!isCurrent()) return;
      if (!response.ok || !Array.isArray(data.favorites) || data.favorites.some((value: Partial<Favorite> | null) => !value || typeof value.id !== "string" || typeof value.listing_id !== "string" || typeof value.listing_type !== "string")) throw new Error();
      setSnapshot({ scope, favorites: data.favorites });
      setFailure(null);
    } catch {
      if (isCurrent()) setFailure({ scope, kind: "load" });
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [userId, scope, locale]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active && isLoaded) void load(); });
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [load, isLoaded]);

  async function remove(favorite: Favorite) {
    const operation = `${scope}:${favorite.listing_id}`;
    if (!userId || operations.current.has(operation)) return;
    operations.current.add(operation);
    setPending(previous => new Set(previous).add(operation));
    try {
      const response = await fetch("/api/favorites", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "X-Favorites-Account": userId }, signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ listing_id: favorite.listing_id, action: "remove" }),
      });
      const data = await response.json();
      if (currentScope.current !== scope) return;
      if (!response.ok || data.isFavorited !== false || data.listingId !== favorite.listing_id) throw new Error();
      // An earlier list refresh cannot restore a confirmed removal.
      generation.current += 1;
      setLoading(false);
      setSnapshot(previous => previous.scope === scope ? { ...previous, favorites: previous.favorites.filter(value => value.listing_id !== favorite.listing_id) } : previous);
      setFailure(null);
    } catch {
      if (currentScope.current === scope) setFailure({ scope, kind: "remove" });
    } finally {
      operations.current.delete(operation);
      if (currentScope.current === scope) setPending(previous => { const next = new Set(previous); next.delete(operation); return next; });
    }
  }

  const label = (type: string) => ui(Object.hasOwn(TYPE_ICONS, type) ? `AdminAccounts.contentKinds.${type}` : "AdminAccounts.contentKinds.other");
  const types = [...new Set(favorites.map(favorite => favorite.listing_type))];
  const selectedType = activeFilter === "all" || types.includes(activeFilter) ? activeFilter : "all";
  const visible = favorites.filter(favorite => selectedType === "all" || favorite.listing_type === selectedType);
  const options = [{ value: "all", label: ui("common.all") }, ...types.map(type => ({ value: type, label: label(type) }))];

  return <div className="min-h-screen pt-16">
    <div className="mx-auto max-w-4xl px-4 py-6 pb-[calc(var(--mobile-nav-clearance)+2rem)] sm:px-6 sm:py-8">
      <header className="mb-6 flex min-w-0 items-center gap-3">
        <Link href="/dashboard" aria-label={ui("nav.personalArea")} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-bg-elevated"><ArrowLeft size={19} /></Link>
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-semibold text-text-primary"><Heart size={22} aria-hidden="true" className="shrink-0 text-text-muted" /><span className="break-words">{ui("nav.savedItems")}</span></h1>
        {ready && favorites.length > 0 && <span className="ml-auto shrink-0 rounded-full border border-border bg-bg-secondary px-3 py-1 text-sm text-text-muted">{favorites.length}</span>}
      </header>
      {!isLoaded || !!userId && loading && !ready ? <div role="status" className="space-y-3"><p className="text-sm text-text-muted">{ui("common.loading")}</p>{[1, 2, 3].map(index => <div key={index} aria-hidden="true" className="h-24 animate-pulse rounded-xl border border-border bg-bg-secondary" />)}</div> : !userId ? <div className="space-y-4 rounded-2xl border border-border bg-bg-secondary p-6 text-center"><p className="text-sm text-text-secondary">{t("signInHint")}</p><Link href="/sign-in?redirect_url=%2Ffavorites" className="inline-flex min-h-11 items-center rounded-xl bg-gold px-4 font-semibold text-bg-primary">{ui("nav.signIn")}</Link></div> : <>
        {error && <div role="alert" className="mb-4 rounded-xl border border-border bg-bg-secondary p-4 text-sm text-text-secondary"><p>{error}</p>{failure?.kind === "load" && <button type="button" disabled={loading} onClick={() => void load()} className="mt-2 min-h-11 font-medium text-gold disabled:opacity-40">{ui("Contacts.retry")}</button>}</div>}
        {ready && favorites.length > 0 && <div className="mb-4 sm:max-w-xs"><BrowseSelect label={t("filterType")} value={selectedType} options={options} onChange={value => setFilter({ scope, value })} /></div>}
        {loading && ready && <p role="status" className="mb-3 flex items-center gap-2 text-sm text-text-muted"><Loader2 size={16} aria-hidden="true" className="animate-spin" />{ui("common.loading")}</p>}
        {ready && !favorites.length && <div className="space-y-4 rounded-2xl border border-border bg-bg-secondary px-5 py-10 text-center"><Heart size={30} aria-hidden="true" className="mx-auto text-text-muted" /><h2 className="font-semibold">{ui("Ui.text_bf33b5684b2765")}</h2><p className="mx-auto max-w-sm text-sm text-text-muted">{ui("Ui.text_a07c293eb84aad")}</p><div className="flex flex-wrap justify-center gap-2">{[{ href: "/creators", key: "crew" }, { href: "/locations", key: "locations" }, { href: "/props", key: "marketplace" }].map(item => <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-text-secondary hover:bg-bg-elevated">{ui(`nav.${item.key}`)}</Link>)}</div></div>}
        {ready && favorites.length > 0 && !visible.length && <p className="rounded-xl border border-border bg-bg-secondary p-5 text-sm text-text-muted">{t("noMatches")}</p>}
        <ul className="space-y-3">{visible.map(favorite => {
          const Icon = TYPE_ICONS[favorite.listing_type as keyof typeof TYPE_ICONS] ?? Package;
          const href = favorite.href ?? (favorite.listing_type === "creator" ? `/profile/${encodeURIComponent(favorite.listing_id)}` : listingDetailPath(favorite.listing_type, favorite.listing_id));
          const title = favorite.listing_title || label(favorite.listing_type);
          const busy = pending.has(`${scope}:${favorite.listing_id}`);
          const details = <><h2 className="break-words text-sm font-semibold text-text-primary [overflow-wrap:anywhere]">{title}</h2><p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted"><span>{label(favorite.listing_type)}</span>{favorite.listing_city && <span>{favorite.listing_city}</span>}</p>{favorite.priceLabel && <p className="mt-1 break-words text-sm font-medium text-text-secondary">{favorite.priceLabel}</p>}</>;
          return <li key={`${scope}:${favorite.id}`} className={`grid grid-cols-[3.5rem_minmax(0,1fr)_2.75rem] items-center gap-3 rounded-xl border border-border bg-bg-secondary p-3 sm:p-4 ${busy ? "opacity-60" : ""}`}>
            <span aria-hidden="true" className="flex size-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg-elevated">{favorite.listing_image ? <ListingImage width={56} height={56} mediaSize="thumbnail" src={favorite.listing_image} alt="" className={`size-14 ${favorite.listing_type === "creator" ? "object-cover" : "object-contain"}`} /> : <Icon size={23} className="text-text-muted" />}</span>
            {href ? <Link href={href} className="flex min-h-11 min-w-0 flex-col justify-center rounded-lg hover:opacity-80">{details}</Link> : <div className="min-w-0">{details}</div>}
            <button type="button" onClick={() => void remove(favorite)} disabled={busy} aria-label={t("removeItem", { name: title })} title={ui("Ui.text_53968e5832d074")} className="flex size-11 items-center justify-center rounded-xl text-text-muted hover:bg-bg-elevated hover:text-text-primary disabled:opacity-40">{busy ? <Loader2 size={18} aria-hidden="true" className="animate-spin" /> : <Trash2 size={18} aria-hidden="true" />}</button>
          </li>;
        })}</ul>
      </>}
    </div>
  </div>;
}
