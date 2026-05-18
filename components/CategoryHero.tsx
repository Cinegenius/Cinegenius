import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = {
  badge: string;
  title: string;
  titleHighlight?: string;
  description: string;
  /** RGB values for the accent glow, e.g. "99,102,241". Defaults to lime. */
  accentRgb?: string;
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

const GRAIN = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const LIME = "194,241,53";
const heights = { sm: "min-h-[220px]", md: "min-h-[280px]", lg: "min-h-[340px]" };

export default function CategoryHero({
  badge, title, titleHighlight, description,
  accentRgb = LIME,
  cta, ctaSecondary, stats,
  overlay = "left", height = "md",
}: Props) {
  const isCenter = overlay === "center";
  const g = (a: number) => `rgba(${accentRgb},${a})`;

  return (
    <div
      className={`pt-16 relative overflow-hidden flex items-center ${heights[height]}`}
      style={{ background: "linear-gradient(135deg, #1a1d26 0%, #0E1016 60%)" }}
    >
      {/* Main glow — top right */}
      <div className="absolute -top-16 -right-16 w-[650px] h-[520px] rounded-full blur-[110px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${g(0.40)}, transparent 70%)` }} />

      {/* Film grain */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: GRAIN }} />

      {/* Content */}
      <div className={`relative z-10 w-full px-6 sm:px-8 lg:px-12 py-6 flex flex-col ${isCenter ? "items-center text-center max-w-2xl mx-auto" : "items-start max-w-5xl"}`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
          style={{ background: g(0.10), border: `1px solid ${g(0.35)}` }}>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: g(1) }}>{badge}</span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-text-primary leading-tight mb-2">
          {title}
          {titleHighlight && (
            <> <span className="text-gradient-gold">{titleHighlight}</span></>
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
