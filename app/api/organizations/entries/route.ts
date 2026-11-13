import { cityWriteFields } from "@/lib/places/catalog";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageOrganization } from "@/lib/organization-access";
import { validateOrganizationMediaReference } from "@/lib/organization-media";
import { isOrganizationEntryType, isOrganizationFormat, isOrganizationTopic, organizationSlug, safeExternalUrl } from "@/lib/organization-taxonomy";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const date = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;

async function uniqueEntrySlug(organizationId: string, title: string, id?: string) {
  const base = organizationSlug(title) || "beitrag";
  for (let index = 0; index < 100; index += 1) {
    const slug = index ? `${base}-${index + 1}` : base;
    let query = db.from("organization_entries").select("id").eq("organization_id", organizationId).eq("slug", slug);
    if (id) query = query.neq("id", id);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const organizationId = clean(body?.organizationId, 60);
  if (!organizationId || !await canManageOrganization(organizationId, session.userId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const title = clean(body?.title, 180);
  if (title.length < 2 || !isOrganizationEntryType(body?.entryType) || !isOrganizationFormat(body?.format) || !isOrganizationTopic(body?.topic)) return NextResponse.json({ error: "required" }, { status: 400 });
  const registrationUrl = body.entryType === "news" ? null : safeExternalUrl(body.registrationUrl);
  const externalUrl = safeExternalUrl(body.externalUrl);
  if ((body.entryType !== "news" && body.registrationUrl && !registrationUrl) || (body.externalUrl && !externalUrl)) return NextResponse.json({ error: "url" }, { status: 400 });
  const startsAt = body.entryType === "news" ? null : date(body.startsAt); const endsAt = body.entryType === "news" ? null : date(body.endsAt);
  if (body.entryType !== "news" && ((body.startsAt && !startsAt) || (body.endsAt && !endsAt))) return NextResponse.json({ error: "date" }, { status: 400 });
  if (startsAt && endsAt && endsAt < startsAt) return NextResponse.json({ error: "date" }, { status: 400 });
  const submit = body.submit === true;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const image = await validateOrganizationMediaReference(body.imageUrl, session.userId, "organization_entry", id);
  if (image.error) return NextResponse.json({ error: "media" }, { status: 400 });
  const { data, error } = await db.from("organization_entries").insert({
    id, organization_id: organizationId, author_user_id: session.userId, last_actor_user_id: session.userId,
    slug: await uniqueEntrySlug(organizationId, title), entry_type: body.entryType, title,
    summary: clean(body.summary, 500), description: clean(body.description, 12000), topic: body.topic,
    format: body.format, ...cityWriteFields(clean(body.city, 320), body.selected_place_city_id), venue: body.entryType === "news" ? "" : clean(body.venue, 180),
    starts_at: startsAt, ends_at: endsAt, registration_url: registrationUrl, external_url: externalUrl, image_url: image.url,
    moderation_status: submit ? "submitted" : "draft", submitted_at: submit ? now : null, updated_at: now,
  }).select("id,slug,moderation_status,updated_at").single();
  if (error || !data) return NextResponse.json({ error: "save" }, { status: 503 });
  return NextResponse.json({ entry: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = clean(body?.id, 60);
  const { data: existing, error: readError } = await db.from("organization_entries").select("organization_id,moderation_status,updated_at").eq("id", id).maybeSingle();
  if (readError) return NextResponse.json({ error: "load" }, { status: 503 });
  if (!existing || !await canManageOrganization(existing.organization_id, session.userId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (typeof body?.expectedUpdatedAt !== "string" || body.expectedUpdatedAt !== existing.updated_at) return NextResponse.json({ error: "conflict" }, { status: 409 });
  const title = clean(body?.title, 180);
  if (title.length < 2 || !isOrganizationEntryType(body?.entryType) || !isOrganizationFormat(body?.format) || !isOrganizationTopic(body?.topic)) return NextResponse.json({ error: "required" }, { status: 400 });
  const registrationUrl = body.entryType === "news" ? null : safeExternalUrl(body.registrationUrl); const externalUrl = safeExternalUrl(body.externalUrl);
  if ((body.entryType !== "news" && body.registrationUrl && !registrationUrl) || (body.externalUrl && !externalUrl)) return NextResponse.json({ error: "url" }, { status: 400 });
  const image = await validateOrganizationMediaReference(body.imageUrl, session.userId, "organization_entry", id);
  if (image.error) return NextResponse.json({ error: "media" }, { status: 400 });
  const startsAt = body.entryType === "news" ? null : date(body.startsAt); const endsAt = body.entryType === "news" ? null : date(body.endsAt);
  if (body.entryType !== "news" && ((body.startsAt && !startsAt) || (body.endsAt && !endsAt))) return NextResponse.json({ error: "date" }, { status: 400 });
  if (startsAt && endsAt && endsAt < startsAt) return NextResponse.json({ error: "date" }, { status: 400 });
  const submit = body.submit === true; const now = new Date().toISOString();
  const nextStatus = submit || ["approved", "ended"].includes(existing.moderation_status) ? "submitted" : existing.moderation_status;
  const patch: Record<string, unknown> = {
    entry_type: body.entryType, title, summary: clean(body.summary, 500), description: clean(body.description, 12000),
    topic: body.topic, format: body.format, ...cityWriteFields(clean(body.city, 320), body.selected_place_city_id), venue: body.entryType === "news" ? "" : clean(body.venue, 180),
    starts_at: startsAt, ends_at: endsAt, registration_url: registrationUrl, external_url: externalUrl, image_url: image.url,
    moderation_status: nextStatus, last_actor_user_id: session.userId, updated_at: now,
  };
  if (nextStatus === "submitted") {
    patch.submitted_at = now;
    patch.moderation_reason = "";
  }
  const { data, error } = await db.from("organization_entries").update(patch).eq("id", id).eq("updated_at", existing.updated_at).select("id,slug,moderation_status,updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "save" }, { status: 503 });
  if (!data) return NextResponse.json({ error: "conflict" }, { status: 409 });
  return NextResponse.json({ entry: data });
}
