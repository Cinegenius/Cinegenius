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
};

const GRAIN = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const LIME = "194,241,53";

export default function PageHeader({
  badge, title, titleHighlight, description,
  accentRgb = LIME,
  cta, ctaSecondary,
}: Props) {
  const g = (a: number) => `rgba(${accentRgb},${a})`;

  return (
    <div className="pt-16 relative">

      {/* Main glow — top right */}
      <div className="absolute -top-16 -right-16 w-[600px] h-[480px] rounded-full blur-[100px] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${g(0.40)}, transparent 70%)` }} />

      {/* Film grain */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: GRAIN }} />

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-4 pb-5 sm:pt-8 sm:pb-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
              style={{ background: g(0.10), border: `1px solid ${g(0.35)}` }}>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: g(1) }}>{badge}</span>
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
