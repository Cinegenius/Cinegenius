import { requireAdmin } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { isProjectId } from "@/lib/project-record";
import { setProjectVerification } from "@/lib/project-verification-server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const t = await getTranslations();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!isProjectId(id) || typeof body?.verified !== "boolean" || !(typeof body.expectedUpdatedAt === "string" || body.expectedUpdatedAt === null)) {
    return NextResponse.json({ error: t("System.m_0e4698bf4051") }, { status: 400 });
  }
  const result = await setProjectVerification({ projectId: id, actorUserId: admin.userId, verified: body.verified,
    expectedUpdatedAt: body.expectedUpdatedAt, reason: t(body.verified ? "projects.verifyAuditReason" : "projects.unverifyAuditReason") });
  if (result.kind !== "success") return NextResponse.json({ error: t(result.kind === "conflict" ? "projects.reviewChanged" : "System.requestFailed") }, { status: result.kind === "conflict" ? 409 : result.kind === "missing" ? 404 : 503 });
  revalidatePath(`/projects/${id}`);
  revalidateTag("projects", { expire: 0 });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
