import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = {
  badge: string;
  title: string;
  titleHighlight?: string;
  description: string;
  /** @deprecated kept for backwards compat — image no longer rendered */
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

const heights = { sm: "min-h-[220px]", md: "min-h-[280px]", lg: "min-h-[340px]" };

export default function CategoryHero({
  badge, title, titleHighlight, description,
  cta, ctaSecondary, stats,
  overlay = "left", height = "md",
}: Props) {
  const isCenter = overlay === "center";

  return (
    <div className={`pt-16 relative overflow-hidden bg-bg-primary flex items-center ${heights[height]}`}>
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-bg-elevated/70 via-bg-primary to-bg-primary pointer-events-none" />

      {/* Gold radial glow — top right */}
      <div className="absolute -top-20 -right-16 w-[600px] h-[480px] rounded-full blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-gold) 9%, transparent), transparent 70%)" }} />

      {/* Secondary glow — bottom left */}
      <div className="absolute -bottom-8 left-1/4 w-80 h-56 rounded-full blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-gold) 5%, transparent), transparent 70%)" }} />

      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, var(--color-gold) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

      {/* Grain */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none" style={{ backgroundImage: GRAIN }} />

      {/* Left gold accent */}
      <div className="absolute top-0 left-0 bottom-0 w-[3px] pointer-events-none"
        style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--color-gold) 55%, transparent), color-mix(in srgb, var(--color-gold) 15%, transparent) 60%, transparent)" }} />

      {/* Bottom edge */}
      <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, color-mix(in srgb, var(--color-gold) 18%, transparent) 40%, color-mix(in srgb, var(--color-gold) 18%, transparent) 60%, transparent)" }} />

      {/* Content */}
      <div className={`relative z-10 w-full px-6 sm:px-8 lg:px-12 py-10 flex flex-col ${isCenter ? "items-center text-center max-w-2xl mx-auto" : "items-start max-w-2xl"}`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-bg-elevated/80 border border-gold/20 rounded-full mb-4">
          <span className="text-[11px] text-gold/80 font-bold uppercase tracking-widest">{badge}</span>
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
