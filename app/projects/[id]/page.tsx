import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { isAdminSession } from "@/lib/guards";
import ProjectDetail from "@/components/ProjectDetail";
import { departments } from "@/lib/departments";

const ALL_CREW_ROLES = departments.flatMap((d) => d.roles);

export const dynamic = "force-dynamic";
export const dynamicParams = true;

type RawCredit = {
  id: string;
  user_id: string | null;
  unclaimed_profile_id: string | null;
  role: string;
  created_at: string;
};

async function _getProject(id: string) {
  const [{ data: project }, { data: credits }, { data: festivals }] = await Promise.all([
    db.from("projects").select("*").eq("id", id).single(),
    db.from("project_credits").select("id, user_id, unclaimed_profile_id, role, created_at").eq("project_id", id).order("created_at", { ascending: true }),
    db.from("project_festivals").select("*").eq("project_id", id).order("year", { ascending: false }),
  ]);

  if (!project) return null;

  const rawCredits = (credits ?? []) as RawCredit[];

  const userIds = rawCredits.filter((c) => c.user_id).map((c) => c.user_id as string);
  const unclaimedIds = rawCredits.filter((c) => c.unclaimed_profile_id).map((c) => c.unclaimed_profile_id as string);

  const [profilesMap, ghostsMap] = await Promise.all([
    userIds.length > 0
      ? db.from("profiles").select("user_id, display_name, avatar_url, role").in("user_id", userIds).then(
          ({ data }) => Object.fromEntries(
            (data ?? []).map((p: { user_id: string; display_name: string; avatar_url: string | null; role: string | null }) => [p.user_id, p])
          )
        )
      : Promise.resolve({} as Record<string, { display_name: string; avatar_url: string | null; role: string | null }>),
    unclaimedIds.length > 0
      ? db.from("unclaimed_profiles").select("id, name, slug, avatar_url, primary_role").in("id", unclaimedIds).then(
          ({ data }) => Object.fromEntries(
            (data ?? []).map((p: { id: string; name: string; slug: string; avatar_url: string | null; primary_role: string | null }) => [p.id, p])
          )
        )
      : Promise.resolve({} as Record<string, { name: string; slug: string; avatar_url: string | null; primary_role: string | null }>),
  ]);

  const creditsWithProfiles = rawCredits.map((c) => ({
    ...c,
    profile: c.user_id ? (profilesMap[c.user_id] ?? null) : null,
    ghost: c.unclaimed_profile_id ? (ghostsMap[c.unclaimed_profile_id] ?? null) : null,
  }));

  return { project, credits: creditsWithProfiles, festivals: festivals ?? [] };
}

const getProject = unstable_cache(_getProject, ["project"], { revalidate: 300, tags: ["projects"] });

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
  const myCredit = data.credits.find((c) => c.user_id && c.user_id === userId) ?? null;

  let userPositions: string[] = [];
  if (userId) {
    const { data: prof } = await db
      .from("profiles")
      .select("positions")
      .eq("user_id", userId)
      .maybeSingle();
    userPositions = (prof?.positions as string[] | null) ?? [];
  }

  // If user has positions, show them first, then remaining roles; otherwise full list
  const roleOptions = [...new Set([...userPositions, ...ALL_CREW_ROLES])];

  return (
    <ProjectDetail
      project={data.project}
      credits={data.credits}
      festivals={data.festivals}
      currentUserId={userId ?? null}
      myCredit={myCredit}
      userPositions={roleOptions}
      isAdmin={isAdmin}
    />
  );
}
