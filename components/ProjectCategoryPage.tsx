import { projectTypeLabel } from "@/lib/project-type-labels";
import { publicProjectMedia } from "@/lib/project-media-rights";
import { db } from "@/lib/db";
import Image from "@/components/MediaImage";
import DirectoryPage from "@/components/DirectoryPage";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clapperboard } from "lucide-react";
import { getTranslations } from "next-intl/server";


export interface CategoryConfig {
  slug: string;
  label: string;
  headline: string;
  highlight: string;
  description: string;
  image: string;
  imagePosition?: string;
  typeKeywords: string[]; // exact case-insensitive match against project.type
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
  const uiText = await getTranslations();

  const { data: allProjects } = await db
    .from("projects")
    .select("id, title, year, type, director, poster_url, metadata, created_by")
    .order("year", { ascending: false })
    .limit(300);

  const projects = (allProjects ?? []).map(project => publicProjectMedia(project)).filter((p: { type: string | null }) =>
    config.typeKeywords.some((kw) =>
      (p.type ?? "").toLowerCase() === kw.toLowerCase()
    )
  );

  return (
    <DirectoryPage area="projects">
      {/* ── Scrollable content ── */}
      <div className="relative z-10 pt-16">

        {/* ── Compact header ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-xs mb-6 transition-colors"
          >{uiText.rich("Ui.text_6537e36e485dda", { part1: () => (<ArrowLeft size={12} />) })}</Link>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full mb-3">
                <span className="text-[11px] text-white/80 font-bold uppercase tracking-widest">{config.badge}</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight mb-1.5">
                {config.headline} <span className="text-gradient-gold">{config.highlight}</span>
              </h1>
              <p className="text-white/55 text-sm max-w-xl leading-relaxed">
                {config.description}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">{uiText.rich("Ui.text_dc6bd1687db934", { value3: () => (projects.length), part2: chunks => (<span className="font-semibold text-white/70">{chunks}</span>), count4: projects.length, part1: chunks => (<span className="text-sm text-white/40">{chunks}</span>), part5: chunks => (<Link
                href="/projects/neu"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-xs whitespace-nowrap"
              >{chunks}</Link>) })}</div>
          </div>
        </div>

        {/* ── Projects grid ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
          {projects.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {projects.map((p: { id: string; title: string; year: number | null; type: string | null; director: string | null; poster_url: string | null }) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group rounded-xl overflow-hidden border border-white/8 bg-black/30 backdrop-blur-sm hover:border-white/20 hover:bg-black/45 transition-all block"
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
                      <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                        <Clapperboard size={28} className="text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <p className="text-[11px] text-white font-semibold leading-tight line-clamp-2">{p.title}</p>
                      {p.year && <p className="text-[10px] text-white/50 mt-0.5">{p.year}</p>}
                    </div>
                  </div>
                  {p.type && (
                    <div className="px-2 py-1.5">
                      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border ${typeColor(p.type)}`}>
                        {projectTypeLabel(p.type, uiText)}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-24">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center mx-auto mb-5">
                <Clapperboard size={24} className="text-white/60" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white mb-3">{uiText.rich("Ui.text_1f502a70f7ce2f", { value1: () => (config.label) })}</h2>
              <p className="text-white/50 mb-7 max-w-md mx-auto">{uiText("Ui.text_f2ffc93ee4cd77")}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">{uiText.rich("Ui.text_d9ee49dbf180cb", { part2: () => (<ArrowRight size={14} />), part1: chunks => (<Link
                  href="/projects/neu"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors text-sm"
                >{chunks}</Link>), part3: chunks => (<Link
                  href="/projects"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 text-white/70 rounded-xl hover:border-white/40 hover:text-white transition-all text-sm"
                >{chunks}</Link>) })}</div>
            </div>
          )}
        </div>
      </div>
    </DirectoryPage>
  );
}
