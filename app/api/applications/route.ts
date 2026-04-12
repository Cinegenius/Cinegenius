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

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// POST /api/applications — submit a job application
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { jobId, jobTitle, ownerId, message, portfolioUrl, dayRate } = await req.json();

  if (!jobId || !jobTitle || !ownerId || !message?.trim()) {
    return NextResponse.json({ error: "Fehlende Pflichtfelder" }, { status: 400 });
  }
  if (ownerId === userId) {
    return NextResponse.json({ error: "Du kannst dich nicht auf eigene Stellenausschreibungen bewerben" }, { status: 400 });
  }

  // Upsert so re-applying updates the message rather than throwing a conflict
  const { error } = await supabaseAdmin
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
    return NextResponse.json({ error: "Bewerbung konnte nicht gespeichert werden" }, { status: 500 });
  }

  // Notification for the job owner
  await supabaseAdmin.from("notifications").insert({
    user_id: ownerId,
    type: "new_application",
    title: "Neue Bewerbung",
    body: `Jemand hat sich auf „${jobTitle}" beworben.`,
    href: "/dashboard?tab=messages",
  });

  // Notification for the applicant
  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: "application_sent",
    title: "Bewerbung abgesendet",
    body: `Deine Bewerbung für „${jobTitle}" wurde übermittelt.`,
    href: "/dashboard?tab=messages",
  });

  // Also open a conversation thread so the job poster can reply via messages
  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("listing_id", jobId)
    .eq("sender_id", userId)
    .eq("receiver_id", ownerId)
    .maybeSingle();

  let conversationId = existing?.id;
  if (!conversationId) {
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .insert({
        listing_id: jobId,
        listing_title: jobTitle,
        listing_type: "job",
        sender_id: userId,
        receiver_id: ownerId,
      })
      .select("id")
      .single();
    conversationId = conv?.id;
  }

  if (conversationId) {
    const body = [
      message.trim(),
      portfolioUrl?.trim() ? `Portfolio: ${portfolioUrl.trim()}` : null,
      dayRate?.trim() ? `Tagesgage: ${dayRate.trim()}` : null,
    ].filter(Boolean).join("\n\n");

    await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: body,
    });
  }

  return NextResponse.json({ success: true });
}

// GET /api/applications — list applications for current user (as applicant or owner)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ applications: [] });

  const { data } = await supabaseAdmin
    .from("applications")
    .select("id, job_id, job_title, status, day_rate, created_at")
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ applications: data ?? [] });
}
