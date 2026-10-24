import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";

const TYPES = new Set(["profiles", "companies", "listings", "projects"]);
const toUrls = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item.trim()];
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const url = [row.url, row.src, row.image_url].find((entry) => typeof entry === "string" && entry.trim());
      return typeof url === "string" ? [url.trim()] : [];
    }
    return [];
  });
};

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const params = request.nextUrl.searchParams;
  const type = params.get("type") ?? "profiles";
  if (!TYPES.has(type)) return NextResponse.json({ error: "Ungültige Medienquelle." }, { status: 400 });
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = 25;
  const range = [(page - 1) * pageSize, page * pageSize - 1] as const;

  let query;
  if (type === "profiles") query = db.from("profiles").select("user_id, display_name, slug, avatar_url, cover_image_url, profile_images, portfolio_images, updated_at", { count: "exact" }).order("updated_at", { ascending: false }).range(...range);
  else if (type === "companies") query = db.from("companies").select("id, slug, name, logo_url, cover_url, portfolio_images, published, updated_at", { count: "exact" }).order("updated_at", { ascending: false }).range(...range);
  else if (type === "listings") query = db.from("listings").select("id, title, type, image_url, extra_images, floor_plan_url, published, created_at", { count: "exact" }).order("created_at", { ascending: false }).range(...range);
  else query = db.from("projects").select("id, title, poster_url, images, updated_at", { count: "exact" }).order("updated_at", { ascending: false }).range(...range);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "Medienverweise konnten nicht geladen werden." }, { status: 500 });
  const entities = (data ?? []).map((record: Record<string, unknown>) => {
    const id = String(record.id ?? record.user_id ?? "");
    const title = String(record.display_name ?? record.name ?? record.title ?? "Ohne Bezeichnung");
    const urls = type === "profiles"
      ? [record.avatar_url, record.cover_image_url, ...toUrls(record.profile_images), ...toUrls(record.portfolio_images)]
      : type === "companies"
        ? [record.logo_url, record.cover_url, ...toUrls(record.portfolio_images)]
        : type === "listings"
          ? [record.image_url, ...toUrls(record.extra_images), record.floor_plan_url]
          : [record.poster_url, ...toUrls(record.images)];
    const media = [...new Set(urls.filter((url): url is string => typeof url === "string" && url.trim().length > 0))];
    return { id, title, slug: record.slug ?? null, published: type === "projects" ? true : record.published ?? null, media };
  });
  return NextResponse.json({ entities, total: count ?? 0, page, pageSize, type }, { headers: { "Cache-Control": "private, no-store" } });
}
