"use client";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import MediaImage from "@/components/ListingImage";
import { NEWS_GALLERY_LIMIT, type NewsGalleryImage } from "@/lib/news-gallery";

type Value = {imageUrl: string; imageGallery?: NewsGalleryImage[]};
type Props = {value: Value; onChange: (value: Value) => void; disabled: boolean; onBusy: (busy: boolean) => void; onError: () => void};
const field = "mt-1 min-h-11 w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-text-primary";
const emptyCredits = (url: string): NewsGalleryImage => ({url, altText: "", creator: "", sourceUrl: "", licenseName: "", licenseUrl: "", changes: "", caption: "", imageTitle: "", attribution: "", credit: ""});
export default function NewsGalleryEditor({value, onChange, disabled, onBusy, onError}: Props) {
  const t = useTranslations("NewsGallery"), organizations = useTranslations("Organizations");
  const pending = useRef(false);
  const gallery = value.imageGallery ?? [];
  const urls = [...new Set([value.imageUrl, ...gallery.map(image => image.url)].filter(Boolean))];
  const update = (image: NewsGalleryImage) => onChange({...value, imageGallery: gallery.some(item => item.url === image.url) ? gallery.map(item => item.url === image.url ? image : item) : [...gallery, image]});
  const remove = (url: string) => onChange({imageUrl: value.imageUrl === url ? urls.find(item => item !== url) ?? "" : value.imageUrl, imageGallery: gallery.filter(item => item.url !== url)});
  const upload = async (files: FileList | null) => {
    if (!files?.length || pending.current || disabled) return;
    pending.current = true; onBusy(true);
    let next = value;
    try {
      for (const file of [...files].slice(0, NEWS_GALLERY_LIMIT - urls.length)) {
        const data = new FormData(); data.append("file", file);
        const response = await fetch("/api/upload", {method: "POST", body: data, signal: AbortSignal.timeout(30_000)});
        const result = await response.json().catch(() => null);
        if (!response.ok || typeof result?.url !== "string") throw new Error("upload");
        next = {imageUrl: next.imageUrl || result.url, imageGallery: [...(next.imageGallery ?? []), emptyCredits(result.url)]};
        onChange(next);
      }
    } catch { onError(); }
    finally { pending.current = false; onBusy(false); }
  };
  return <fieldset className="min-w-0 space-y-3 rounded-xl border border-border p-4" disabled={disabled}
    onInvalidCapture={event => { (event.target as HTMLElement).closest("details")?.setAttribute("open", ""); }}>
    <legend className="px-1 text-sm text-text-primary">{t("title")}</legend>
    <p className="text-xs leading-relaxed text-text-muted">{t("help")}</p>
    {urls.map((url, index) => {
      const image = gallery.find(item => item.url === url);
      return <details key={url} className="rounded-xl border border-border p-3">
        <summary className="min-h-11 cursor-pointer text-sm text-text-primary">{t("position", {current: index + 1, total: urls.length})}</summary>
        <MediaImage src={url} alt={image?.altText || ""} width={320} height={200} className="mb-3 h-32 w-full object-contain" />
        {!image && <button type="button" className="min-h-11 text-sm text-gold" onClick={() => update(emptyCredits(url))}>{t("addCredits")}</button>}
        {image && <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {(["altText", "caption", "creator", "imageTitle", "sourceUrl", "licenseName", "licenseUrl", "changes", "attribution", "credit"] as const).map(key => <label key={key} className="min-w-0 text-xs text-text-secondary">{t(key)}
            <input type={key.endsWith("Url") ? "url" : "text"} className={field} required={["altText", "creator", "sourceUrl", "licenseName", "changes"].includes(key)} maxLength={{altText: 300,caption: 800,creator: 200,imageTitle: 300,sourceUrl: 2048,licenseName: 160,licenseUrl: 2048,changes: 500,attribution: 1000,credit: 500}[key]} value={image[key] ?? ""} onChange={event => update({...image, [key]: event.target.value})} />
          </label>)}
        </div>}
        <div className="mt-3 flex flex-wrap gap-3">
          {url !== value.imageUrl && <button type="button" className="min-h-11 text-sm text-gold" onClick={() => onChange({...value, imageUrl: url})}>{t("makeCover")}</button>}
          <button type="button" className="min-h-11 text-sm text-text-secondary" onClick={() => remove(url)}>{organizations("removeImage")}</button>
        </div>
      </details>;
    })}
    {urls.length < NEWS_GALLERY_LIMIT && <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-border px-4 py-2 text-sm text-text-primary">
      {organizations("uploadImage")}<input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event => {void upload(event.target.files); event.currentTarget.value = "";}} />
    </label>}
  </fieldset>;
}
