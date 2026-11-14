import { localizedNotification } from "@/lib/i18n/notification-copy";
import { createHash } from "node:crypto";
// Required Supabase table:
// CREATE TABLE IF NOT EXISTS applications (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   job_id text NOT NULL,
//   job_title text NOT NULL,
//   owner_id text NOT NULL,
//   applicant_id text NOT NULL,
//   message text NOT NULL,
//   portfolio_url text,
//   day_rate text,
//   status text NOT NULL DEFAULT 'pending',
//   created_at timestamptz DEFAULT now()
// );
// CREATE INDEX applications_owner_id_idx ON applications(owner_id, created_at DESC);
// CREATE INDEX applications_applicant_id_idx ON applications(applicant_id, created_at DESC);
// CREATE UNIQUE INDEX applications_unique ON applications(job_id, applicant_id);

import { db } from "@/lib/db";
import { requireAuth, getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewApplicationEmail } from "@/lib/email";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// POST /api/applications — submit a job application
export async function POST(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { allowed } = await rateLimit(`application:${userId}`, 10, 60);
  if (!allowed) return NextResponse.json({ error: tResponse('System.m_35bd89251439') }, { status: 429 });

  // NOTE: jobTitle and ownerId from the client body are intentionally ignored below.
  // We fetch the authoritative values from the DB to prevent spoofing.
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: tResponse("System.requestFailed") }, { status: 400 });
  const { jobId, message, portfolioUrl, dayRate, accountId } = body;
  if (accountId !== undefined && accountId !== userId) return NextResponse.json({ error: tResponse("System.requestFailed") }, { status: 409 });
  if (typeof jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(jobId) || typeof message !== "string" || message.length > 5000 || (portfolioUrl !== undefined && (typeof portfolioUrl !== "string" || portfolioUrl.length > 2000)) || (dayRate !== undefined && (typeof dayRate !== "string" || dayRate.length > 100))) return NextResponse.json({ error: tResponse("System.requestFailed") }, { status: 400 });
  if (portfolioUrl) { try { const url = new URL(portfolioUrl); if (!["http:", "https:"].includes(url.protocol)) throw new Error("invalid_url"); } catch { return NextResponse.json({ error: tResponse("System.requestFailed") }, { status: 400 }); } }

  if (!jobId || !message?.trim()) {
    return NextResponse.json({ error: tResponse('System.m_3b85b95ef017') }, { status: 400 });
  }

  // Fetch job from DB — never trust client-supplied title or ownerId
  const { data: job } = await db
    .from("privacy_visible_listings")
    .select("id, title, user_id, published, type")
    .eq("id", jobId)
    .eq("type", "job")
    .maybeSingle();

  if (!job || !job.published) {
    return NextResponse.json({ error: tResponse('System.m_edc003400bff') }, { status: 404 });
  }

  const ownerId = job.user_id;      // authoritative owner from DB
  const jobTitle = job.title;       // authoritative title from DB

  if (ownerId === userId) {
    return NextResponse.json({ error: tResponse('System.m_4a3562030a31') }, { status: 400 });
  }

  // Upsert so re-applying updates the message rather than throwing a conflict
  const { error } = await db
    .from("applications")
    .upsert({
      job_id: jobId,
      job_title: jobTitle,
      owner_id: ownerId,
      applicant_id: userId,
      message: message.trim(),
      portfolio_url: portfolioUrl?.trim() || null,
      day_rate: dayRate?.trim() || null,
      status: "pending",
    }, { onConflict: "job_id,applicant_id" });

  if (error) {
    console.error("Application insert error:", error);
    return NextResponse.json({ error: tResponse('System.m_554087dca297') }, { status: 500 });
  }

  // Notification for the job owner
  await db.from("notifications").insert({
    user_id: ownerId,
    type: "new_application",
    ...localizedNotification({ title: { key: "n_52ebfd46b352" }, body: { key: "n_f5ec0ac58f2d", values: { value0: String(jobTitle) } } }),

    href: "/dashboard?tab=messages",
  });

  // Notification for the applicant
  await db.from("notifications").insert({
    user_id: userId,
    type: "application_sent",
    ...localizedNotification({ title: { key: "n_245257c21df5" }, body: { key: "n_0639be2a8253", values: { value0: String(jobTitle) } } }),

    href: "/dashboard?tab=messages",
  });

  // The application is already saved. A chat is an optional, separate channel:
  // current message consent must never leave an empty chat or undo that success.
  try {
    const chatSignal = AbortSignal.timeout(8_000);
    const { data: application, error: lookupError } = await db.from("applications")
      .select("id").eq("job_id", job.id).eq("applicant_id", userId).abortSignal(chatSignal).maybeSingle();
    const body = [
      message.trim(),
      portfolioUrl?.trim() ? `Portfolio: ${portfolioUrl.trim()}` : null,
      dayRate?.trim() ? `Tagesgage: ${dayRate.trim()}` : null,
    ].filter(Boolean).join("\n\n");
    if (!lookupError && typeof application?.id === "string") {
      const requestKey = "application_" + createHash("sha256")
        .update(JSON.stringify({ applicationId: application.id, content: body })).digest("hex");
      await db.rpc("start_direct_conversation", {
        p_sender_id: userId, p_receiver_id: ownerId, p_content: body, p_idempotency_key: requestKey,
        p_listing_id: job.id, p_listing_title: jobTitle, p_listing_type: "job",
      }).abortSignal(chatSignal);
    }
  } catch { /* A saved application remains successful if the optional chat is unavailable. */ }

  // Email notification to job owner
  try {
    const [{ data: applicantProfile }, clerk] = await Promise.all([
      db.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      clerkClient(),
    ]);
    const applicantName = applicantProfile?.display_name ?? "Jemand";
    const ownerUser = await clerk.users.getUser(ownerId);
    const ownerEmail = ownerUser.emailAddresses[0]?.emailAddress;
    if (ownerEmail) await sendNewApplicationEmail(ownerEmail, applicantName, jobTitle);
  } catch { /* email is best-effort */ }

  return NextResponse.json({ success: true });
}

// GET /api/applications — list applications for current user
// ?incoming=true → applications received on jobs I own
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ applications: [] });
  const { userId } = user;

  const incoming = new URL(req.url).searchParams.get("incoming") === "true";

  if (incoming) {
    const { data } = await db
      .from("applications")
      .select("id, job_id, job_title, applicant_id, message, portfolio_url, day_rate, status, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    // Enrich with applicant display_name
    const applicantIds = [...new Set((data ?? []).map((a) => a.applicant_id))];
    const nameMap: Record<string, { name: string; avatar: string | null }> = {};
    if (applicantIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", applicantIds);
      (profiles ?? []).forEach((p) => {
        nameMap[p.user_id] = { name: p.display_name ?? "Unbekannt", avatar: p.avatar_url ?? null };
      });
    }

    const enriched = (data ?? []).map((a) => ({
      ...a,
      applicant_name: nameMap[a.applicant_id]?.name ?? "Unbekannt",
      applicant_avatar: nameMap[a.applicant_id]?.avatar ?? null,
    }));

    return NextResponse.json({ applications: enriched });
  }

  const { data } = await db
    .from("applications")
    .select("id, job_id, job_title, status, day_rate, created_at")
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ applications: data ?? [] });
}
