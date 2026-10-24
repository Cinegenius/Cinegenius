import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { isAdminSession } from "@/lib/guards";
import ProjectDetail from "@/components/ProjectDetail";
import { departments } from "@/lib/departments";
import { getProjectRecord } from "@/lib/project-records-server";
import { toPublicProjectRecord } from "@/lib/project-record";

const ALL_CREW_ROLES = departments.flatMap((d) => d.roles);

export const dynamicParams = true;

type RawCredit = {
  id: string;
  user_id: string | null;
  role: string;
  created_at: string;
};

async function _getProject(id: string) {
  const projectResult = await getProjectRecord(id);
  if (projectResult.kind === "not_found") return null;
  if (projectResult.kind === "error") {
    throw new Error(`Projekt konnte nicht geladen werden (Datenbankfehler ${projectResult.error.code ?? "unbekannt"}).`);
  }

  const project = projectResult.project;
  const [{ data: credits }, { data: festivals }] = await Promise.all([
    db.from("project_credits").select("id, project_id, user_id, role, created_at").eq("project_id", id).order("created_at", { ascending: true }),
    db.from("project_festivals").select("id, project_id, festival_name, year, section, status, award_name, notes").eq("project_id", id).order("year", { ascending: false }),
  ]);

  const rawCredits = (credits ?? []) as RawCredit[];

  const userIds = rawCredits.filter((c) => c.user_id).map((c) => c.user_id as string);

  const profilesMap = userIds.length > 0
      ? await db.from("profiles").select("user_id, display_name, avatar_url, role, slug").in("user_id", userIds).then(
          ({ data }) => Object.fromEntries(
            (data ?? []).map((p: { user_id: string; display_name: string; avatar_url: string | null; role: string | null; slug: string | null }) => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url, role: p.role, slug: p.slug }])
          )
        )
      : {} as Record<string, { display_name: string; avatar_url: string | null; role: string | null; slug: string | null }>;

  const creditsWithProfiles = rawCredits.map((c) => ({
    ...c,
    profile: c.user_id ? (profilesMap[c.user_id] ?? null) : null,
    ghost: null,
  }));

  return { project, credits: creditsWithProfiles, festivals: festivals ?? [] };
}

const getProject = unstable_cache(_getProject, ["project-id"], { revalidate: 300, tags: ["projects"] });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getProject(id);
  if (!data) return {};
  const { project } = data;
  return {
    title: `${project.title} (${project.year ?? "—"}) — CineGenius`,
    description: project.description ?? `${project.type ?? "Film"} · ${project.year ?? ""}`,
    openGraph: {
      title: project.title,
      description: project.description ?? "",
      images: project.poster_url ? [{ url: project.poster_url }] : [],
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getProject(id);
  if (!data) notFound();

  const [{ userId }, isAdmin] = await Promise.all([auth(), isAdminSession()]);
  const myRawCredit = data.credits.find((c) => c.user_id && c.user_id === userId) ?? null;
  const projectCreatorId = data.project.created_by as string | null;
  const publicProject = toPublicProjectRecord(data.project);
  const publicCredits = data.credits.map((credit) => ({
    id: credit.id,
    role: credit.role,
    created_at: credit.created_at,
    isCurrentUser: Boolean(userId && credit.user_id === userId),
    profile: credit.profile,
    ghost: credit.ghost,
  }));
  const myCredit = myRawCredit ? publicCredits.find((credit) => credit.id === myRawCredit.id) ?? null : null;

  let userPositions: string[] = [];
  let userProfile: { display_name: string | null; avatar_url: string | null } | null = null;
  if (userId) {
    const { data: prof } = await db
      .from("profiles")
      .select("positions, display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();
    userPositions = (prof?.positions as string[] | null) ?? [];
    if (prof) userProfile = { display_name: prof.display_name ?? null, avatar_url: prof.avatar_url ?? null };
  }

  // If user has positions, show them first, then remaining roles; otherwise full list
  const roleOptions = [...new Set([...userPositions, ...ALL_CREW_ROLES])];

  return (
    <ProjectDetail
      project={publicProject}
      credits={publicCredits}
      festivals={data.festivals}
      currentUserId={userId ?? null}
      initialIsCreator={Boolean(userId && projectCreatorId === userId)}
      myCredit={myCredit}
      userPositions={roleOptions}
      userProfile={userProfile}
      isAdmin={isAdmin}
    />
  );
}
