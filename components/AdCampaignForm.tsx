"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

type Campaign = {
  id: string;
  headline: string;
  active: boolean;
  ends_at: string;
};

export default function AdCampaignForm() {
  const t = useTranslations("advertising");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ads?mine=true", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          if (!cancelled) setSignedOut(true);
          return { ads: [] };
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (!cancelled) setUnavailable(true);
          return { ads: [] };
        }
        return result as { ads?: Campaign[] };
      })
      .then((result) => { if (!cancelled) setCampaigns(result.ads ?? []); })
      .catch(() => { if (!cancelled) setUnavailable(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function refreshCampaigns() {
    const response = await fetch("/api/ads?mine=true", { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json() as { ads?: Campaign[] };
    setCampaigns(result.ads ?? []);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setNotice("");
    const form = new FormData(formElement);
    if (!file) {
      setError(t("imageRequired"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t("imageTooLarge"));
      return;
    }

    setSubmitting(true);
    try {
      const uploadForm = new FormData();
      uploadForm.set("file", file);
      const uploadResponse = await fetch("/api/upload", { method: "POST", body: uploadForm });
      const uploadResult = await uploadResponse.json().catch(() => ({})) as { url?: string; error?: string };
      if (uploadResponse.status === 401) {
        setSignedOut(true);
        throw new Error(t("loginRequired"));
      }
      if (!uploadResponse.ok || !uploadResult.url) throw new Error(uploadResult.error ?? t("publishError"));

      const response = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertiser_name: form.get("advertiser_name"),
          headline: form.get("headline"),
          description: form.get("description"),
          cta_label: form.get("cta_label"),
          destination_url: form.get("destination_url"),
          image_url: uploadResult.url,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (response.status === 401) {
        setSignedOut(true);
        throw new Error(t("loginRequired"));
      }
      if (!response.ok) throw new Error(result.error ?? t("publishError"));

      formElement.reset();
      setFile(null);
      setNotice(t("publishSuccess"));
      await refreshCampaigns();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("publishError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCampaign(id: string) {
    setRemovingId(id);
    setError("");
    try {
      const response = await fetch(`/api/ads?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? t("removeError"));
      setCampaigns((items) => items.filter((item) => item.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("removeError"));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section id="anzeigenformular" className="scroll-mt-24 rounded-2xl border border-border bg-bg-secondary p-5 sm:p-7">
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">{t("selfServeEyebrow")}</p>
        <h2 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">{t("formTitle")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">{t("formIntro")}</p>
        <p className="mt-3 inline-flex rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1.5 text-xs font-semibold text-lime-200">{t("freeRunNote")}</p>
      </div>

      {signedOut ? (
        <div className="rounded-xl border border-border bg-bg-primary p-5">
          <p className="text-sm text-text-secondary">{t("loginRequired")}</p>
          <Link href="/sign-in?redirect_url=%2Fwerben%23anzeigenformular" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-bg-primary">
            {t("signInToAdvertise")} <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)]">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-text-primary">
              {t("advertiserField")}
              <input name="advertiser_name" required maxLength={80} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-gold/60" />
            </label>
            <label className="block text-sm font-medium text-text-primary">
              {t("headlineField")}
              <input name="headline" required maxLength={90} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-gold/60" />
            </label>
            <label className="block text-sm font-medium text-text-primary">
              {t("descriptionField")}
              <textarea name="description" required maxLength={180} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-gold/60" />
              <span className="mt-1 block text-xs text-text-muted">{t("descriptionLimit")}</span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-text-primary">
                {t("destinationField")}
                <input name="destination_url" type="url" required placeholder="https://…" className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-gold/60" />
              </label>
              <label className="block text-sm font-medium text-text-primary">
                {t("ctaField")}
                <input name="cta_label" required maxLength={28} defaultValue={t("ctaDefault")} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-bg-primary px-3 text-sm text-text-primary outline-none focus:border-gold/60" />
              </label>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-bg-primary p-4 text-sm text-text-secondary hover:border-gold/50">
              <ImagePlus size={22} className="shrink-0 text-gold" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-text-primary">{t("bannerImageField")}</span>
                <span className="block text-xs text-text-muted">{t("bannerImageHint")}</span>
                {file && <span className="mt-1 block truncate text-xs text-lime-200">{file.name}</span>}
              </span>
              <Upload size={17} className="shrink-0 text-text-muted" />
              <input type="file" accept="image/jpeg,image/png,image/webp" required className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
            <label className="flex items-start gap-3 text-xs leading-relaxed text-text-muted">
              <input type="checkbox" required className="mt-0.5 accent-lime-300" />
              <span>{t("adTermsConfirm")} <Link href="/agb" target="_blank" className="text-gold underline underline-offset-2">{t("termsLink")}</Link></span>
            </label>
            {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            {notice && <p role="status" className="rounded-lg border border-lime-300/30 bg-lime-300/10 px-3 py-2 text-sm text-lime-100">{notice}</p>}
            {unavailable && !signedOut && <p className="text-xs text-amber-200">{t("setupPending")}</p>}
            <button type="submit" disabled={submitting || loading || unavailable} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 font-bold text-bg-primary transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
              {submitting ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowRight size={17} />}
              {submitting ? t("publishing") : t("publishButton")}
            </button>
          </div>

          <aside className="self-start overflow-hidden rounded-xl border border-border bg-bg-primary">
            <p className="border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted">{t("previewLabel")}</p>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={t("previewImageAlt")} className="aspect-[16/7] w-full object-cover" />
            ) : (
              <div className="flex aspect-[16/7] items-center justify-center bg-gradient-to-br from-cyan-300/10 via-fuchsia-400/10 to-lime-300/10 text-text-muted">
                <ImagePlus size={26} />
              </div>
            )}
            <div className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-200">{t("adLabel")} · {t("homepagePlacement")}</p>
              <p className="mt-1 font-display text-lg font-bold text-text-primary">{t("previewHeadline")}</p>
              <p className="mt-1 line-clamp-2 text-sm text-text-muted">{t("previewDescription")}</p>
            </div>
          </aside>
        </form>
      )}

      {!loading && !signedOut && campaigns.length > 0 && (
        <div className="mt-9 border-t border-border pt-6">
          <h3 className="mb-3 text-lg font-bold text-text-primary">{t("yourAdsTitle")}</h3>
          <ul className="space-y-2">
            {campaigns.map((campaign) => (
              <li key={campaign.id} className="flex flex-col gap-3 rounded-xl border border-border bg-bg-primary p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-text-primary">{campaign.headline}</p>
                  <p className="mt-1 text-xs text-text-muted">{t("homepagePlacement")} · {campaign.active ? t("adLiveUntil", { date: new Date(campaign.ends_at).toLocaleDateString() }) : t("adPaused")}</p>
                </div>
                <button type="button" onClick={() => removeCampaign(campaign.id)} disabled={removingId === campaign.id} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-red-300/20 px-3 text-sm font-semibold text-red-200 transition hover:bg-red-300/10 disabled:opacity-50 sm:self-center">
                  {removingId === campaign.id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  {t("removeAd")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
