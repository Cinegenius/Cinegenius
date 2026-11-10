import { localizedNotification } from "@/lib/i18n/notification-copy";
import { db } from "@/lib/db";
import { requireAuth, assertOwner } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// PATCH /api/applications/[id] — job owner accepts or rejects an application
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;
  const body = await req.json();
  const { status } = body;

  if (status !== "accepted" && status !== "rejected") {
    return NextResponse.json({ error: tResponse('System.m_e1d05fa3a095') }, { status: 400 });
  }

  // Fetch application — owner_id is stored in DB, never read from client
  const { data: application } = await db
    .from("applications")
    .select("id, applicant_id, job_title, owner_id, status")
    .eq("id", id)
    .maybeSingle();

  // assertOwner handles null (404) and mismatch (403)
  const ownershipError = assertOwner(application?.owner_id, userId, tResponse);
  if (ownershipError) return ownershipError;

  // Type narrowing: application is defined after ownership check passes
  const app = application!;

  const { error } = await db
    .from("applications")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });

  // Notify the applicant
  await db.from("notifications").insert({
    user_id: app.applicant_id,
    type: status === "accepted" ? "new_application" : "application_sent",
    ...localizedNotification({ title: status === "accepted" ? { key: "n_ea6126cc7e26" } : { key: "n_83d937785d2c" }, body: status === "accepted" ? { key: "n_28d8576e6594", values: { value0: String(app.job_title) } } : { key: "n_84ebc88da291", values: { value0: String(app.job_title) } } }),

    href: "/dashboard?tab=bookings",
  });

  return NextResponse.json({ success: true, status });
}
