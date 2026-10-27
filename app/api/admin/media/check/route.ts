import { db } from "@/lib/db";
import { protectedMediaKey, PROTECTED_MEDIA_BUCKET } from "@/lib/protected-media";
import { readableProtectedMedia } from "@/lib/protected-media-server";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl || rawUrl.length > 2048) return NextResponse.json({ error: "Bildadresse fehlt oder ist zu lang." }, { status: 400 });
  const privateKey = protectedMediaKey(rawUrl);
  if (privateKey) {
    // Inspect existence and current rights, never return private file bytes or
    // grant a platform admin implicit access to another person's private media.
    const asset = await db.from("media_assets").select("storage_path").eq("storage_path", privateKey).maybeSingle();
    if (asset.error) return NextResponse.json({ status: "connection_error" }, { headers: { "Cache-Control": "private, no-store" } });
    if (!asset.data) return NextResponse.json({ status: "missing_file" }, { headers: { "Cache-Control": "private, no-store" } });
    const slash = privateKey.lastIndexOf("/");
    const name = privateKey.slice(slash + 1);
    const files = await db.storage.from(PROTECTED_MEDIA_BUCKET).list(privateKey.slice(0, slash), { search: name, limit: 10 });
    if (files.error) return NextResponse.json({ status: "connection_error" }, { headers: { "Cache-Control": "private, no-store" } });
    if (!files.data?.some((file) => file.name === name)) return NextResponse.json({ status: "missing_file" }, { headers: { "Cache-Control": "private, no-store" } });
    try {
      const permitted = await readableProtectedMedia(rawUrl, admin.userId);
      return NextResponse.json({ status: permitted ? "reachable" : "access_problem", protected: true }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
      return NextResponse.json({ status: "connection_error" }, { headers: { "Cache-Control": "private, no-store" } });
    }
  }
  let candidate: URL;
  try { candidate = new URL(rawUrl); } catch { return NextResponse.json({ status: "invalid_reference" }); }
  if (candidate.protocol !== "https:") return NextResponse.json({ status: "unsupported_reference", message: "Nur HTTPS-Bildadressen werden geprüft." });

  const trustedStorage = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let storageHost = "";
  try { storageHost = trustedStorage ? new URL(trustedStorage).host : ""; } catch { /* configuration is absent */ }
  const trustedClerkImage = candidate.hostname === "img.clerk.com" || candidate.hostname.endsWith(".clerk.com");
  if (!storageHost || (candidate.host !== storageHost && !trustedClerkImage)) {
    return NextResponse.json({ status: "external_reference", message: "Externe Bildquelle; aus Sicherheitsgründen nicht automatisch abgerufen." });
  }

  try {
    const response = await fetch(candidate, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (response.status >= 200 && response.status < 300) return NextResponse.json({ status: "reachable", httpStatus: response.status, contentType: response.headers.get("content-type") });
    if (response.status === 401 || response.status === 403) return NextResponse.json({ status: "access_problem", httpStatus: response.status });
    if (response.status === 404 || response.status === 410) return NextResponse.json({ status: "missing_file", httpStatus: response.status });
    return NextResponse.json({ status: "http_error", httpStatus: response.status });
  } catch {
    return NextResponse.json({ status: "connection_error", message: "Bildquelle antwortet nicht innerhalb von fünf Sekunden." });
  }
}
