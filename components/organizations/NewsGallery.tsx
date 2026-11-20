"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import MediaImage from "@/components/ListingImage";
import { TranslatedText, useTranslatedContent } from "@/components/ContentTranslation";
import { newsGalleryImages, parseNewsGallery } from "@/lib/news-gallery";

export default function NewsGallery({ cover, gallery, review = false, entryId }: {cover: string | null; gallery?: unknown; review?: boolean; entryId?: string}) {
  const t = useTranslations("NewsGallery");
  const images = newsGalleryImages(cover, gallery);
  const rail = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const sourceImages = parseNewsGallery(gallery) ?? [];
  const selectedImage = images[selected];
  const sourceIndex = (url: string) => sourceImages.findIndex(image => image.url === url);
  const translatedAlt = useTranslatedContent({kind: "news", id: entryId ?? "", field: `image_${selectedImage ? sourceIndex(selectedImage.url) : -1}_altText`,
    source: selectedImage?.altText, active: Boolean(entryId && !review && selectedImage?.altText)});
  if (!images.length) return null;
  const move = (index: number) => {
    rail.current?.children[index]?.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest", inline: "start"});
  };
  return <section className="mb-8 min-w-0" aria-label={t("title")}>
    <div ref={rail} tabIndex={images.length > 1 ? 0 : undefined}
      className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-bg-secondary focus-visible:outline-2 focus-visible:outline-gold"
      onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(Math.max(0, Math.min(images.length - 1, selected + (event.key === "ArrowRight" ? 1 : -1)))); } }}
      onScroll={() => { const node = rail.current; if (node?.clientWidth) setSelected(Math.round(node.scrollLeft / node.clientWidth)); }}>
      {images.map((image, index) => <figure key={image.url} className="w-full min-w-full snap-start">
        <div className="relative aspect-[16/10] overflow-hidden">
          <MediaImage src={review ? `/api/admin/organizations/media?reference=${encodeURIComponent(image.url)}` : image.url} alt={(index === selected ? translatedAlt.text : image.altText) || ""} fill sizes="(max-width: 768px) 100vw, 896px" className="object-contain" loading="lazy" />
        </div>
        {image.creator && <figcaption className="space-y-1 border-t border-border px-4 py-3 text-xs leading-relaxed text-text-secondary [overflow-wrap:anywhere]">
          {image.caption && <p className="text-sm text-text-primary">{entryId && !review ? <TranslatedText kind="news" id={entryId} field={`image_${sourceIndex(image.url)}_caption`}>{image.caption}</TranslatedText> : image.caption}</p>}
          <p>{t("creator")}: {image.creator}</p>
          <p className="flex flex-wrap gap-x-3"><a className="underline underline-offset-4" href={image.sourceUrl} target="_blank" rel="noopener noreferrer">{image.imageTitle || t("source")}</a>
            {image.licenseUrl ? <a className="underline underline-offset-4" href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{image.licenseName}</a> : <span>{image.licenseName}</span>}</p>
          <p>{t("changes")}: {image.changes}</p>
          {image.attribution && <p>{image.attribution}</p>}
          {image.credit && image.credit !== image.attribution && <p>{image.credit}</p>}
        </figcaption>}
        <span className="sr-only">{t("position", {current: index + 1, total: images.length})}</span>
      </figure>)}
    </div>
    {images.length > 1 && <div className="flex flex-wrap justify-center" aria-label={t("title")}>
      {images.map((image, index) => <button key={image.url} type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-gold" aria-label={t("position", {current: index + 1, total: images.length})} aria-current={selected === index ? "true" : undefined} onClick={() => move(index)}>
        <span className={`h-2 w-2 rounded-full ${selected === index ? "bg-gold" : "bg-text-muted"}`} aria-hidden="true" />
      </button>)}
    </div>}
  </section>;
}
