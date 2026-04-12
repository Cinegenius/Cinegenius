"use client";

import { useState, useEffect } from "react";
import { Star, MessageSquare } from "lucide-react";
import ReviewForm from "@/components/ReviewForm";

type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  text: string;
  created_at: string;
};

type TargetType = "location" | "creator" | "prop" | "vehicle";

interface Props {
  targetId: string;
  targetType: TargetType;
  targetName: string;
}

export default function ReviewsSection({ targetId, targetType, targetName }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/reviews?target_id=${targetId}&target_type=${targetType}`)
      .then((r) => r.json())
      .then(({ data }) => { if (Array.isArray(data)) setReviews(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [targetId, targetType]);

  const avgRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold text-text-primary flex items-center gap-2">
          Bewertungen
          {!loading && reviews.length > 0 && (
            <span className="text-base font-normal text-text-muted">({reviews.length})</span>
          )}
        </h2>
        {avgRating !== null && (
          <div className="flex items-center gap-1.5">
            <Star size={14} className="text-gold fill-gold" />
            <span className="text-sm font-semibold text-text-primary">{avgRating}</span>
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-bg-secondary border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Reviews list */}
      {!loading && (
        <div className="space-y-4">
          {reviews.length === 0 && (
            <p className="text-sm text-text-muted italic">
              Noch keine Bewertungen — sei der/die Erste!
            </p>
          )}
          {reviews.map((r) => (
            <div key={r.id} className="p-5 bg-bg-secondary border border-border rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-text-primary text-sm">{r.reviewer_name}</span>
                <div className="flex items-center gap-1">
                  {[...Array(r.rating)].map((_, i) => (
                    <Star key={i} size={12} className="text-gold fill-gold" />
                  ))}
                  {[...Array(5 - r.rating)].map((_, i) => (
                    <Star key={i} size={12} className="text-border" />
                  ))}
                  <span className="text-xs text-text-muted ml-1">
                    {new Date(r.created_at).toLocaleDateString("de-DE", { month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Write review button */}
      <button
        onClick={() => setFormOpen(true)}
        className="mt-5 flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary text-sm rounded-lg hover:border-gold hover:text-gold transition-all"
      >
        <MessageSquare size={14} /> Eigene Bewertung schreiben
      </button>

      {/* Review modal */}
      {formOpen && (
        <ReviewForm
          targetId={targetId}
          targetName={targetName}
          targetType={targetType}
          onClose={() => setFormOpen(false)}
          onSubmit={(rating, text) => {
            setReviews((prev) => [{
              id: String(Date.now()),
              reviewer_name: "Du",
              rating,
              text,
              created_at: new Date().toISOString(),
            }, ...prev]);
            setFormOpen(false);
          }}
        />
      )}
    </div>
  );
}
