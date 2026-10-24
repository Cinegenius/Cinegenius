import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { getPrivateProfileIds } from "@/lib/trust";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80).replace(/[%,()]/g, " ").trim();
  const type = request.nextUrl.searchParams.get("type");
  if (query.length < 2 || (type !== "person" && type !== "company")) {
    return NextResponse.json({ results: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (type === "person") {
    const { data, error } = await db.from("profiles")
      .select("user_id, display_name, slug, avatar_url")
      .ilike("display_name", `%${query}%`)
      .not("display_name", "is", null)
      .order("display_name", { ascending: true })
      .limit(30);
    if (error) return NextResponse.json({ error: "Profile konnten nicht gesucht werden." }, { status: 500 });
    const rows = data ?? [];
    const privateIds = await getPrivateProfileIds(rows.map((profile) => profile.user_id));
    return NextResponse.json({ results: rows.filter((profile) => !privateIds.has(profile.user_id)).map((profile) => ({
      id: profile.user_id,
      kind: "person",
      label: profile.display_name,
      detail: profile.slug ? `Profil: ${profile.slug}` : "Öffentliches CineGenius-Profil",
      imageUrl: profile.avatar_url,
    })) }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const { data: companies, error } = await db.from("companies")
    .select("id, name, slug, city, logo_url, owner_user_id")
    .eq("published", true)
    .ilike("name", `%${query}%`)
    .order("name", { ascending: true })
    .limit(30);
  if (error) return NextResponse.json({ error: "Firmen konnten nicht gesucht werden." }, { status: 500 });
  const ownerIds = [...new Set((companies ?? []).map((company) => company.owner_user_id).filter(Boolean))];
  const { data: owners } = ownerIds.length
    ? await db.from("profiles").select("user_id").in("user_id", ownerIds)
    : { data: [] as { user_id: string }[] };
  const validOwners = new Set((owners ?? []).map((owner) => owner.user_id));
  return NextResponse.json({ results: (companies ?? []).filter((company) => company.slug && validOwners.has(company.owner_user_id)).map((company) => ({
    id: company.id,
    kind: "company",
    label: company.name,
    detail: company.city || "Öffentliches Firmenprofil",
    imageUrl: company.logo_url,
  })) }, { headers: { "Cache-Control": "private, no-store" } });
}
