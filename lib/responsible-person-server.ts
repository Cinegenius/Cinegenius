import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { visibleLinkedProfileIds } from "@/lib/linked-profile-access";
import { bindResponsiblePerson, EMPTY_RESPONSIBLE_PERSON, responsiblePersonErrors, type StoredResponsiblePerson } from "@/lib/responsible-person";

export async function accountResponsiblePerson(userId: string) {
  try {
    const user = await (await clerkClient()).users.getUser(userId);
    return { ...EMPTY_RESPONSIBLE_PERSON, firstName: user.firstName ?? "", lastName: user.lastName ?? "" };
  } catch {
    // Prefilling is optional. Identity still comes from the verified session;
    // unavailable account names must not break the offer list or erase a draft.
    return { ...EMPTY_RESPONSIBLE_PERSON };
  }
}

/** IDs come only from authenticated ownership/access checks, never from a form. */
export async function validateResponsiblePerson(value: unknown, userId: string, company = false, required = true) {
  if (value === undefined && !required) return { person: undefined };
  if (!userId || (value && typeof value === "object" && "userId" in value && (value as { userId: unknown }).userId !== userId)) {
    const t = await getTranslations("responsiblePerson");
    return { response: NextResponse.json({ error: t("unauthorized"), field: "responsible_person" }, { status: 403 }) };
  }
  const input = value === undefined ? await accountResponsiblePerson(userId) : value;
  const errors = responsiblePersonErrors(input, company);
  if (Object.keys(errors).length && required) {
    const t = await getTranslations("responsiblePerson");
    return { response: NextResponse.json({ error: t("required"), fieldErrors: Object.fromEntries(Object.entries(errors).map(([field, key]) => [field, t(key)])), field: "responsible_person" }, { status: 400 }) };
  }
  return { person: bindResponsiblePerson(input, userId) };
}

export type PublicResponsiblePerson = { name: string; function: string; customFunction: string; href: string | null };
export async function publicResponsiblePerson(value: unknown, viewerId: string | null): Promise<PublicResponsiblePerson | null> {
  const v = value as StoredResponsiblePerson | null;
  if (!v?.public || !v.userId || Object.keys(responsiblePersonErrors(v, true)).some(key => key !== "function")) return null;
  const visible = await visibleLinkedProfileIds([v.userId], viewerId);
  const { data: profile } = visible.has(v.userId)
    ? await db.from("profiles").select("slug, user_id").eq("user_id", v.userId).maybeSingle()
    : { data: null };
  return { name: `${v.firstName} ${v.lastName}`, function: v.function, customFunction: v.customFunction, href: profile ? `/profile/${profile.slug || profile.user_id}` : null };
}

/** A former team member must not remain the delegated contact of a company. */
export async function responsibleForCompany(value: unknown, companyId: string, ownerId: string) {
  const person = value as StoredResponsiblePerson | null;
  if (!person?.userId) return null;
  if (person.userId === ownerId) return person;
  const { data, error } = await db.from("company_members").select("user_id")
    .eq("company_id", companyId).eq("user_id", person.userId).eq("status", "accepted").maybeSingle();
  return !error && data ? person : null;
}
