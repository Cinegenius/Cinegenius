import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { contactId } from "@/lib/contact-connections";
import { contactJson, mutateContact } from "@/lib/contact-mutations";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireAuth();
  if (member instanceof NextResponse) return member;
  const t = await getTranslations("Contacts");
  if (!(await rateLimit(`contact-change:${member.userId}`, 40, 60)).allowed) return contactJson({ error: t("rateLimited") }, 429);
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!contactId.test(id) || !body) return contactJson({ error: t("invalid") }, 400);
  if (body.accountId !== undefined && body.accountId !== member.userId) return contactJson({ error: t("changed") }, 409);
  if (body.action === "collab") {
    if ((body.label !== null && body.label !== undefined && typeof body.label !== "string")
      || (body.label?.length ?? 0) > 120 || typeof body.is_public !== "boolean") return contactJson({ error: t("invalid") }, 400);
    return mutateContact(member.userId, "collab", { id, label: body.label ?? null, isPublic: body.is_public });
  }
  if (!["accepted", "rejected"].includes(body.status)) return contactJson({ error: t("invalid") }, 400);
  return mutateContact(member.userId, body.status, { id });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireAuth();
  if (member instanceof NextResponse) return member;
  const t = await getTranslations("Contacts");
  const account = req.headers.get("X-Contact-Account");
  if (account && account !== member.userId) return contactJson({ error: t("changed") }, 409);
  if (!(await rateLimit(`contact-change:${member.userId}`, 40, 60)).allowed) return contactJson({ error: t("rateLimited") }, 429);
  const { id } = await params;
  if (!contactId.test(id)) return contactJson({ error: t("invalid") }, 400);
  return mutateContact(member.userId, "remove", { id });
}
