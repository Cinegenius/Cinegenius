import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "node:crypto";
import { PROTECTED_MEDIA_BUCKET } from "@/lib/protected-media";
import { requireEditorialAgent, editorialHeaders, editorialOrganizationAllowed } from "@/lib/editorial-agent-server";

export async function GET(request: NextRequest) {
  const actor = await requireEditorialAgent(request);
  if (actor instanceof NextResponse) return actor;
  const organizationId = request.nextUrl.searchParams.get("organizationId") ?? "";
  if (!await editorialOrganizationAllowed(organizationId)) return NextResponse.json({ error: "editorial_forbidden" }, { status: 403, headers: editorialHeaders });
  const { data: entry, error } = await db.from("organization_entries").select("image_url").eq("id", request.nextUrl.searchParams.get("entryId")).eq("organization_id", organizationId).eq("author_user_id", actor.userId).maybeSingle();
  if (error) return new NextResponse(null, { status: 503, headers: editorialHeaders });
  if (!entry?.image_url) return new NextResponse(null, { status: 404, headers: editorialHeaders });
  try {
    // Recheck the actual canonical parent and uploader before any storage access.
    const { data: asset, error: assetError } = await db.from("media_assets").select("storage_path,mime_type,content_sha256").eq("reference_url", entry.image_url).eq("source_type", "organization_entry").eq("source_id", request.nextUrl.searchParams.get("entryId")).eq("owner_user_id", actor.userId).maybeSingle();
    if (assetError || !asset) return new NextResponse(null, { status: 404, headers: editorialHeaders });
    const { data: image, error: storageError } = await db.storage.from(PROTECTED_MEDIA_BUCKET).download(asset.storage_path);
    if (storageError || !image) return new NextResponse(null, { status: 503, headers: editorialHeaders });
    const bytes = new Uint8Array(await image.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== asset.content_sha256) return new NextResponse(null, { status: 503, headers: editorialHeaders });
    return new NextResponse(bytes, { headers: { ...editorialHeaders, "Content-Type": asset.mime_type, "X-Content-SHA256": hash, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch { return new NextResponse(null, { status: 503, headers: editorialHeaders }); }
}
