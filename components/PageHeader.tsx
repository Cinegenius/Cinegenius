import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export const PROJECTS_BACKDROP_IMAGE =
  "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=1740&auto=format&fit=crop";

type PageBackdropProps = {
  image?: string;
  imagePosition?: string;
  imageOpacity?: number;
  overlayClassName?: string;
  className?: string;
};

/** Shared cinematic backdrop treatment used by the Projects reference and page heroes. */
export function PageBackdrop({
  image = PROJECTS_BACKDROP_IMAGE,
  imagePosition = "center 42%",
  imageOpacity = 20,
  overlayClassName = "absolute inset-0 bg-gradient-to-b from-bg-primary/60 via-bg-primary/40 to-bg-primary/80",
  className = "absolute inset-0 z-0",
}: PageBackdropProps) {
  return (
    <div aria-hidden="true" className={`pointer-events-none overflow-hidden ${className}`}>
      <Image
        src={image}
        alt=""
        fill
        unoptimized
        priority
        className="object-cover"
        style={{ objectPosition: imagePosition, opacity: imageOpacity / 100 }}
      />
      <div className={overlayClassName} />
    </div>
  );
}

type PageHeaderProps = {
  badge: string;
  title: string;
  titleHighlight?: string;
  description: string;
  image?: string;
  imagePosition?: string;
  /** Turn off when a parent page already extends PageBackdrop behind its full content. */
  withBackdrop?: boolean;
  cta?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  children?: ReactNode;
};

export default function PageHeader({
  badge,
  title,
  titleHighlight,
  description,
  image = PROJECTS_BACKDROP_IMAGE,
  imagePosition = "center 42%",
  withBackdrop = true,
  cta,
  ctaSecondary,
  children,
}: PageHeaderProps) {
  return (
    <section className="site-page-hero relative isolate overflow-hidden border-b border-border/40 pt-16">
      {withBackdrop && <PageBackdrop image={image} imagePosition={imagePosition} />}

      <div className="site-container relative z-10 py-4 sm:py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-sm">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/80">{badge}</span>
            </div>
            <h1 className="mb-1.5 font-display text-xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
              {title}{titleHighlight && <> <span className="text-gradient-gold">{titleHighlight}</span></>}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">{description}</p>
          </div>

          {(cta || ctaSecondary) && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {ctaSecondary && (
                <Link
                  href={ctaSecondary.href}
                  className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/75 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
                >
                  {ctaSecondary.label} <ArrowRight size={13} />
                </Link>
              )}
              {cta && (
                <Link
                  href={cta.href}
                  className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-bg-primary transition hover:bg-gold-light"
                >
                  {cta.label} <ArrowRight size={13} />
                </Link>
              )}
            </div>
          )}
        </div>

        {children && <div className="mt-5">{children}</div>}
      </div>
    </section>
  );
}
