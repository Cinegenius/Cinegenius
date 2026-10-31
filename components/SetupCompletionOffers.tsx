"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { listingDetailPath } from "@/lib/listing-routes";
import { setupOfferState, submitSetupOffer, type SetupOfferState } from "@/lib/setup-offer-submission";

type Offer = { id: string; kind: "location" | "equipment"; title: string };
type CurrentOffer = { id: string; type: string; published: boolean; moderation_status?: string };
export default function SetupCompletionOffers({ offers }: { offers: Offer[] }) {
  const t = useTranslations("SetupOffers");
  const [current, setCurrent] = useState<Record<string, { state: SetupOfferState; type?: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(new Set<string>());
  const offerIds = offers.map(offer => offer.id).join(",");
  useEffect(() => {
    const controller = new AbortController();
    const ids = offerIds.split(",").filter(Boolean);
    fetch("/api/listings?mine=true", { cache: "no-store", signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.data)) throw new Error();
      if (controller.signal.aborted) return;
      const rows = result.data as CurrentOffer[];
      setCurrent(Object.fromEntries(ids.map(id => {
        const row = rows.find(value => value.id === id);
        return [id, { state: setupOfferState(row), type: row?.type }];
      })));
    }).catch(() => {
      if (!controller.signal.aborted) setCurrent(Object.fromEntries(ids.map(id => [id, { state: "unavailable" }])));
    });
    return () => controller.abort();
  }, [offerIds, retry]);

  async function submit(offer: Offer) {
    if (inFlight.current.has(offer.id) || current[offer.id]?.state !== "draft") return;
    inFlight.current.add(offer.id);
    setBusy(value => ({ ...value, [offer.id]: true }));
    setErrors(value => ({ ...value, [offer.id]: "" }));
    try {
      const state = await submitSetupOffer(offer.id, t("saveError"));
      setCurrent(value => ({ ...value, [offer.id]: { ...value[offer.id], state } }));
    } catch (error) {
      setErrors(value => ({ ...value, [offer.id]: error instanceof Error ? error.message : t("saveError") }));
    } finally {
      inFlight.current.delete(offer.id);
      setBusy(value => ({ ...value, [offer.id]: false }));
    }
  }
  return <section aria-label={t("nextStep")} className="space-y-3">
    <p className="text-sm leading-6 text-text-secondary">{t("nextStep")}</p>
    {offers.map(offer => {
      const saved = current[offer.id];
      const state = saved?.state ?? "loading";
      const publicHref = state === "published" && saved?.type ? listingDetailPath(saved.type, offer.id) : null;
      const editHref = `/dashboard?tab=listings&editListing=${encodeURIComponent(offer.id)}`;
      return <div key={offer.id} className="min-w-0 space-y-3 rounded-xl border border-border bg-bg-primary p-4">
        <h2 className="break-words text-base font-semibold text-text-primary [overflow-wrap:anywhere]">{offer.title || t(offer.kind)}</h2>
        <p role="status" className={`text-sm leading-6 ${state === "published" ? "text-success" : state === "pending" ? "text-gold" : "text-text-muted"}`}>{t(`states.${state}`)}</p>
        {errors[offer.id] && <p role="alert" className="break-words text-sm text-red-300">{errors[offer.id]}</p>}
        {state === "draft" && <><p className="text-xs leading-5 text-text-muted">{t(offer.kind === "location" ? "locationRule" : "marketplaceRule")}</p><button type="button" disabled={busy[offer.id]} onClick={() => void submit(offer)} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-bg-primary disabled:opacity-50">{t(busy[offer.id] ? "submitting" : offer.kind === "location" ? "submitLocation" : "submitMarketplace")}</button></>}
        {state === "unavailable" && <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 text-sm font-semibold text-gold">{t("reload")}</button>}
        {publicHref && <Link href={publicHref} className="flex min-h-12 items-center justify-center rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-bg-primary">{t("openPublic")}</Link>}
        {state !== "loading" && <Link href={editHref} className="flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2 text-sm text-text-secondary">{t("edit")}</Link>}
      </div>;
    })}
  </section>;
}
