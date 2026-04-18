import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clapperboard } from "lucide-react";

export interface CategoryConfig {
  slug: string;
  label: string;
  headline: string;
  highlight: string;
  description: string;
  image: string;
  imagePosition?: string;
  typeKeywords: string[]; // matched against project.type (case-insensitive includes)
  badge: string;
}

const TYPE_COLORS: Record<string, string> = {
  spielfilm:     "bg-purple-500/15 text-purple-300 border-purple-500/30",
  kurzfilm:      "bg-blue-500/15 text-blue-300 border-blue-500/30",
  serie:         "bg-green-500/15 text-green-300 border-green-500/30",
  dokumentation: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  werbefilm:     "bg-pink-500/15 text-pink-300 border-pink-500/30",
  musikvideo:    "bg-red-500/15 text-red-300 border-red-500/30",
  corporate:     "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  foto:          "bg-sky-500/15 text-sky-300 border-sky-500/30",
  event:         "bg-orange-500/15 text-orange-300 border-orange-500/30",
  social:        "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

function typeColor(type: string): string {
  const key = type.toLowerCase().split(/[\s/]/)[0];
  return TYPE_COLORS[key] ?? "bg-bg-elevated text-text-secondary border-border";
}

export default async function ProjectCategoryPage({ config }: { config: CategoryConfig }) {
  const { data: allProjects } = await supabaseAdmin
    .from("projects")
    .select("id, title, year, type, director, poster_url")
    .order("year", { ascending: false })
    .limit(300);

  const projects = (allProjects ?? []).filter((p: { type: string | null }) =>
    config.typeKeywords.some((kw) =>
      (p.type ?? "").toLowerCase().includes(kw.toLowerCase())
    )
  );

  return (
    <div className="pt-16 min-h-screen bg-bg-primary">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden h-[300px] sm:h-[380px] flex items-center">
        <Image
          src={config.image}
          alt={config.label}
          fill
          priority
          unoptimized
          className="object-cover"
          style={{ objectPosition: config.imagePosition ?? "center center" }}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="relative z-10 w-full px-4 sm:px-8 lg:px-12">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs mb-5 transition-colors"
          >
            <ArrowLeft size={12} /> Alle Projekte
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/12 backdrop-blur-sm border border-white/20 rounded-full mb-4">
            <span className="text-[11px] text-white/90 font-bold uppercase tracking-widest">{config.badge}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-white leading-tight mb-3">
            {config.headline}<br />
            <span className="text-gradient-gold">{config.highlight}</span>
          </h1>
          <p className="text-white/65 text-sm sm:text-base max-w-xl leading-relaxed">
            {config.description}
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Back + count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text-primary">{projects.length}</span> Projekt{projects.length !== 1 ? "e" : ""}
          </p>
          <Link
            href="/dashboard/projects/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-xs"
          >
            + Projekt eintragen
          </Link>
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {projects.map((p: { id: string; title: string; year: number | null; type: string | null; director: string | null; poster_url: string | null }) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group card-hover rounded-xl overflow-hidden border border-border bg-bg-elevated block"
              >
                <div className="relative aspect-[2/3] overflow-hidden">
                  {p.poster_url ? (
                    <Image
                      src={p.poster_url}
                      alt={p.title}
                      fill
                      className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width:640px) 50vw,(max-width:1024px) 25vw,16vw"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-bg-secondary flex items-center justify-center">
                      <Clapperboard size={28} className="text-text-muted/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-[11px] text-white font-semibold leading-tight line-clamp-2">{p.title}</p>
                    {p.year && <p className="text-[10px] text-white/55 mt-0.5">{p.year}</p>}
                  </div>
                </div>
                {p.type && (
                  <div className="px-2 py-1.5">
                    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${typeColor(p.type)}`}>
                      {p.type}
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-5">
              <Clapperboard size={24} className="text-gold" />
            </div>
            <h2 className="font-display text-2xl font-bold text-text-primary mb-3">
              Noch keine {config.label}-Projekte
            </h2>
            <p className="text-text-muted mb-7 max-w-md mx-auto">
              Sei der Erste — trag dein Projekt ein und zeig der Community deine Arbeit.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard/projects/new"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
              >
                Projekt eintragen <ArrowRight size={14} />
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 px-6 py-3 border border-border text-text-secondary rounded-xl hover:border-gold/40 hover:text-gold transition-all text-sm"
              >
                Alle Projekte ansehen
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
