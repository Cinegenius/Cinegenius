// Shared accents for homepage notice-board posts and job requests.
export const NOTICE_CARD_STYLES = {
  question: {
    card: "border-cyan-300/30 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.10),transparent_58%),linear-gradient(145deg,rgba(31,36,50,0.98),rgba(16,19,27,0.98))] hover:border-cyan-300/55",
    accent: "from-cyan-300 via-cyan-400/80 to-sky-400/70",
  },
  recommendation: {
    card: "border-violet-300/30 bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,0.11),transparent_58%),linear-gradient(145deg,rgba(31,36,50,0.98),rgba(16,19,27,0.98))] hover:border-violet-300/55",
    accent: "from-violet-300 via-violet-400/80 to-fuchsia-400/70",
  },
  request: {
    card: "border-amber-300/35 bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.12),transparent_58%),linear-gradient(145deg,rgba(31,36,50,0.98),rgba(16,19,27,0.98))] hover:border-amber-300/60",
    accent: "from-amber-300 via-amber-400/80 to-orange-400/70",
  },
  offer: {
    card: "border-emerald-300/30 bg-[radial-gradient(ellipse_at_top_left,rgba(52,211,153,0.11),transparent_58%),linear-gradient(145deg,rgba(31,36,50,0.98),rgba(16,19,27,0.98))] hover:border-emerald-300/55",
    accent: "from-emerald-300 via-emerald-400/80 to-teal-400/70",
  },
} as const;
