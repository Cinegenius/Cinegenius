import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

const PLACEMENT = "home";
const AD_FIELDS = "id, user_id, advertiser_name, placement, headline, description, cta_label, destination_url, image_url, starts_at, ends_at, active, created_at";

function isValidHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isListingImageUrl(value: unknown, userId: string): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || url.origin !== new URL(supabaseUrl).origin) return false;
    const bucketPrefix = "/storage/v1/object/public/listing-images/";
    const assetPath = url.pathname.split(bucketPrefix)[1];
    return !!assetPath && assetPath.startsWith(`${userId}/`);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const mine = req.nextUrl.searchParams.get("mine") === "true";

  if (mine) {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { data, error } = await db
      .from("ad_campaigns")
      .select(AD_FIELDS)
      .eq("user_id", authResult.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: "Anzeigen konnten nicht geladen werden." }, { status: 503 });
    return NextResponse.json({ ads: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("ad_campaigns")
    .select("id, advertiser_name, placement, headline, description, cta_label, destination_url, image_url, starts_at, ends_at")
    .eq("active", true)
    .eq("placement", PLACEMENT)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("created_at", { ascending: true })
    .limit(20);
  // During setup, the banner stays on its free-to-use placeholder until the
  // ad_campaigns migration has been applied.
  if (error) return NextResponse.json({ ads: [] }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ads: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { allowed } = await rateLimit(`ad-campaign:${userId}`, 3, 86_400);
  if (!allowed) return NextResponse.json({ error: "Du kannst höchstens drei Anzeigen pro Tag erstellen." }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });

  const advertiserName = typeof body.advertiser_name === "string" ? body.advertiser_name.trim() : "";
  const headline = typeof body.headline === "string" ? body.headline.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const ctaLabel = typeof body.cta_label === "string" ? body.cta_label.trim() : "";
  const destinationUrl = typeof body.destination_url === "string" ? body.destination_url.trim() : "";
  const imageUrl = body.image_url;

  if (advertiserName.length < 1 || advertiserName.length > 80) return NextResponse.json({ error: "Bitte gib einen Namen mit maximal 80 Zeichen an." }, { status: 400 });
  if (headline.length < 1 || headline.length > 90) return NextResponse.json({ error: "Die Überschrift darf höchstens 90 Zeichen lang sein." }, { status: 400 });
  if (description.length < 1 || description.length > 180) return NextResponse.json({ error: "Der Beschreibungstext darf höchstens 180 Zeichen lang sein." }, { status: 400 });
  if (ctaLabel.length < 1 || ctaLabel.length > 28) return NextResponse.json({ error: "Der Buttontext darf höchstens 28 Zeichen lang sein." }, { status: 400 });
  if (!isValidHttpsUrl(destinationUrl)) return NextResponse.json({ error: "Bitte gib einen sicheren Link mit https:// an." }, { status: 400 });
  if (!isListingImageUrl(imageUrl, userId)) return NextResponse.json({ error: "Bitte lade ein Bannerbild über das Formular hoch." }, { status: 400 });

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { data, error } = await db
    .from("ad_campaigns")
    .insert({
      user_id: userId,
      advertiser_name: advertiserName,
      placement: PLACEMENT,
      headline,
      description,
      cta_label: ctaLabel,
      destination_url: destinationUrl,
      image_url: imageUrl,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      active: true,
    })
    .select(AD_FIELDS)
    .single();

  if (error) {
    console.error("[ads POST]", error);
    return NextResponse.json({ error: "Die Anzeigenfunktion ist noch nicht vollständig eingerichtet. Bitte versuche es später erneut." }, { status: 503 });
  }

  return NextResponse.json({ ad: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Anzeigen-ID fehlt." }, { status: 400 });

  const { data, error } = await db
    .from("ad_campaigns")
    .delete()
    .eq("id", id)
    .eq("user_id", authResult.userId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Anzeige konnte nicht entfernt werden." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Anzeige nicht gefunden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
