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
};

export default function PageHeader({
  badge, title, titleHighlight, description,
  image, imagePosition = "center center",
  cta, ctaSecondary,
}: Props) {
  return (
    <div className="pt-16 relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={image} alt="" fill unoptimized priority
          className="object-cover opacity-20"
          style={{ objectPosition: imagePosition }}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/60 via-bg-primary/40 to-bg-primary/90" />
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-8 pb-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full mb-3">
              <span className="text-[11px] text-white/80 font-bold uppercase tracking-widest">{badge}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mb-2">
              {title}
              {titleHighlight && (
                <> <span className="text-gradient-gold">{titleHighlight}</span></>
              )}
            </h1>
            <p className="text-white/60 text-sm sm:text-base leading-relaxed max-w-xl">{description}</p>
          </div>

          {(cta || ctaSecondary) && (
            <div className="flex items-center gap-2 shrink-0">
              {ctaSecondary && (
                <Link
                  href={ctaSecondary.href}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-white/20 text-white/70 rounded-xl hover:border-white/40 hover:text-white transition-all text-sm whitespace-nowrap backdrop-blur-sm"
                >
                  {ctaSecondary.label} <ArrowRight size={13} />
                </Link>
              )}
              {cta && (
                <Link
                  href={cta.href}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm whitespace-nowrap"
                >
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
