import { db } from "@/lib/db";
import { assertOwner, requireAuth } from "@/lib/guards";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { slug } = await context.params;
  const { data: company, error: lookupError } = await db.from("companies")
    .select("id, owner_user_id, published")
    .eq("slug", slug)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Das Firmenprofil konnte nicht geladen werden." }, { status: 500 });
  if (!company) return NextResponse.json({ error: "Firmenprofil nicht gefunden." }, { status: 404 });
  const ownershipError = assertOwner(company.owner_user_id, authResult.userId);
  if (ownershipError) return ownershipError;
  if (company.published) return NextResponse.json({ published: true, alreadyPublished: true });

  const { error } = await db.from("companies").update({ published: true, updated_at: new Date().toISOString() })
    .eq("id", company.id).eq("owner_user_id", authResult.userId).eq("published", false);
  if (error) return NextResponse.json({ error: "Das Firmenprofil konnte nicht veröffentlicht werden." }, { status: 500 });
  revalidateTag("companies", { expire: 0 });
  revalidateTag("profiles", { expire: 0 });
  revalidatePath("/");
  revalidatePath("/companies");
  revalidatePath(`/companies/${slug}`);
  return NextResponse.json({ published: true });
}
