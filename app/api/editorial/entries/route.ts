import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cityWriteFields } from "@/lib/places/catalog";
import { countryCode } from "@/lib/places/core";
import { editorialSourceUrl } from "@/lib/editorial-agent-policy";
import { validateOrganizationMediaReference } from "@/lib/organization-media";
import { isOrganizationEntryType, isOrganizationFormat, isOrganizationTopic, safeExternalUrl } from "@/lib/organization-taxonomy";
import { editorialFailure, editorialHeaders, editorialOrganizationAllowed, requireEditorialAgent } from "@/lib/editorial-agent-server";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const date = (value: unknown) => typeof value === "string" && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
export async function GET(request: NextRequest) {
  const actor = await requireEditorialAgent(request);
  if (actor instanceof NextResponse) return actor;
  const organizationId = request.nextUrl.searchParams.get("organizationId") ?? "";
  if (!await editorialOrganizationAllowed(organizationId)) return NextResponse.json({ error: "editorial_forbidden" }, { status: 403, headers: editorialHeaders });
  const id = request.nextUrl.searchParams.get("id");
  const page = Math.max(1, Math.min(10000, Number(request.nextUrl.searchParams.get("page")) || 1));
  if (!Number.isInteger(page)) return NextResponse.json({ error: "editorial_required" }, { status: 400, headers: editorialHeaders });
  let query = db.from("organization_entries").select("*").eq("organization_id", organizationId).eq("author_user_id", actor.userId);
  if (id) { if (!uuid(id)) return NextResponse.json({ error: "editorial_required" }, { status: 400, headers: editorialHeaders }); query = query.eq("id", id); }
  const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: true }).range((page - 1) * 100, page * 100);
  return error ? NextResponse.json({ error: "editorial_unavailable" }, { status: 503, headers: editorialHeaders }) : NextResponse.json({ entries: (data ?? []).slice(0, 100), hasMore: (data ?? []).length > 100, page }, { headers: editorialHeaders });
}
export async function POST(request: NextRequest) {
  const actor = await requireEditorialAgent(request);
  if (actor instanceof NextResponse) return actor;
  const body = await request.json().catch(() => null);
  if (!body || !uuid(body.id) || !uuid(body.organizationId) || !(body.expectedUpdatedAt === null || typeof body.expectedUpdatedAt === "string") || typeof body.submit !== "boolean") return NextResponse.json({ error: "editorial_required" }, { status: 400, headers: editorialHeaders });
  if (!await editorialOrganizationAllowed(body.organizationId)) return NextResponse.json({ error: "editorial_forbidden" }, { status: 403, headers: editorialHeaders });
  const title = clean(body.title, 180);
  const externalUrl = editorialSourceUrl(body.externalUrl);
  if (title.length < 2 || !isOrganizationEntryType(body.entryType) || !isOrganizationFormat(body.format) || !isOrganizationTopic(body.topic) || !externalUrl) return NextResponse.json({ error: "editorial_required" }, { status: 400, headers: editorialHeaders });
  const registrationUrl = safeExternalUrl(body.registrationUrl);
  if (body.registrationUrl && !registrationUrl) return NextResponse.json({ error: "editorial_url" }, { status: 400, headers: editorialHeaders });
  const startsAt = date(body.startsAt), endsAt = date(body.endsAt);
  if ((body.startsAt && !startsAt) || (body.endsAt && !endsAt) || (startsAt && endsAt && endsAt < startsAt)) return NextResponse.json({ error: "editorial_date" }, { status: 400, headers: editorialHeaders });
  const country = typeof body.countryCode === 'string' ? countryCode(body.countryCode) : '';
  if (body.countryCode && (typeof body.countryCode !== 'string' || country !== body.countryCode)) return NextResponse.json({error:'editorial_country'}, {status:400, headers:editorialHeaders});
  const city = clean(body.city, 320);
  const place = cityWriteFields(city ? [city, country].filter(Boolean).join(', ') : country, body.selected_place_city_id);
  if (country && place.place_country_code !== country) return NextResponse.json({error:'editorial_place'}, {status:400, headers:editorialHeaders});
  const image = await validateOrganizationMediaReference(body.imageUrl, actor.userId, "organization_entry", body.id);
  if (image.error) return NextResponse.json({ error: "editorial_media" }, { status: 400, headers: editorialHeaders });
  const { data, error } = await db.rpc("save_editorial_entry", { p_id: body.id, p_organization: body.organizationId, p_expected: body.expectedUpdatedAt, p_submit: body.submit, p_document: {
    entry_type: body.entryType, title, summary: clean(body.summary, 500), description: clean(body.description, 12000), topic: body.topic, format: body.format,
    ...place, venue: clean(body.venue, 180), starts_at: startsAt, ends_at: endsAt,
    registration_url: registrationUrl, external_url: externalUrl, image_url: image.url,
  } });
  if (error) return editorialFailure(error);
  return NextResponse.json({ entry: Array.isArray(data) ? data[0] : data }, { headers: editorialHeaders });
}
