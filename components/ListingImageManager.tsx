"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, RefreshCw, Star, Trash2, Upload } from "lucide-react";
import UnoptimizedImage from "@/components/UnoptimizedImage";
import { compressImage, MAX_FUNCTION_UPLOAD_BYTES, safeObjectURL } from "@/lib/compressImage";
import { galleryUrlsFromEntries, MAX_LISTING_IMAGES, moveGalleryImage } from "@/lib/listing-image-gallery";

type Entry = {
  id: string;
  url?: string;
  previewUrl: string;
  status: "ready" | "uploading" | "failed";
  progress: number;
  stage?: "compressing" | "uploading";
  file?: File;
  replacementFile?: File;
  replacementPreview?: string;
  error?: string;
};

type UploadState = { uploading: boolean; failed: number };

type Props = {
  value: string[];
  onChange: (images: string[]) => void;
  onStatusChange?: (state: UploadState) => void;
  label?: string;
};

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function uniqueUrls(urls: string[]) {
  return [...new Set(urls.filter((url) => typeof url === "string" && url.trim()).map((url) => url.trim()))];
}

function uploadFile(file: File, onProgress: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const data = new FormData();
    data.append("file", file);
    request.open("POST", "/api/upload");
    request.timeout = 120_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("Verbindung unterbrochen. Bitte dieses Bild erneut hochladen."));
    request.ontimeout = () => reject(new Error("Der Upload dauert zu lange. Bitte dieses Bild erneut hochladen."));
    request.onload = () => {
      let response: { url?: string; error?: string } = {};
      try { response = JSON.parse(request.responseText) as typeof response; } catch { /* handled below */ }
      if (request.status >= 200 && request.status < 300 && response.url) {
        resolve(response.url);
        return;
      }
      reject(new Error(request.status === 413
        ? "Das Bild ist zu groß. Es wird vor dem Upload verkleinert; wähle bitte ein anderes Foto."
        : response.error ?? "Das Bild konnte nicht hochgeladen werden."));
    };
    request.send(data);
  });
}

