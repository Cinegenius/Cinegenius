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
  sm: "h-[260px] sm:h-[300px]",
  md: "h-[320px] sm:h-[400px]",
  lg: "h-[400px] sm:h-[520px]",
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
    <div className={`relative overflow-hidden ${heights[height]} flex items-center`}>
      {/* Background image */}
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

      {/* Cinematic gradient overlay */}
      <div className={`absolute inset-0 ${overlayGradients[overlay]}`} />
      {/* Always-on bottom fade for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      {/* Grain texture — animated cinematic feel */}
      <div
        className="grain absolute inset-0 opacity-[0.08] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      {/* Content */}
      <div className={`relative z-10 w-full px-4 sm:px-8 lg:px-12 flex flex-col ${contentAlign[overlay]}`}>
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/12 backdrop-blur-sm border border-white/20 rounded-full mb-4">
          <span className="text-[11px] text-white/90 font-bold uppercase tracking-widest">{badge}</span>
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-3">
          {title}
          {titleHighlight && (
            <><br /><span className="text-gradient-gold">{titleHighlight}</span></>
          )}
        </h1>

        {/* Description */}
        <p className="text-white/65 text-sm sm:text-base leading-relaxed mb-5 max-w-xl">
          {description}
        </p>

        {/* Stats */}
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

        {/* CTAs */}
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
  );
}
