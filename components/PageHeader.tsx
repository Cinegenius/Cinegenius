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
};

// #C2F135 = Electric Lime (--color-gold)
const LIME_18  = "rgba(194,241,53,0.18)";
const LIME_09  = "rgba(194,241,53,0.09)";
const LIME_DOT = "rgba(194,241,53,0.10)";
const GRAIN    = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function PageHeader({
  badge, title, titleHighlight, description, cta, ctaSecondary,
}: Props) {
  return (
    <div className="pt-16 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1d26 0%, #0E1016 60%)" }}>

      {/* Lime glow — top right */}
      <div className="absolute -top-16 -right-16 w-[600px] h-[480px] rounded-full blur-[90px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${LIME_18}, transparent 70%)` }} />

      {/* Accent glow — bottom left */}
      <div className="absolute -bottom-10 left-1/3 w-72 h-52 rounded-full blur-[60px] pointer-events-none"
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
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-8 pb-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
              style={{ background: "rgba(194,241,53,0.08)", border: "1px solid rgba(194,241,53,0.22)" }}>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(194,241,53,0.85)" }}>{badge}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-text-primary leading-tight mb-2">
              {title}
              {titleHighlight && <> <span className="text-gradient-gold">{titleHighlight}</span></>}
            </h1>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed max-w-xl">{description}</p>
          </div>

          {(cta || ctaSecondary) && (
            <div className="flex items-center gap-2 shrink-0">
              {ctaSecondary && (
                <Link href={ctaSecondary.href}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:border-gold/40 hover:text-gold transition-all text-sm whitespace-nowrap">
                  {ctaSecondary.label} <ArrowRight size={13} />
                </Link>
              )}
              {cta && (
                <Link href={cta.href}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm whitespace-nowrap">
                  {cta.label} <ArrowRight size={13} />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
