import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/applications/[id] — job owner accepts or rejects an application
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (status !== "accepted" && status !== "rejected") {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  // Load application and verify ownership
  const { data: application } = await supabaseAdmin
    .from("applications")
    .select("id, applicant_id, job_title, owner_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!application) return NextResponse.json({ error: "Bewerbung nicht gefunden" }, { status: 404 });
  if (application.owner_id !== userId) return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("applications")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the applicant
  await supabaseAdmin.from("notifications").insert({
    user_id: application.applicant_id,
    type: status === "accepted" ? "new_application" : "application_sent",
    title: status === "accepted" ? "Bewerbung angenommen!" : "Bewerbung abgelehnt",
    body: status === "accepted"
      ? `Deine Bewerbung für „${application.job_title}" wurde angenommen. Melde dich beim Auftraggeber.`
      : `Deine Bewerbung für „${application.job_title}" wurde leider nicht berücksichtigt.`,
    href: "/dashboard?tab=bookings",
  });

  return NextResponse.json({ success: true, status });
}
