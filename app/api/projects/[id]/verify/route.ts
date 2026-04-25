import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// POST /api/projects/[id]/verify — admin only, toggles verified flag
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const verified = body.verified !== false; // default true

  const { error } = await db
    .from("projects")
    .update({ verified, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag("profiles");
  revalidateTag("projects");
  return NextResponse.json({ success: true, verified });
}
