import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import PersonView from "./PersonView";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

type Project = {
  id: string;
  title: string;
  year: number | null;
  type: string | null;
  director: string | null;
  poster_url: string | null;
};

type Credit = {
  id: string;
  role: string;
  created_at: string;
  projects: Project | null;
};

async function getData(slug: string) {
  const { data: profile } = await db
    .from("unclaimed_profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!profile) return null;

  const { data: credits } = await db
    .from("project_credits")
    .select("id, role, created_at, projects(id, title, year, type, director, poster_url)")
    .eq("unclaimed_profile_id", profile.id)
    .order("created_at", { ascending: false });

  return { profile, credits: (credits ?? []) as unknown as Credit[] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) return {};
  return {
    title: `${data.profile.name} — CineGenius`,
    description: `${data.profile.name}${data.profile.primary_role ? ` · ${data.profile.primary_role}` : ""} — Filmografie auf CineGenius`,
  };
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) notFound();

  // If already claimed and we know the user's profile slug, redirect there
  if (data.profile.claimed_by) {
    const { data: claimerProfile } = await db
      .from("profiles")
      .select("slug")
      .eq("user_id", data.profile.claimed_by)
      .maybeSingle();
    if (claimerProfile?.slug) {
      redirect(`/profile/${claimerProfile.slug}`);
    }
  }

  const { userId } = await auth();

  return (
    <PersonView
      profile={data.profile}
      credits={data.credits}
      currentUserId={userId ?? null}
    />
  );
}
