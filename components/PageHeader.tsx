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
};

const GRAIN = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function PageHeader({
  badge, title, titleHighlight, description, cta, ctaSecondary,
}: Props) {
  return (
    <div className="pt-16 relative overflow-hidden bg-bg-primary">
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-bg-elevated/70 via-bg-primary to-bg-primary pointer-events-none" />

      {/* Gold radial glow — top right */}
      <div className="absolute -top-24 -right-24 w-[560px] h-[440px] rounded-full blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-gold) 8%, transparent), transparent 70%)" }} />

      {/* Secondary glow — bottom left */}
      <div className="absolute bottom-0 left-1/3 w-72 h-48 rounded-full blur-2xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-gold) 4%, transparent), transparent 70%)" }} />

      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.045] pointer-events-none"
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
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-8 pb-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-bg-elevated/80 border border-gold/20 rounded-full mb-3">
              <span className="text-[11px] text-gold/80 font-bold uppercase tracking-widest">{badge}</span>
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
