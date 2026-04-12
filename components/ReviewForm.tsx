"use client";

import { useState } from "react";
import { Star, CheckCircle, X, Loader2 } from "lucide-react";

interface Props {
  targetId: string;
  targetName: string;
  targetType: "location" | "creator" | "prop" | "vehicle";
  onClose: () => void;
  onSubmit?: (rating: number, text: string) => void;
}

const labels = ["", "Enttäuschend", "Verbesserungswürdig", "Gut", "Sehr gut", "Ausgezeichnet"];

const aspects: Record<Props["targetType"], string[]> = {
  location:  ["Genauigkeit der Beschreibung", "Kommunikation", "Sauberkeit", "Lage", "Wert"],
  creator:   ["Professionalität", "Kommunikation", "Pünktlichkeit", "Qualität der Arbeit", "Wert"],
  prop:      ["Genauigkeit der Beschreibung", "Zustand", "Lieferung", "Kommunikation", "Wert"],
  vehicle:   ["Genauigkeit der Beschreibung", "Zustand", "Übergabe", "Kommunikation", "Wert"],
};

export default function ReviewForm({ targetId, targetName, targetType, onClose, onSubmit }: Props) {
  const [overall, setOverall] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [aspectRatings, setAspectRatings] = useState<Record<string, number>>({});
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const aspectList = aspects[targetType];
  const canSubmit = overall > 0 && text.trim().length >= 20;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_id: targetId,
          target_type: targetType,
          rating: overall,
          text: text.trim(),
          aspect_ratings: aspectRatings,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Speichern");

      setSubmitted(true);
      onSubmit?.(overall, text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-bg-elevated border border-border rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-success" />
          </div>
          <h3 className="font-display text-xl font-bold text-text-primary mb-2">Bewertung gesendet!</h3>
          <p className="text-text-muted text-sm mb-6 leading-relaxed">
            Danke für dein Feedback. Deine Bewertung hilft der Community, bessere Entscheidungen zu treffen.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-elevated border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg-elevated">
          <div>
            <h2 className="font-display text-lg font-bold text-text-primary">Bewertung schreiben</h2>
            <p className="text-xs text-text-muted">{targetName}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-gold transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Overall rating */}
          <div>
            <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-3">
              Gesamtbewertung <span className="text-crimson-light">*</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setOverall(s)}
                    onMouseEnter={() => setHovered(s)}
                    onMouseLeave={() => setHovered(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      size={32}
                      className={`transition-colors ${
                        s <= (hovered || overall) ? "text-gold fill-gold" : "text-border"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {(hovered || overall) > 0 && (
                <span className="text-sm font-semibold text-gold">
                  {labels[hovered || overall]}
                </span>
              )}
            </div>
          </div>

          {/* Aspect ratings */}
          <div>
            <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-3">
              Detailbewertung
            </label>
            <div className="space-y-3">
              {aspectList.map((aspect) => (
                <div key={aspect} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-text-secondary flex-1">{aspect}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setAspectRatings((r) => ({ ...r, [aspect]: s }))}
                      >
                        <Star
                          size={16}
                          className={`transition-colors ${
                            s <= (aspectRatings[aspect] ?? 0)
                              ? "text-gold fill-gold"
                              : "text-border hover:text-gold/50"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Text */}
          <div>
            <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">
              Deine Erfahrung <span className="text-crimson-light">*</span>
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Beschreibe deine Erfahrung — was hat gut funktioniert? Was könnte besser sein?"
              className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
            />
            <div className="flex justify-between mt-1">
              <p className="text-[11px] text-text-muted">Mindestens 20 Zeichen</p>
              <p className={`text-[11px] ${text.length >= 20 ? "text-success" : "text-text-muted"}`}>
                {text.length} Zeichen
              </p>
            </div>
          </div>

          {/* Anonymous note */}
          <div className="p-3 bg-bg-secondary border border-border rounded-lg">
            <p className="text-xs text-text-muted leading-relaxed">
              <span className="font-semibold text-text-secondary">Verifizierte Bewertung:</span>{" "}
              Diese Bewertung wird nur nach abgeschlossener Buchung veröffentlicht und ist dauerhaft mit deiner Buchungs-ID verknüpft.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={`w-full py-3 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
              canSubmit && !submitting
                ? "bg-gold text-bg-primary hover:bg-gold-light"
                : "bg-border text-text-muted cursor-not-allowed"
            }`}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {submitting ? "Wird gespeichert..." : "Bewertung einreichen"}
          </button>
        </div>
      </div>
    </div>
  );
}
