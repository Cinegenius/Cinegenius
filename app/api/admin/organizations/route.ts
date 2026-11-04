import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { finishAdminAudit, startAdminAudit, validateAdminReason } from "@/lib/admin-audit";

const ORGANIZATION_STATUSES = ["approved", "changes_requested", "rejected", "hidden"] as const;
const ENTRY_STATUSES = [...ORGANIZATION_STATUSES, "ended"] as const;

type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];
type EntryStatus = (typeof ENTRY_STATUSES)[number];

function cleanSearch(value: string | null) {
  return (value ?? "").slice(0, 80).replace(/[%,()]/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const search = cleanSearch(searchParams.get("search"));
  const submittedOnly = searchParams.get("submittedOnly") === "true";
  const limit = 100;

  let organizationsQuery = db
    .from("organizations")
    .select("id,slug,name,description,logo_url,topics,city,region,website_url,public_contact_email,moderation_status,moderation_reason,responsible_user_id,responsible_person,submitted_at,published_at,created_at,updated_at")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (submittedOnly) organizationsQuery = organizationsQuery.eq("moderation_status", "submitted");
  if (search) organizationsQuery = organizationsQuery.or(`name.ilike.%${search}%,city.ilike.%${search}%,region.ilike.%${search}%`);

  let entriesQuery = db
    .from("organization_entries")
    .select("id,organization_id,slug,entry_type,title,summary,description,topic,format,city,venue,starts_at,ends_at,registration_url,external_url,image_url,moderation_status,moderation_reason,submitted_at,published_at,created_at,updated_at")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (submittedOnly) entriesQuery = entriesQuery.eq("moderation_status", "submitted");
  if (search) entriesQuery = entriesQuery.or(`title.ilike.%${search}%,city.ilike.%${search}%`);

  const [{ data: organizations, error: organizationsError }, { data: entries, error: entriesError }] = await Promise.all([
    organizationsQuery,
    entriesQuery,
  ]);
  if (organizationsError || entriesError) {
    return NextResponse.json({ error: "load" }, { status: 500 });
  }

  const organizationIds = [...new Set((entries ?? []).map((entry) => entry.organization_id))];
  const { data: entryOrganizations, error: organizationLookupError } = organizationIds.length
    ? await db.from("organizations").select("id,slug,name,moderation_status").in("id", organizationIds)
    : { data: [], error: null };
  if (organizationLookupError) return NextResponse.json({ error: "load" }, { status: 500 });
  const organizationById = new Map((entryOrganizations ?? []).map((organization) => [organization.id, organization]));

  return NextResponse.json({
    organizations: organizations ?? [],
    entries: (entries ?? []).map((entry) => ({ ...entry, organization: organizationById.get(entry.organization_id) ?? null })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const kind = body?.kind === "organization" || body?.kind === "entry" ? body.kind : null;
  const id = typeof body?.id === "string" ? body.id.trim().slice(0, 80) : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const reason = status === "approved" ? "Reviewed and explicitly approved by administrator." : validateAdminReason(body?.reason);
  const allowed = kind === "organization"
    ? (ORGANIZATION_STATUSES as readonly string[]).includes(status)
    : kind === "entry" && (ENTRY_STATUSES as readonly string[]).includes(status);
  if (!kind || !id || !allowed || !reason) {
    return NextResponse.json({ error: "required" }, { status: 400 });
  }

  const table = kind === "organization" ? "organizations" : "organization_entries";
  const { data: current, error: currentError } = await db.from(table).select("*").eq("id", id).maybeSingle();
  if (currentError) return NextResponse.json({ error: "load" }, { status: 500 });
  if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (typeof body?.expectedUpdatedAt !== "string" || body.expectedUpdatedAt !== current.updated_at) {
    return NextResponse.json({ error: "conflict" }, { status: 409 });
  }
  if (status === "approved" && body?.reviewed !== true) {
    return NextResponse.json({ error: "review_required" }, { status: 400 });
  }
  if (status === "ended" && !["approved", "ended"].includes(current.moderation_status)) {
    return NextResponse.json({ error: "conflict" }, { status: 409 });
  }
  if ((status === "approved" || status === "ended") && kind === "entry") {
    const entry = current as Record<string, unknown>;
    const { data: parent, error: parentError } = await db.from("organizations").select("moderation_status").eq("id", entry.organization_id as string).maybeSingle();
    if (parentError) return NextResponse.json({ error: "load" }, { status: 503 });
    if (parent?.moderation_status !== "approved") {
      return NextResponse.json({ error: "parent_required" }, { status: 409 });
    }
  }

  const action = `organization_${kind}_${status}`;
  const audit = await startAdminAudit({ actorUserId: admin.userId, action, entityType: kind, entityId: id, reason });
  if (!audit) return NextResponse.json({ error: "audit" }, { status: 503 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    moderation_status: status as OrganizationStatus | EntryStatus,
    moderation_reason: status === "approved" ? "" : reason,
    reviewed_at: now,
    reviewed_by: admin.userId,
    last_actor_user_id: admin.userId,
    updated_at: now,
  };
  if (status === "approved") update.published_at = now;
  const { data: updated, error: updateError } = await db.from(table).update(update).eq("id", id).eq("updated_at", current.updated_at).select("id,moderation_status,updated_at").maybeSingle();
  if (updateError || !updated) {
    await finishAdminAudit(audit, "failed");
    return NextResponse.json({ error: updateError ? "save" : "conflict" }, { status: updateError ? 503 : 409 });
  }

  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ success: true, item: updated, auditLogged });
}
