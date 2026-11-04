import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageOrganization } from "@/lib/organization-access";
import { validateOrganizationMediaReference } from "@/lib/organization-media";
import { isOrganizationTopic, organizationSlug, safeExternalUrl } from "@/lib/organization-taxonomy";
import { validateResponsiblePerson } from "@/lib/responsible-person-server";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function publicEmail(value: unknown) {
  const email = text(value, 254).toLowerCase();
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email || null : undefined;
}

async function uniqueSlug(name: string, id?: string) {
  const base = organizationSlug(name) || "organisation";
  for (let index = 0; index < 100; index += 1) {
    const slug = index ? `${base}-${index + 1}` : base;
    let query = db.from("organizations").select("id").eq("slug", slug);
    if (id) query = query.neq("id", id);
    const { data, error } = await query.maybeSingle();
    if (!error && !data) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = text(body?.name, 140);
  if (name.length < 2) return NextResponse.json({ error: "name" }, { status: 400 });
  const responsible = await validateResponsiblePerson(body?.responsiblePerson, session.userId, true, true);
  if (responsible.response) return responsible.response;
  const topics = Array.isArray(body?.topics) ? [...new Set(body.topics.filter(isOrganizationTopic))].slice(0, 12) : [];
  const websiteUrl = safeExternalUrl(body?.websiteUrl);
  if (body?.websiteUrl && !websiteUrl) return NextResponse.json({ error: "website" }, { status: 400 });
  const contactEmail = publicEmail(body?.publicContactEmail);
  const id = crypto.randomUUID();
  const logo = await validateOrganizationMediaReference(body?.logoUrl, session.userId, "organization", id);
  if (contactEmail === undefined) return NextResponse.json({ error: "contact" }, { status: 400 });
  if (logo.error) return NextResponse.json({ error: "media" }, { status: 400 });
  const slug = await uniqueSlug(name);
  const now = new Date().toISOString();
  const { data, error } = await db.from("organizations").insert({
    id, owner_user_id: session.userId, responsible_user_id: session.userId, slug, name,
    description: text(body?.description, 5000), topics, city: text(body?.city, 120),
    region: text(body?.region, 120), website_url: websiteUrl, public_contact_email: contactEmail, logo_url: logo.url,
    responsible_person: responsible.person, moderation_status: body?.submit === true ? "submitted" : "draft",
    submitted_at: body?.submit === true ? now : null, last_actor_user_id: session.userId, updated_at: now,
  }).select("id,slug,moderation_status,updated_at").single();
  if (error || !data) return NextResponse.json({ error: "save" }, { status: 503 });
  return NextResponse.json({ organization: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = text(body?.id, 60);
  if (!id || !await canManageOrganization(id, session.userId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: existing, error: readError } = await db.from("organizations").select("moderation_status,updated_at,responsible_user_id,responsible_person").eq("id", id).maybeSingle();
  if (readError) return NextResponse.json({ error: "load" }, { status: 503 });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (typeof body?.expectedUpdatedAt !== "string" || body.expectedUpdatedAt !== existing.updated_at) return NextResponse.json({ error: "conflict" }, { status: 409 });
  const name = text(body?.name, 140);
  if (name.length < 2) return NextResponse.json({ error: "name" }, { status: 400 });
  const responsible = existing.responsible_user_id === session.userId
    ? await validateResponsiblePerson(body?.responsiblePerson, session.userId, true, true)
    : { person: existing.responsible_person, response: null };
  if (responsible.response) return responsible.response;
  const topics = Array.isArray(body?.topics) ? [...new Set(body.topics.filter(isOrganizationTopic))].slice(0, 12) : [];
  const websiteUrl = safeExternalUrl(body?.websiteUrl);
  if (body?.websiteUrl && !websiteUrl) return NextResponse.json({ error: "website" }, { status: 400 });
  const contactEmail = publicEmail(body?.publicContactEmail);
  const logo = await validateOrganizationMediaReference(body?.logoUrl, session.userId, "organization", id);
  if (contactEmail === undefined) return NextResponse.json({ error: "contact" }, { status: 400 });
  if (logo.error) return NextResponse.json({ error: "media" }, { status: 400 });

  const changedApproved = existing.moderation_status === "approved";
  const nextStatus = body?.submit === true ? "submitted" : changedApproved ? "submitted" : existing.moderation_status;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    name,
    description: text(body?.description, 5000), topics, city: text(body?.city, 120),
    region: text(body?.region, 120), website_url: websiteUrl, public_contact_email: contactEmail, logo_url: logo.url, responsible_person: responsible.person,
    moderation_status: nextStatus, last_actor_user_id: session.userId, updated_at: now,
  };
  if (nextStatus === "submitted") {
    patch.submitted_at = now;
    patch.moderation_reason = "";
  }
  const { data, error } = await db.from("organizations").update(patch).eq("id", id).eq("updated_at", existing.updated_at).select("id,slug,moderation_status,updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "save" }, { status: 503 });
  if (!data) return NextResponse.json({ error: "conflict" }, { status: 409 });
  return NextResponse.json({ organization: data });
}
