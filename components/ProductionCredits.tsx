"use client";

import { useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { compressImage, MAX_FUNCTION_UPLOAD_BYTES } from "@/lib/compressImage";
import {
  createProductionCreditDraft,
  PRODUCTION_FORMATS,
  type ProductionCredit,
  type ProductionCreditDraft,
} from "@/lib/production-credits";
import { useTranslations } from "next-intl";
import { uiErrorMessage } from "@/lib/ui-error-message";


export function ProductionCreditsEditor({
  value,
  onChange,
  heading,
  description,
}: {
  value: ProductionCreditDraft[];
  onChange: Dispatch<SetStateAction<ProductionCreditDraft[]>>;
  heading: string;
  description: string;
}) {
  const uiText = useTranslations();

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");

  const update = (id: string, patch: Partial<ProductionCreditDraft>) => {
    onChange(value.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  };

  const uploadImages = async (id: string, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 4);
    event.target.value = "";
    if (!files.length) return;
    setUploadingId(id);
    setUploadError("");
    try {
      for (const file of files) {
        const compressed = await compressImage(file, { maxWidth: 1600, quality: 0.82, maxBytes: MAX_FUNCTION_UPLOAD_BYTES , translate: uiText });
        const body = new FormData();
        body.append("file", compressed);
        const response = await fetch("/api/upload", { method: "POST", body });
        const result = await response.json();
        if (!response.ok || !result.url) throw new Error(result.error ?? uiText("Ui.text_f99d1ad9a067d3"));
        onChange((current) => current.map((entry) => entry.id === id && entry.image_urls.length < 4
          ? { ...entry, image_urls: [...entry.image_urls, result.url] }
          : entry));
      }
    } catch (error) {
      setUploadError(uiErrorMessage(error, uiText("Ui.text_f99d1ad9a067d3")));
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-text-primary">{heading}</h2>
        <p className="text-xs leading-relaxed text-text-muted mt-1">{uiText.rich("Ui.text_7d3bb6b0be2aee", { value1: () => (description) })}</p>
      </div>

      {value.map((credit, index) => (
        <div key={credit.id} className="rounded-xl border border-border bg-bg-elevated p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-text-secondary">{uiText.rich("Ui.text_540c2bab1a5134", { value1: () => (index + 1) })}</p>
            <button type="button" onClick={() => onChange(value.filter((entry) => entry.id !== credit.id))}
              aria-label={uiText("Ui.text_59b147dbe72cf4", { value1: String(index + 1) })}
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-red-400 transition-colors">{uiText.rich("Ui.text_958330d18739f1", { part1: () => (<Trash2 size={13} />) })}</button>
          </div>

          <label className="block">{uiText.rich("Ui.text_f7eed1c0674698", { part1: chunks => (<span className="block text-[10px] uppercase tracking-widest font-semibold text-text-muted mb-1.5">{chunks}</span>), part2: () => (<input value={credit.title} maxLength={200}
              onChange={(event) => update(credit.id, { title: event.target.value })}
              placeholder={uiText("Ui.text_94530ff9f612ed")}
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none" />) })}</label>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest font-semibold text-text-muted mb-1.5">{uiText("Organizations.formatLabel")}</span>
              <select value={credit.format} onChange={(event) => update(credit.id, { format: event.target.value })}
                className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary focus:border-gold focus:outline-none">
                <option value="">{uiText("Ui.text_bdf6776cc67c9c")}</option>
                {PRODUCTION_FORMATS.map((format) => <option key={format} value={format}>{format}</option>)}
              </select>
            </label>
            <label className="block">{uiText.rich("Ui.text_4576de8bd37846", { part1: chunks => (<span className="block text-[10px] uppercase tracking-widest font-semibold text-text-muted mb-1.5">{chunks}</span>), part2: () => (<input type="number" min="1900" max="2100" value={credit.year}
                onChange={(event) => update(credit.id, { year: event.target.value })}
                placeholder="2025"
                className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none" />) })}</label>
          </div>

          <label className="block">{uiText.rich("Ui.text_5c4473abc83949", { part1: chunks => (<span className="block text-[10px] uppercase tracking-widest font-semibold text-text-muted mb-1.5">{chunks}</span>), part2: () => (<input value={credit.note} maxLength={800}
              onChange={(event) => update(credit.id, { note: event.target.value })}
              placeholder={uiText("Ui.text_945bc509890f88")}
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-gold focus:outline-none" />) })}</label>

          <div>
            <span className="block text-[10px] uppercase tracking-widest font-semibold text-text-muted mb-1.5">{uiText("Ui.text_c6e3a14e3633fb")}</span>
            <div className="flex flex-wrap gap-2">
              {credit.image_urls.map((url, imageIndex) => (
                <div key={`${url}-${imageIndex}`} className="relative h-16 w-20 overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={uiText("Ui.text_effbe8a53799b9", { value1: String(credit.title || uiText("menu.crewProduction")), value2: String(imageIndex + 1) })} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => update(credit.id, { image_urls: credit.image_urls.filter((_, i) => i !== imageIndex) })}
                    aria-label={uiText("Ui.text_3fdab64fa73c83", { value1: String(imageIndex + 1) })}
                    className="absolute right-1 top-1 rounded-full bg-black/75 p-1 text-white hover:text-red-300">
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {credit.image_urls.length < 4 && (
                <label className={`flex h-16 min-w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border px-3 text-text-muted transition-colors hover:border-gold hover:text-gold ${uploadingId === credit.id ? "pointer-events-none opacity-60" : ""}`}>
                  {uploadingId === credit.id ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                  <span className="text-[10px]">{uploadingId === credit.id ? uiText("Ui.text_c8ebc99b43446d") : uiText("profile.sectionPhotos")}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={uploadingId === credit.id}
                    onChange={(event) => void uploadImages(credit.id, event)} />
                </label>
              )}
            </div>
            {uploadError && <p role="alert" className="mt-2 text-xs text-red-400">{uploadError}</p>}
          </div>
        </div>
      ))}

      <button type="button" onClick={() => onChange([...value, createProductionCreditDraft()])}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-gold/60 hover:text-gold">{uiText.rich("Ui.text_1287a9e379b1c0", { part1: () => (<Plus size={15} />) })}</button>
    </section>
  );
}

export function ProductionCreditsDisplay({
  credits,
  heading,
}: {
  credits: ProductionCredit[];
  heading: string;
}) {
  const uiText = useTranslations();

  if (!credits.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-4 font-display text-xl font-bold text-text-primary">{heading}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {credits.map((credit, index) => (
          <article key={`${credit.title}-${index}`} className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
            {credit.image_urls && credit.image_urls.length > 0 && (
              <div className="grid grid-cols-2 gap-px bg-border">
                {credit.image_urls.slice(0, 4).map((url, imageIndex) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={`${url}-${imageIndex}`} src={url} alt={uiText("Ui.text_d67fe87bcb7adf", { value1: String(credit.title), value2: String(imageIndex + 1) })} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                ))}
              </div>
            )}
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h3 className="font-semibold text-text-primary">{credit.title}</h3>
                {credit.year && <span className="text-xs text-text-muted">{credit.year}</span>}
                {credit.format && <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">{credit.format}</span>}
              </div>
              {credit.note && <p className="text-sm leading-relaxed text-text-secondary">{credit.note}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
