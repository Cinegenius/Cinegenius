import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Metadata } from "next";
import Link from "next/link";
import { Film, Calendar, Users, User, ArrowLeft, Clapperboard } from "lucide-react";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

const TYPE_COLORS: Record<string, string> = {
  Spielfilm:     "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Kurzfilm:      "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Serie:         "bg-green-500/15 text-green-300 border-green-500/30",
  Dokumentation: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Werbefilm:     "bg-pink-500/15 text-pink-300 border-pink-500/30",
  Musikvideo:    "bg-red-500/15 text-red-300 border-red-500/30",
  Corporate:     "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

async function getProject(slug: string) {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", slug)
    .single();
  return data ?? null;
}

async function getCredits(projectId: string) {
  const { data } = await supabaseAdmin
    .from("project_credits")
    .select("id, role, user_id, profiles(display_name, avatar_url, slug)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return {};
  return {
    title: `${project.title}${project.year ? ` (${project.year})` : ""} | CineGenius`,
    description: project.synopsis ?? `${project.type ?? "Filmprojekt"} — ${project.director ? `Regie: ${project.director}` : ""}`,
    openGraph: {
      title: project.title,
      images: project.poster_url ? [{ url: project.poster_url }] : [],
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [project, credits] = await Promise.all([
    getProject(slug),
    getCredits(slug),
  ]);
  if (!project) notFound();

  const typeColor = TYPE_COLORS[project.type] ?? "bg-bg-elevated border-border text-text-muted";

  return (
    <div className="pt-16 min-h-screen">
      {/* Hero */}
      <div className="relative bg-bg-secondary border-b border-border">
        {project.poster_url && (
          <div className="absolute inset-0 overflow-hidden opacity-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.poster_url} alt="" className="w-full h-full object-cover blur-2xl scale-110" />
          </div>
        )}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors mb-6">
            <ArrowLeft size={13} /> Alle Projekte
          </Link>

          <div className="flex flex-col sm:flex-row gap-8">
            {/* Poster */}
            <div className="shrink-0">
              {project.poster_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.poster_url}
                  alt={project.title}
                  className="w-36 h-52 sm:w-44 sm:h-64 object-cover rounded-xl border border-border shadow-xl"
                />
              ) : (
                <div className="w-36 h-52 sm:w-44 sm:h-64 rounded-xl border border-border bg-bg-elevated flex items-center justify-center">
                  <Clapperboard size={32} className="text-text-muted opacity-30" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {project.type && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border mb-3 ${typeColor}`}>
                  {project.type}
                </span>
              )}
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-2 leading-tight">
                {project.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted mb-4">
                {project.year && (
                  <span className="flex items-center gap-1.5"><Calendar size={13} /> {project.year}</span>
                )}
                {project.director && (
                  <span className="flex items-center gap-1.5"><Film size={13} /> Regie: {project.director}</span>
                )}
                {credits.length > 0 && (
                  <span className="flex items-center gap-1.5"><Users size={13} /> {credits.length} Crew-Mitglieder</span>
                )}
              </div>
              {project.synopsis && (
                <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">{project.synopsis}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Credits */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {credits.length > 0 ? (
          <>
            <h2 className="font-display text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
              <Users size={18} className="text-gold" /> Crew & Cast
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {credits.map((credit) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const profile = (credit as any).profiles as { display_name: string | null; avatar_url: string | null; slug: string | null } | null;
                const name = profile?.display_name ?? "Unbekannt";
                const href = profile?.slug ? `/profile/${profile.slug}` : credit.user_id ? `/profile/${credit.user_id}` : null;

                const card = (
                  <div className="flex flex-col items-center text-center gap-2 p-4 bg-bg-secondary border border-border rounded-xl hover:border-gold/40 transition-colors group">
                    <div className="w-14 h-14 rounded-full border border-border bg-bg-elevated flex items-center justify-center overflow-hidden shrink-0">
                      {profile?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform" />
                      ) : (
                        <User size={20} className="text-text-muted" />
                      )}
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-xs font-semibold text-text-primary truncate group-hover:text-gold transition-colors">{name}</p>
                      {credit.role && <p className="text-[10px] text-text-muted truncate mt-0.5">{credit.role}</p>}
                    </div>
                  </div>
                );

                return href ? (
                  <Link key={credit.id} href={href}>{card}</Link>
                ) : (
                  <div key={credit.id}>{card}</div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mx-auto mb-4">
              <Users size={22} className="text-text-muted opacity-40" />
            </div>
            <p className="text-sm text-text-secondary font-medium mb-1">Noch keine Crew eingetragen</p>
            <p className="text-xs text-text-muted">Crew-Mitglieder können sich selbst zu Projekten hinzufügen.</p>
          </div>
        )}
      </div>
    </div>
  );
}
