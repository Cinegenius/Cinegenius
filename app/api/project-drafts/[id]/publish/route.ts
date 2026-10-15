import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { projectDraftMetadata } from "@/lib/project-drafts";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const PROJECT_FIELDS = [
  "year", "type", "description", "director", "poster_url", "images", "status", "logline",
  "production_company", "runtime_minutes", "trailer_url", "release_cinema", "release_streaming", "release_tv",
  "prep_start", "prep_end", "shoot_start", "shoot_end", "post_start", "post_end",
] as const;

function slugifyName(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

async function findOrCreateUnclaimedProfile(name: string, role: string, userId: string) {
  const escapedName = name.replace(/[\\%_]/g, "\\$&");
  const existing = await db.from("unclaimed_profiles").select("id")
    .ilike("name", escapedName).is("claimed_by", null).maybeSingle();
  if (existing.error) return { id: null, error: existing.error };
  if (existing.data) return { id: existing.data.id as string, error: null };

  const baseSlug = slugifyName(name);
  if (!baseSlug) return { id: null, error: new Error("Ungültiger Name") };
  for (let suffix = 1; suffix <= 40; suffix++) {
    const slug = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;
    const taken = await db.from("unclaimed_profiles").select("id").eq("slug", slug).maybeSingle();
    if (taken.error) return { id: null, error: taken.error };
    if (taken.data) continue;
    const inserted = await db.from("unclaimed_profiles")
      .insert({ name, slug, primary_role: role, created_by: userId })
      .select("id").single();
    if (!inserted.error && inserted.data) return { id: inserted.data.id as string, error: null };
    if (inserted.error?.code === "23505") {
      const retry = await db.from("unclaimed_profiles").select("id")
        .ilike("name", escapedName).is("claimed_by", null).maybeSingle();
      if (retry.error) return { id: null, error: retry.error };
      if (retry.data) return { id: retry.data.id as string, error: null };
      continue;
    }
    return { id: null, error: inserted.error ?? new Error("Profil konnte nicht angelegt werden") };
  }
  return { id: null, error: new Error("Kein eindeutiger Profilname verfügbar") };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const { data: draft, error: draftError } = await db.from("project_drafts")
    .select("id, user_id, source_project_id, published_project_id, draft_data")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (draftError) return NextResponse.json({ error: "Entwurf konnte nicht geladen werden" }, { status: 500 });
  if (!draft) return NextResponse.json({ error: "Entwurf nicht gefunden oder keine Berechtigung" }, { status: 404 });
  if (draft.published_project_id) return NextResponse.json({ projectId: draft.published_project_id, alreadyPublished: true });

  const data = (draft.draft_data ?? {}) as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Titel ist Pflichtfeld" }, { status: 400 });
  if (typeof data.type !== "string" || !data.type.trim()) {
    return NextResponse.json({ error: "Bitte wähle eine Produktionsart aus" }, { status: 400 });
  }
  let projectId: string | null = null;

  if (draft.source_project_id) {
    const updates: Record<string, unknown> = { title, updated_at: new Date().toISOString() };
    for (const field of PROJECT_FIELDS) if (field in data) updates[field] = data[field];
    updates.metadata = projectDraftMetadata(data, id);
    delete (updates.metadata as Record<string, unknown>).draft_id;
    const { data: project, error } = await db.from("projects").update(updates)
      .eq("id", draft.source_project_id).eq("created_by", userId)
      .select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "Änderungen konnten nicht veröffentlicht werden" }, { status: 500 });
    if (!project) return NextResponse.json({ error: "Projekt nicht gefunden oder keine Berechtigung" }, { status: 404 });
    projectId = project.id;
  } else {
    const { data: existing } = await db.from("projects").select("id")
      .eq("created_by", userId).contains("metadata", { draft_id: id }).maybeSingle();
    if (existing) projectId = existing.id;

    if (!projectId) {
      const insert: Record<string, unknown> = {
        title,
        year: data.year ? Number.parseInt(String(data.year), 10) : null,
        type: data.type || null,
        description: data.description || null,
        director: data.director || null,
        poster_url: data.poster_url || null,
        images: Array.isArray(data.images) ? data.images : [],
        created_by: userId,
        metadata: projectDraftMetadata(data, id),
      };
      for (const field of PROJECT_FIELDS) if (field in data) insert[field] = data[field];
      const { data: created, error } = await db.from("projects").insert(insert).select("id").single();
      if (created) projectId = created.id;
      if (error && error.code === "23505") {
        const { data: retryExisting } = await db.from("projects").select("id")
          .eq("created_by", userId).contains("metadata", { draft_id: id }).maybeSingle();
        if (retryExisting) projectId = retryExisting.id;
      } else if (error) {
        return NextResponse.json({ error: "Projekt konnte nicht veröffentlicht werden" }, { status: 500 });
      }
    }

    if (!projectId) return NextResponse.json({ error: "Projektveröffentlichung konnte nicht bestätigt werden" }, { status: 500 });
  }

  if (typeof data.myRole === "string" && data.myRole.trim()) {
    const { error: creditError } = await db.from("project_credits").upsert(
      { project_id: projectId, user_id: userId, role: data.myRole.trim() },
      { onConflict: "project_id,user_id" },
    );
    if (creditError) return NextResponse.json({ error: "Projekt gespeichert, Crew-Rolle konnte aber nicht übernommen werden" }, { status: 500 });
  }

  const crewEntries = Array.isArray(data.crew_entries)
    ? data.crew_entries.filter((entry): entry is { name: string; role: string } =>
      !!entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string" && typeof (entry as { role?: unknown }).role === "string",
    ).slice(0, 40)
    : [];
  for (const entry of crewEntries) {
    const name = entry.name.trim().slice(0, 100);
    const role = entry.role.trim().slice(0, 100);
    if (!name || !role) continue;
    const profile = await findOrCreateUnclaimedProfile(name, role, userId);
    if (profile.error || !profile.id) {
      return NextResponse.json({ error: "Projekt ist veröffentlicht, aber ein Mitwirkenden-Eintrag konnte nicht gespeichert werden. Bitte erneut veröffentlichen." }, { status: 500 });
    }
    const existingCredit = await db.from("project_credits").select("id")
      .eq("project_id", projectId).eq("unclaimed_profile_id", profile.id).maybeSingle();
    if (existingCredit.error) {
      return NextResponse.json({ error: "Projekt ist veröffentlicht, aber Mitwirkende konnten nicht vollständig geladen werden." }, { status: 500 });
    }
    if (!existingCredit.data) {
      const credit = await db.from("project_credits").insert({
        project_id: projectId,
        unclaimed_profile_id: profile.id,
        role,
      });
      if (credit.error && credit.error.code !== "23505") {
        return NextResponse.json({ error: "Projekt ist veröffentlicht, aber ein Mitwirkenden-Eintrag konnte nicht gespeichert werden. Bitte erneut veröffentlichen." }, { status: 500 });
      }
    }
  }

  const { error: markError } = await db.from("project_drafts").update({
    published_project_id: projectId,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("user_id", userId).is("published_project_id", null);
  if (markError) return NextResponse.json({ error: "Veröffentlichung gespeichert, aber Entwurfsstatus konnte nicht aktualisiert werden" }, { status: 500 });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidateTag("projects", { expire: 0 });
  return NextResponse.json({ projectId });
}
