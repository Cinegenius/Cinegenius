import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import ProjectDetail from "@/components/ProjectDetail";
import { departments } from "@/lib/departments";

const ALL_CREW_ROLES = departments.flatMap((d) => d.roles);

export const dynamic = "force-dynamic";

async function getProject(id: string) {
  const [{ data: project }, { data: credits }, { data: festivals }] = await Promise.all([
    supabaseAdmin.from("projects").select("*").eq("id", id).single(),
    supabaseAdmin.from("project_credits").select("id, user_id, role, created_at").eq("project_id", id).order("created_at", { ascending: true }),
    supabaseAdmin.from("project_festivals").select("*").eq("project_id", id).order("year", { ascending: false }),
  ]);

  if (!project) return null;

  const userIds = (credits ?? []).map((c: { user_id: string }) => c.user_id);
  let profiles: Record<string, { display_name: string; avatar_url: string | null; role: string | null }> = {};

  if (userIds.length > 0) {
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url, role")
      .in("user_id", userIds);

    profiles = Object.fromEntries(
      (profileData ?? []).map((p: { user_id: string; display_name: string; avatar_url: string | null; role: string | null }) => [p.user_id, p])
    );
  }

  const creditsWithProfiles = (credits ?? []).map((c: { id: string; user_id: string; role: string; created_at: string }) => ({
    ...c,
    profile: profiles[c.user_id] ?? null,
  }));

  return { project, credits: creditsWithProfiles, festivals: festivals ?? [] };
}

export async function generateStaticParams() {
  return [];
}

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

  const { userId } = await auth();
  const myCredit = data.credits.find((c) => c.user_id === userId) ?? null;

  let userPositions: string[] = [];
  if (userId) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("positions")
      .eq("user_id", userId)
      .maybeSingle();
    userPositions = (prof?.positions as string[] | null) ?? [];
  }

  // If user has positions, show them first, then remaining roles; otherwise full list
  const roleOptions = userPositions.length > 0
    ? [...userPositions, ...ALL_CREW_ROLES.filter((r) => !userPositions.includes(r))]
    : ALL_CREW_ROLES;

  return (
    <ProjectDetail
      project={data.project}
      credits={data.credits}
      festivals={data.festivals}
      currentUserId={userId ?? null}
      myCredit={myCredit}
      userPositions={roleOptions}
    />
  );
}
