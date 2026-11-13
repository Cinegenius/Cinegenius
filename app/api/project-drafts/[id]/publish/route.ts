import { placeWriteFields } from "@/lib/places/catalog";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { projectDraftMetadata } from "@/lib/project-drafts";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { projectMediaGrant, projectMediaUrls } from "@/lib/project-media-rights";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const { data: draft, error: draftError } = await db.from("project_drafts")
    .select("id, user_id, source_project_id, published_project_id, draft_data, updated_at")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (draftError) return NextResponse.json({ error: tResponse('System.m_4bb7a67aea1b') }, { status: 500 });
  if (!draft) return NextResponse.json({ error: tResponse('System.m_36ae6da39735') }, { status: 404 });
  if (draft.published_project_id) return NextResponse.json({ projectId: draft.published_project_id, alreadyPublished: true });

  const data = (draft.draft_data ?? {}) as Record<string, unknown>;
  const body = await req.json().catch(() => null);
  const rights = projectMediaGrant(data, body?.mediaRights ?? data.mediaRights, userId);
  if (projectMediaUrls(data).length && !rights) {
    return NextResponse.json({ error: (await getTranslations("ProjectMediaRights"))("required") }, { status: 400 });
  }
  const publicationMetadata = { ...projectDraftMetadata(data, id), media_rights: rights };
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) return NextResponse.json({ error: tResponse('System.m_c2018abde6e3') }, { status: 400 });
  if (typeof data.type !== "string" || !data.type.trim()) {
    return NextResponse.json({ error: tResponse('System.m_af547b8a0b13') }, { status: 400 });
  }
  const parsedYear = data.year == null || data.year === "" ? null : Number.parseInt(String(data.year), 10);
  const baseProjectFields = {
    ...placeWriteFields(typeof data.location==="string"&&data.location.trim()?data.location:typeof data.country==="string"?data.country:"",data.selected_place_city_id),
    title,
    year: parsedYear !== null && Number.isFinite(parsedYear) ? parsedYear : null,
    type: typeof data.type === "string" && data.type.trim() ? data.type.trim() : null,
    description: typeof data.description === "string" && data.description.trim() ? data.description : null,
    director: typeof data.director === "string" && data.director.trim() ? data.director : null,
    poster_url: typeof data.poster_url === "string" && data.poster_url.trim() ? data.poster_url : null,
    images: Array.isArray(data.images) ? data.images.filter((image): image is string => typeof image === "string") : [],
  };

  if (typeof body?.expectedUpdatedAt !== "string" || body.expectedUpdatedAt !== draft.updated_at) {
    return NextResponse.json({ error: tResponse("projects.publishConflict") }, { status: 409 });
  }
  const { data: projectId, error } = await db.rpc("publish_project_draft", {
    p_actor: userId, p_draft_id: id, p_expected_updated_at: draft.updated_at,
    p_fields: baseProjectFields, p_metadata: publicationMetadata,
  });
  if (error || typeof projectId !== "string") {
    const conflict = error?.code === "PT409";
    return NextResponse.json({ error: tResponse(conflict ? "projects.publishConflict" : "System.requestFailed") },
      { status: conflict ? 409 : error?.code === "PT404" ? 404 : 503 });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidateTag("projects", { expire: 0 });
  return NextResponse.json({ projectId });
}