export default function ListingImageManager({ value, onChange, onStatusChange, label = "Artikelbilder" }: Props) {
  const initial = uniqueUrls(value).map((url) => ({
    id: `saved:${url}`,
    url,
    previewUrl: url,
    status: "ready" as const,
    progress: 100,
  }));
  const [entries, setEntries] = useState<Entry[]>(initial);
  const [notice, setNotice] = useState("");
  const [busy, setBusyState] = useState(false);
  const entriesRef = useRef(entries);
  const onChangeRef = useRef(onChange);
  const onStatusChangeRef = useRef(onStatusChange);
  const lastEmittedRef = useRef(JSON.stringify(uniqueUrls(value)));
  const reportedStatusRef = useRef<UploadState>({ uploading: false, failed: 0 });
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const valueKey = JSON.stringify(value);

  const reportStatus = useCallback((next: UploadState) => {
    const previous = reportedStatusRef.current;
    if (previous.uploading === next.uploading && previous.failed === next.failed) return;
    reportedStatusRef.current = next;
    onStatusChangeRef.current?.(next);
  }, []);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  useEffect(() => {
    const urls = uniqueUrls(value);
    const signature = JSON.stringify(urls);
    if (signature === lastEmittedRef.current) return;
    entriesRef.current.forEach((entry) => {
      if (entry.previewUrl.startsWith("blob:")) URL.revokeObjectURL(entry.previewUrl);
      if (entry.replacementPreview?.startsWith("blob:")) URL.revokeObjectURL(entry.replacementPreview);
    });
    const next = urls.map((url) => ({ id: `saved:${url}`, url, previewUrl: url, status: "ready" as const, progress: 100 }));
    entriesRef.current = next;
    lastEmittedRef.current = signature;
    setEntries(next);
  // `valueKey` tracks array contents while avoiding resets when the parent passes a new reference.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey]);

  useEffect(() => {
    const failed = entries.filter((entry) => entry.status === "failed" || !!entry.error).length;
    reportStatus({ uploading: busyRef.current, failed });
  }, [entries, reportStatus]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      entriesRef.current.forEach((entry) => {
        if (entry.previewUrl.startsWith("blob:")) URL.revokeObjectURL(entry.previewUrl);
        if (entry.replacementPreview?.startsWith("blob:")) URL.revokeObjectURL(entry.replacementPreview);
      });
    };
  }, []);

  const writeEntries = (next: Entry[], emit = false) => {
    entriesRef.current = next;
    setEntries(next);
    if (emit) {
      const urls = galleryUrlsFromEntries(next);
      const signature = JSON.stringify(urls);
      lastEmittedRef.current = signature;
      onChangeRef.current(urls);
    }
  };

  const patchEntry = (id: string, patch: Partial<Entry>, emit = false) => {
    if (!mountedRef.current) return;
    const next = entriesRef.current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry);
    writeEntries(next, emit);
  };

  const setBusy = (busy: boolean) => {
    busyRef.current = busy;
    setBusyState(busy);
    reportStatus({
      uploading: busy,
      failed: entriesRef.current.filter((entry) => entry.status === "failed" || !!entry.error).length,
    });
  };

  const runUpload = async (id: string, file: File, replacing: boolean, manageBusy = true) => {
    const existing = entriesRef.current.find((entry) => entry.id === id);
    if (!existing) return;
    if (manageBusy) setBusy(true);
    patchEntry(id, { status: "uploading", stage: "compressing", progress: 0, error: undefined }, false);
    try {
      const compressed = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.82,
        maxBytes: MAX_FUNCTION_UPLOAD_BYTES,
      });
      if (!mountedRef.current) return;
      patchEntry(id, { stage: "uploading", progress: 0 }, false);
      const url = await uploadFile(compressed, (progress) => patchEntry(id, { progress }, false));
      if (!mountedRef.current) return;
      const current = entriesRef.current.find((entry) => entry.id === id);
      if (!current) return;
      const previewUrl = url;
      if (current.previewUrl.startsWith("blob:")) URL.revokeObjectURL(current.previewUrl);
      if (current.replacementPreview?.startsWith("blob:")) URL.revokeObjectURL(current.replacementPreview);
      const ready: Entry = {
        id,
        url,
        previewUrl,
        status: "ready",
        progress: 100,
      };
      const next = entriesRef.current.map((entry) => entry.id === id ? ready : entry);
      writeEntries(next, true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Das Bild konnte nicht hochgeladen werden.";
      const current = entriesRef.current.find((entry) => entry.id === id);
      if (current && mountedRef.current) {
        const replacementPreview = current.replacementPreview ?? safeObjectURL(file) ?? undefined;
        const failed: Entry = replacing
          ? {
              ...current,
              status: "ready",
              stage: undefined,
              progress: 0,
              error: message,
              replacementFile: file,
              replacementPreview,
              previewUrl: replacementPreview ?? current.previewUrl,
            }
          : { ...current, status: "failed", stage: undefined, progress: 0, error: message, file };
        patchEntry(id, failed, false);
      }
    } finally {
      if (mountedRef.current && manageBusy) setBusy(false);
    }
  };

  const handleAddFiles = async (files: FileList | null) => {
    if (!files?.length || busyRef.current) return;
    const remaining = Math.max(0, MAX_LISTING_IMAGES - entriesRef.current.length);
    if (!remaining) {
      setNotice(`Du kannst höchstens ${MAX_LISTING_IMAGES} Bilder hinzufügen.`);
      return;
    }
    const selected = Array.from(files);
    const accepted = selected.slice(0, remaining);
    setNotice(selected.length > remaining ? `Es wurden nur ${remaining} weitere Bilder ausgewählt. Insgesamt sind maximal ${MAX_LISTING_IMAGES} erlaubt.` : "");
    const additions = accepted.map((file) => {
      const previewUrl = safeObjectURL(file);
      return {
        id: makeId(),
        previewUrl: previewUrl ?? "",
        status: "uploading" as const,
        progress: 0,
        stage: "compressing" as const,
        file,
      };
    });
    writeEntries([...entriesRef.current, ...additions], false);
    setBusy(true);
    try {
      for (const entry of additions) await runUpload(entry.id, entry.file!, false, false);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const handleReplacement = async (entry: Entry, file: File) => {
    if (busyRef.current) return;
    const preview = safeObjectURL(file);
    patchEntry(entry.id, {
      status: "uploading",
      stage: "compressing",
      progress: 0,
      error: undefined,
      replacementFile: file,
      replacementPreview: preview ?? undefined,
      previewUrl: preview ?? entry.previewUrl,
    }, false);
    await runUpload(entry.id, file, true);
  };

  const moveImage = (from: number, to: number) => {
    if (busyRef.current) return;
    writeEntries(moveGalleryImage(entriesRef.current, from, to), true);
  };

  const removeImage = (entry: Entry) => {
    if (busyRef.current) return;
    if (entry.previewUrl.startsWith("blob:")) URL.revokeObjectURL(entry.previewUrl);
    if (entry.replacementPreview?.startsWith("blob:")) URL.revokeObjectURL(entry.replacementPreview);
    writeEntries(entriesRef.current.filter((current) => current.id !== entry.id), true);
    setNotice("");
  };

  const retryImage = async (entry: Entry) => {
    if (busyRef.current) return;
    const file = entry.replacementFile ?? entry.file;
    if (!file) return;
    await runUpload(entry.id, file, !!entry.replacementFile);
  };

  const isBusy = busy;
  const failedCount = entries.filter((entry) => entry.status === "failed" || !!entry.error).length;
  const mainEntryId = entries.find((entry) => !!entry.url && (entry.status === "ready" || !!entry.replacementFile))?.id;

  return (
    <section aria-label={label} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest">{label}</label>
          <p className="mt-1 text-xs text-text-muted">JPG, PNG, WebP oder HEIC/HEIF · große Fotos werden automatisch verkleinert (max. 4 MB pro Foto nach der Verkleinerung).</p>
        </div>
        <span className="text-xs text-text-muted">{entries.length} / {MAX_LISTING_IMAGES} Bilder</span>
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map((entry, index) => {
            const showingReplacement = !!entry.replacementPreview && !!entry.error;
            return (
              <article key={entry.id} className={`relative overflow-hidden rounded-xl border bg-bg-secondary ${index === 0 ? "border-gold/60" : "border-border"}`}>
                <div className="relative aspect-[4/3] bg-bg-elevated">
                  {entry.previewUrl ? (
                    <UnoptimizedImage src={entry.previewUrl} alt={`Artikelbild ${index + 1}`} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-text-muted">Vorschau nicht verfügbar</div>
                  )}
                  {entry.status === "uploading" && (
                    <div className="absolute inset-x-0 bottom-0 bg-bg-primary/90 px-3 py-2">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-text-secondary">
                        <Loader2 size={12} className="animate-spin text-gold" />
                        {entry.stage === "compressing" ? "Wird verkleinert…" : `Upload ${entry.progress}%`}
                      </div>
                      <div role="progressbar" aria-label={`Uploadfortschritt Bild ${index + 1}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={entry.stage === "uploading" ? entry.progress : undefined} className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                        <div className={`h-full rounded-full bg-gold transition-[width] duration-150 ${entry.stage === "compressing" ? "w-1/4 animate-pulse" : ""}`} style={entry.stage === "uploading" ? { width: `${entry.progress}%` } : undefined} />
                      </div>
                    </div>
                  )}
                  {entry.status === "failed" && (
                    <div className="absolute inset-x-0 bottom-0 bg-red-950/90 px-3 py-2 text-[11px] text-red-100">Upload fehlgeschlagen</div>
                  )}
                  {entry.id === mainEntryId && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-gold/30 bg-bg-primary/90 px-2 py-1 text-[10px] font-semibold text-gold">
                      <Star size={10} fill="currentColor" /> Hauptbild
                    </span>
                  )}
                  {showingReplacement && (
                    <span className="absolute inset-x-2 top-10 rounded bg-bg-primary/90 px-2 py-1 text-center text-[10px] text-red-300">Ersatz fehlgeschlagen · altes Bild bleibt gespeichert</span>
                  )}
                </div>

                {entry.error && (
                  <p role="alert" className="px-2 pt-2 text-[11px] leading-4 text-red-300">{entry.error}</p>
                )}

                <div className="flex flex-wrap items-center gap-1 p-2">
                  {index > 0 && (
                    <button type="button" disabled={isBusy} onClick={() => moveImage(index, index - 1)} aria-label={`Bild ${index + 1} nach oben verschieben`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-2 text-[11px] text-text-secondary hover:border-gold hover:text-gold disabled:opacity-50">
                      <ArrowUp size={12} /> Nach oben
                    </button>
                  )}
                  {index < entries.length - 1 && (
                    <button type="button" disabled={isBusy} onClick={() => moveImage(index, index + 1)} aria-label={`Bild ${index + 1} nach unten verschieben`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-2 text-[11px] text-text-secondary hover:border-gold hover:text-gold disabled:opacity-50">
                      <ArrowDown size={12} /> Nach unten
                    </button>
                  )}
                  <label className={`inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg border border-border px-2 text-[11px] text-text-secondary hover:border-gold hover:text-gold ${isBusy ? "pointer-events-none opacity-50" : ""}`}>
                    <RefreshCw size={11} /> Ersetzen
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" disabled={isBusy} onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) void handleReplacement(entry, file);
                      event.currentTarget.value = "";
                    }} />
                  </label>
                  {entry.status === "failed" || entry.error ? (
                    <button type="button" disabled={isBusy} onClick={() => void retryImage(entry)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-gold/40 px-2 text-[11px] text-gold hover:bg-gold/10 disabled:opacity-50">
                      <RefreshCw size={11} /> Erneut hochladen
                    </button>
                  ) : entry.status === "ready" ? (
                    <span className="inline-flex min-h-11 items-center gap-1 px-1 text-[11px] text-success"><Check size={12} /> Hochgeladen</span>
                  ) : null}
                  <button type="button" disabled={isBusy} onClick={() => removeImage(entry)} aria-label={`Bild ${index + 1} entfernen`} className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg border border-red-500/20 px-2 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-50">
                    <Trash2 size={11} /> Entfernen
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={isBusy || entries.length >= MAX_LISTING_IMAGES} onClick={() => fileInputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-50">
          {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {isBusy ? "Upload läuft…" : "Bilder hinzufügen"}
        </button>
        <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" disabled={isBusy || entries.length >= MAX_LISTING_IMAGES} onChange={(event) => {
          void handleAddFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }} />
        <span className="text-xs text-text-muted">Das erste Bild ist das Hauptbild. Über „Nach oben“ kannst du die Reihenfolge auch ohne Ziehen ändern.</span>
      </div>

      {notice && <p role="status" className="text-xs text-gold">{notice}</p>}
      {failedCount > 0 && <p role="alert" className="text-xs text-red-300">{failedCount} Bild{failedCount === 1 ? "" : "er"} nicht erfolgreich hochgeladen. Erneut hochladen oder entfernen, bevor du speicherst.</p>}
    </section>
  );
}
