import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = {
  badge: string;
  title: string;
  titleHighlight?: string;
  description: string;
  /** @deprecated no longer rendered */
  image?: string;
  /** @deprecated */
  imagePosition?: string;
  cta?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  stats?: { value: string; label: string }[];
  overlay?: "left" | "center" | "bottom";
  height?: "sm" | "md" | "lg";
};

const LIME_18  = "rgba(194,241,53,0.18)";
const LIME_09  = "rgba(194,241,53,0.09)";
const LIME_DOT = "rgba(194,241,53,0.10)";
const GRAIN    = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const heights = { sm: "min-h-[220px]", md: "min-h-[280px]", lg: "min-h-[340px]" };

export default function CategoryHero({
  badge, title, titleHighlight, description,
  cta, ctaSecondary, stats,
  overlay = "left", height = "md",
}: Props) {
  const isCenter = overlay === "center";

  return (
    <div
      className={`pt-16 relative overflow-hidden flex items-center ${heights[height]}`}
      style={{ background: "linear-gradient(135deg, #1a1d26 0%, #0E1016 60%)" }}
    >
      {/* Lime glow — top right */}
      <div className="absolute -top-16 -right-16 w-[650px] h-[520px] rounded-full blur-[100px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${LIME_18}, transparent 70%)` }} />

      {/* Accent glow — bottom left */}
      <div className="absolute -bottom-8 left-1/4 w-80 h-56 rounded-full blur-[70px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${LIME_09}, transparent 70%)` }} />

      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, ${LIME_DOT} 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }} />

      {/* Film grain */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: GRAIN }} />

      {/* Left accent bar */}
      <div className="absolute top-0 left-0 bottom-0 w-[3px] pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(194,241,53,0.7), rgba(194,241,53,0.2) 55%, transparent)" }} />

      {/* Bottom hairline */}
      <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, rgba(194,241,53,0.25) 40%, rgba(194,241,53,0.25) 60%, transparent)" }} />

      {/* Content */}
      <div className={`relative z-10 w-full px-6 sm:px-8 lg:px-12 py-10 flex flex-col ${isCenter ? "items-center text-center max-w-2xl mx-auto" : "items-start max-w-2xl"}`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
          style={{ background: "rgba(194,241,53,0.08)", border: "1px solid rgba(194,241,53,0.22)" }}>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(194,241,53,0.85)" }}>{badge}</span>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-text-primary leading-tight mb-3">
          {title}
          {titleHighlight && (
            <><br className="hidden sm:block" /><span className="text-gradient-gold">{titleHighlight}</span></>
          )}
        </h1>

        <p className="text-text-secondary text-sm sm:text-base leading-relaxed mb-6 max-w-xl">
          {description}
        </p>

        {stats && stats.length > 0 && (
          <div className="flex items-center gap-6 mb-6">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-5">
                <div>
                  <div className="text-xl font-bold text-text-primary font-display">{s.value}</div>
                  <div className="text-[11px] text-text-muted uppercase tracking-widest">{s.label}</div>
                </div>
                {i < stats.length - 1 && <span className="text-border text-lg">·</span>}
              </div>
            ))}
          </div>
        )}

        {(cta || ctaSecondary) && (
          <div className="flex flex-wrap gap-3">
            {cta && (
              <Link href={cta.href}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm">
                {cta.label} <ArrowRight size={14} />
              </Link>
            )}
            {ctaSecondary && (
              <Link href={ctaSecondary.href}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-text-secondary font-semibold rounded-xl hover:border-gold/40 hover:text-gold transition-all text-sm">
                {ctaSecondary.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
