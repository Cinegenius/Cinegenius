"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film, Camera, Building2, TrendingUp, ArrowRight } from "lucide-react";

const FALLBACKS = {
  film: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&q=80",
  freelance: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80",
  company: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  location: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
};

function pick(pool: string[], fallback: string): string {
  if (pool.length === 0) return fallback;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface Props {
  pools: {
    film: string[];
    freelance: string[];
    company: string[];
    location: string[];
  };
  isLoggedIn: boolean;
  labels: {
    filmTitle: string; filmDesc: string; filmCta: string;
    freelanceTitle: string; freelanceDesc: string; freelanceCta: string; ctaDashboard: string;
    companyTitle: string; companyDesc: string; companyCta: string;
    passiveTitle: string; passiveDesc: string; passiveCta: string;
  };
}

export default function AudienceCards({ pools, isLoggedIn, labels }: Props) {
  const images = useMemo(() => ({
    film: pick(pools.film, FALLBACKS.film),
    freelance: pick(pools.freelance, FALLBACKS.freelance),
    company: pick(pools.company, FALLBACKS.company),
    location: pick(pools.location, FALLBACKS.location),
  }), []);  // eslint-disable-line react-hooks/exhaustive-deps

  const ctaHref = isLoggedIn ? "/dashboard" : "/sign-up";

  const cards = [
    {
      icon: Film,
      title: labels.filmTitle,
      desc: labels.filmDesc,
      cta: labels.filmCta,
      href: "/marketplace",
      image: images.film,
      accent: "#c8f135",
    },
    {
      icon: Camera,
      title: labels.freelanceTitle,
      desc: labels.freelanceDesc,
      cta: isLoggedIn ? labels.ctaDashboard : labels.freelanceCta,
      href: ctaHref,
      image: images.freelance,
      accent: "#60a5fa",
    },
    {
      icon: Building2,
      title: labels.companyTitle,
      desc: labels.companyDesc,
      cta: labels.companyCta,
      href: isLoggedIn ? "/company-setup" : "/sign-up?redirect=/company-setup",
      image: images.company,
      accent: "#f59e0b",
    },
    {
      icon: TrendingUp,
      title: labels.passiveTitle,
      desc: labels.passiveDesc,
      cta: labels.passiveCta,
      href: isLoggedIn ? "/inserat" : "/sign-up?redirect=/inserat",
      image: images.location,
      accent: "#c8f135",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {cards.map(({ icon: Icon, title, desc, cta, href, image, accent }) => (
        <Link key={title} href={href}
          className="group relative rounded-xl lg:rounded-2xl overflow-hidden aspect-[3/4] lg:aspect-[3/4] block">
          <Image src={image} alt={title} fill unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            sizes="(max-width:640px) 50vw,25vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: `linear-gradient(to top, ${accent}40, transparent 60%)` }}
          />
          <div
            className="absolute top-3 left-3 w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/10"
            style={{ backgroundColor: `${accent}25` }}
          >
            <Icon size={14} style={{ color: accent }} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 lg:p-4">
            <h3 className="font-display text-sm lg:text-base font-bold text-white leading-tight mb-1">{title}</h3>
            <p className="text-white/60 text-[11px] leading-snug hidden sm:block mb-2">{desc}</p>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: accent }}>
              {cta} <ArrowRight size={10} />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
