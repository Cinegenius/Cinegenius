"use client";

import { useState } from "react";
import { Star, CheckCircle, X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { uiErrorMessage } from "@/lib/ui-error-message";


interface Props {
  targetId: string;
  targetName: string;
  targetType: "location" | "creator" | "prop" | "vehicle" | "profile" | "animal";
  initialReview?: { id: string; rating: number; text: string } | null;
  onClose: () => void;
  onSubmit?: (rating: number, text: string, reviewId?: string) => void;
}



const aspects: Record<Props["targetType"], string[]> = {
  location:  ["Genauigkeit der Beschreibung", "Kommunikation", "Sauberkeit", "Lage", "Wert"],
  creator:   ["Professionalität", "Kommunikation", "Pünktlichkeit", "Qualität der Arbeit", "Wert"],
  prop:      ["Genauigkeit der Beschreibung", "Zustand", "Lieferung", "Kommunikation", "Wert"],
  vehicle:   ["Genauigkeit der Beschreibung", "Zustand", "Übergabe", "Kommunikation", "Wert"],
  profile:   ["Professionalität", "Kommunikation", "Pünktlichkeit", "Qualität der Arbeit", "Zuverlässigkeit"],
  animal:    ["Dressur-Level", "Verhalten am Set", "Handler-Kommunikation", "Pünktlichkeit", "Wert"],
};


function getLocalizedLabels(translate: (key: string) => string) { return (["", translate("Ui.text_7c92511643bb6b"), translate("Ui.text_7d9539e9bb870e"), translate("Ui.text_7a26d266bf0c4e"), translate("Ui.text_9f24cc311ede00"), translate("Ui.text_29fde84fd1671b")]); }

export default function ReviewForm({ targetId, targetName, targetType, initialReview, onClose, onSubmit }: Props) {
  const uiText = useTranslations();
  const labels = getLocalizedLabels(uiText);

  const uiOptionLabels: Record<string, string> = {
    "Genauigkeit der Beschreibung": uiText("Ui.text_28d52a066a6f13"),
    "Kommunikation": uiText("Ui.text_4f1228bcb1ac56"),
    "Sauberkeit": uiText("Ui.text_2f45bf9ff4674a"),
    "Lage": uiText("Ui.text_295029201d603e"),
    "Wert": uiText("Ui.text_7e347daa5ec7fb"),
    "Professionalität": uiText("Ui.text_89d961ab78f513"),
    "Pünktlichkeit": uiText("Ui.text_4ed3fa77a09c93"),
    "Qualität der Arbeit": uiText("Ui.text_47e7f60f4800a2"),
    "Zustand": uiText("props.conditionLabel"),
    "Lieferung": uiText("props.deliveryLabel"),
    "Übergabe": uiText("MarketplaceOffer.fulfilment"),
    "Zuverlässigkeit": uiText("Ui.text_3943f61ac03a6e"),
    "Dressur-Level": uiText("Ui.text_f842743bda8808"),
    "Verhalten am Set": uiText("Ui.text_03bfab4d141373"),
    "Handler-Kommunikation": uiText("Ui.text_713f6b2bca8f52"),
  };






  const [overall, setOverall] = useState(initialReview?.rating ?? 0);
  const [hovered, setHovered] = useState(0);
  const [aspectRatings, setAspectRatings] = useState<Record<string, number>>({});
  const [text, setText] = useState(initialReview?.text ?? "");
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
          target_type: targetType === "profile" ? "user" : "listing",
          rating: overall,
          text: text.trim(),
          aspect_ratings: aspectRatings,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? uiText("profile.savingError"));

      setSubmitted(true);
      onSubmit?.(overall, text, initialReview?.id);
    } catch (err) {
      setError(uiErrorMessage(err, uiText("profile.savingError")));
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
          <h3 className="font-display text-xl font-bold text-text-primary mb-2">{initialReview ? uiText("Ui.text_e191ceffa6fd07") : uiText("Ui.text_440dad53bbb5c5")}</h3>
          <p className="text-text-muted text-sm mb-6 leading-relaxed">{uiText("Ui.text_3f610af8e068b7")}</p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors"
          >{uiText("ProfilePhotoCrop.close")}</button>
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
            <h2 className="font-display text-lg font-bold text-text-primary">{initialReview ? uiText("Ui.text_68b790ccd7ac43") : uiText("Ui.text_11ab7b359040ad")}</h2>
            <p className="text-xs text-text-muted">{targetName}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-gold transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Overall rating */}
          <div>
            <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-3">{uiText.rich("Ui.text_1924bcf35aa077", { part1: chunks => (<span className="text-crimson-light">{chunks}</span>) })}</label>
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
            <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-3">{uiText("Ui.text_19e28ddcde45a7")}</label>
            <div className="space-y-3">
              {aspectList.map((aspect) => (
                <div key={aspect} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-text-secondary flex-1">{(uiOptionLabels[aspect] ?? aspect)}</span>
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
            <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-2">{uiText.rich("Ui.text_e7c22633a7e39d", { part1: chunks => (<span className="text-crimson-light">{chunks}</span>) })}</label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={uiText("Ui.text_46c6224ca36266")}
              className="w-full bg-bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
            />
            <div className="flex justify-between mt-1">
              <p className="text-[11px] text-text-muted">{uiText("Ui.text_dfd52e19fe2167")}</p>
              <p className={`text-[11px] ${text.length >= 20 ? "text-success" : "text-text-muted"}`}>{uiText.rich("Ui.text_a1569b4ba52198", { value1: () => (text.length) })}</p>
            </div>
          </div>

          {/* Anonymous note */}
          <div className="p-3 bg-bg-secondary border border-border rounded-lg">
            <p className="text-xs text-text-muted leading-relaxed">{uiText.rich("Ui.text_0dfbaa3b1f52c8", { part1: chunks => (<span className="font-semibold text-text-secondary">{chunks}</span>) })}</p>
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
            {submitting ? uiText("profile.saving") : uiText("Ui.text_e8d99308675793")}
          </button>
        </div>
      </div>
    </div>
  );
}
