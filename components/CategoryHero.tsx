import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = {
  badge: string;
  title: string;
  titleHighlight?: string;
  description: string;
  image: string;
  imagePosition?: string;
  cta?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  stats?: { value: string; label: string }[];
  overlay?: "left" | "center" | "bottom";
  height?: "sm" | "md" | "lg";
};

const heights = {
  sm: "h-[300px]",
  md: "h-[380px]",
  lg: "h-[460px]",
};

const overlayGradients = {
  left:   "bg-gradient-to-r from-black/80 via-black/40 to-transparent",
  center: "bg-gradient-to-b from-black/40 via-black/50 to-black/80",
  bottom: "bg-gradient-to-t from-black/85 via-black/30 to-black/15",
};

const contentAlign = {
  left:   "items-start text-left max-w-2xl",
  center: "items-center text-center max-w-2xl mx-auto",
  bottom: "items-start text-left max-w-2xl justify-end pb-10",
};

export default function CategoryHero({
  badge,
  title,
  titleHighlight,
  description,
  image,
  imagePosition = "center center",
  cta,
  ctaSecondary,
  stats,
  overlay = "left",
  height = "md",
}: Props) {
  return (
    <>
      {/* ── Mobile: compact app-style header, no image ── */}
      <div className="sm:hidden relative overflow-hidden" style={{ paddingTop: "64px" }}>
        {/* Image as faint texture */}
        <Image
          src={image}
          alt=""
          fill
          priority
          unoptimized
          className="object-cover"
          style={{ objectPosition: imagePosition }}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-bg-primary/65" />
        {/* Gold left accent line */}
        <div className="absolute top-0 left-0 bottom-0 w-[3px] bg-gradient-to-b from-gold/80 via-gold/30 to-transparent" />

        <div className="relative z-10 px-4 pt-4 pb-5 border-b border-border/60">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold/80 mb-1.5">
            {badge}
          </p>
          <h1 className="font-display text-[22px] font-bold text-text-primary leading-snug">
            {title}
            {titleHighlight && (
              <> <span className="text-gradient-gold">{titleHighlight}</span></>
            )}
          </h1>
          {cta && (
            <Link
              href={cta.href}
              className="inline-flex items-center gap-1 mt-2.5 text-xs font-semibold text-gold/70 hover:text-gold transition-colors"
            >
              {cta.label} <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>

      {/* ── Desktop: full cinematic hero ── */}
      <div className={`hidden sm:flex relative overflow-hidden ${heights[height]} items-center`}>
        <Image
          src={image}
          alt={title}
          fill
          priority
          unoptimized
          className="object-cover"
          style={{ objectPosition: imagePosition }}
          sizes="100vw"
        />
        <div className={`absolute inset-0 ${overlayGradients[overlay]}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div
          className="grain absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
        />

        <div className={`relative z-10 w-full px-8 lg:px-12 flex flex-col ${contentAlign[overlay]}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/12 backdrop-blur-sm border border-white/20 rounded-full mb-4">
            <span className="text-[11px] text-white/90 font-bold uppercase tracking-widest">{badge}</span>
          </div>

          <h1 className="font-display text-4xl lg:text-5xl font-bold text-white leading-tight mb-3">
            {title}
            {titleHighlight && (
              <><br /><span className="text-gradient-gold">{titleHighlight}</span></>
            )}
          </h1>

          <p className="text-white/65 text-base leading-relaxed mb-5 max-w-xl">
            {description}
          </p>

          {stats && stats.length > 0 && (
            <div className="flex items-center gap-6 mb-6">
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-5">
                  <div>
                    <div className="text-xl font-bold text-white font-display">{s.value}</div>
                    <div className="text-[11px] text-white/50 uppercase tracking-widest">{s.label}</div>
                  </div>
                  {i < stats.length - 1 && <span className="text-white/20 text-lg">·</span>}
                </div>
              ))}
            </div>
          )}

          {(cta || ctaSecondary) && (
            <div className="flex flex-wrap gap-3">
              {cta && (
                <Link
                  href={cta.href}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
                >
                  {cta.label} <ArrowRight size={14} />
                </Link>
              )}
              {ctaSecondary && (
                <Link
                  href={ctaSecondary.href}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/25 text-white/85 font-semibold rounded-xl hover:border-white/50 hover:text-white transition-all text-sm"
                >
                  {ctaSecondary.label}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
