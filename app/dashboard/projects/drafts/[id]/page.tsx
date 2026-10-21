"use client";

import UnoptimizedImage from "@/components/UnoptimizedImage";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clapperboard, Loader2, Send, Trash2 } from "lucide-react";

type Draft = {
  id: string;
  source_project_id: string | null;
  published_project_id?: string | null;
  draft_data: Record<string, unknown>;
};

export default function ProjectDraftPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/project-drafts/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Entwurf konnte nicht geladen werden");
        return json.draft as Draft;
      })
      .then((value) => { if (alive) setDraft(value); })
      .catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : "Fehler beim Laden"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  async function publish() {
    if (!draft) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/project-drafts/${id}/publish`, { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Veröffentlichung fehlgeschlagen");
      router.push(`/projects/${json.projectId}`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Veröffentlichung fehlgeschlagen");
      setBusy(false);
    }
  }

  async function removeDraft() {
    if (!confirm("Diesen privaten Entwurf löschen?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/project-drafts/${id}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Entwurf konnte nicht gelöscht werden");
      router.push("/projects");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Entwurf konnte nicht gelöscht werden");
      setBusy(false);
    }
  }

  const data = draft?.draft_data ?? {};
  const title = typeof data.title === "string" ? data.title : "Unbenannter Entwurf";
  const type = typeof data.type === "string" ? data.type : "";
  const year = typeof data.year === "string" || typeof data.year === "number" ? String(data.year) : "";
  const director = typeof data.director === "string" ? data.director : "";
  const description = typeof data.description === "string" ? data.description : "";
  const poster = typeof data.poster_url === "string" ? data.poster_url : "";
  const crewEntries = Array.isArray(data.crew_entries)
    ? data.crew_entries.filter((entry): entry is { name: string; role: string } =>
      !!entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string" && typeof (entry as { role?: unknown }).role === "string",
    )
    : [];

  return (
    <main className="pt-16 min-h-screen bg-bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link href={draft?.source_project_id ? `/projects/${draft.source_project_id}` : "/projects"}
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold mb-6">
          <ArrowLeft size={16} /> Zurück
        </Link>
        <div className="rounded-2xl border border-gold/30 bg-bg-secondary overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-gold/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Private Vorschau · nur für dich sichtbar</p>
          </div>
          {loading ? (
            <div className="p-12 flex items-center justify-center text-text-muted"><Loader2 className="animate-spin" /></div>
          ) : error && !draft ? (
            <div className="p-8 text-center text-sm text-text-secondary">{error}</div>
          ) : (
            <div className="p-5 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-6">
                {poster ? <UnoptimizedImage src={poster} alt="Projektposter" className="w-36 aspect-[2/3] object-cover rounded-xl border border-border" /> :
                  <div className="w-36 aspect-[2/3] rounded-xl border border-border bg-bg-elevated flex items-center justify-center text-text-muted"><Clapperboard size={32} /></div>}
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-3xl text-text-primary mb-3">{title}</h1>
                  <div className="flex flex-wrap gap-2 text-sm text-text-secondary mb-5">
                    {type && <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-gold">{type}</span>}
                    {year && <span className="rounded-full border border-border px-3 py-1">{year}</span>}
                    {director && <span className="rounded-full border border-border px-3 py-1">Regie: {director}</span>}
                  </div>
                  <p className="text-sm leading-6 text-text-secondary whitespace-pre-wrap">{description || "Noch keine Beschreibung hinzugefügt."}</p>
                  {crewEntries.length > 0 && (
                    <section className="mt-6" aria-labelledby="draft-crew-heading">
                      <h2 id="draft-crew-heading" className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-2">Mitwirkende (werden erst bei Veröffentlichung angezeigt)</h2>
                      <ul className="space-y-1.5">
                        {crewEntries.map((entry, index) => (
                          <li key={`${entry.name}-${index}`} className="text-sm text-text-secondary">{entry.name} <span className="text-text-muted">· {entry.role}</span></li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </div>
              {error && <p role="alert" className="mt-5 text-sm text-red-400">{error}</p>}
              <div className="mt-8 pt-5 border-t border-border flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
                <button onClick={removeDraft} disabled={busy || !draft} className="min-h-11 px-4 rounded-xl border border-border text-text-secondary hover:text-red-400 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  <Trash2 size={15} /> Entwurf löschen
                </button>
                <button onClick={publish} disabled={busy || !draft} className="min-h-11 px-5 rounded-xl bg-gold text-bg-primary font-semibold hover:bg-gold-light disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Jetzt veröffentlichen
                </button>
              </div>
              <p className="mt-3 text-xs text-text-muted">Zur Veröffentlichung sind Titel und Produktionsart erforderlich. Es werden keine Nachrichten oder Benachrichtigungen versendet.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
