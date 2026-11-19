import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { trustedMutationOrigin } from "@/lib/request-origin";
import { isIP } from "node:net";
import { translationRequest } from "@/lib/content-translation";
import { recheckTranslation, translateContent } from "@/lib/content-translation-server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: {
  "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie, Accept-Language", "X-Content-Type-Options": "nosniff", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store",
}});
export async function POST(request: Request) {
  // Same-origin Web and installed WebView use the same endpoint and Clerk session.
  if (!trustedMutationOrigin({requestUrl: request.url, origin: request.headers.get("origin"), referer: request.headers.get("referer"), development: process.env.NODE_ENV === "development", deploymentHost: process.env.VERCEL_URL})) return json({code: "invalid_origin"}, 403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) return json({code: "invalid_request"}, 400);
  if (process.env.CONTENT_TRANSLATION_ENABLED !== "true") return json({code: "unavailable"}, 503);
  const {userId} = await auth();
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45000)]);
  const ipHeader = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") : null;
  const ip = ipHeader && isIP(ipHeader.trim()) ? ipHeader.trim() : "shared";
  const key = createHash("sha256").update("content-translation:" + new Date().toISOString().slice(0,10) + ":" + (userId ?? ip)).digest("hex");
  if (!(await rateLimit("content-translation:read:" + key, 120, 60)).allowed) return json({code: "rate_limited"}, 429);
  let input: ReturnType<typeof translationRequest> = null;
  try {
    if (Number(request.headers.get("content-length")) > 4096 || !request.body) return json({code: "invalid_request"}, 413);
    const reader = request.body.getReader();
    const cancelBody = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", cancelBody, {once: true});
    let bytes = 0, body = "";
    const decoder = new TextDecoder("utf-8", {fatal: true});
    try {
      while (true) {
        signal.throwIfAborted();
        const chunk = await reader.read();
        signal.throwIfAborted();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 4096) return json({code: "invalid_request"}, 413);
        body += decoder.decode(chunk.value, {stream: true});
      }
      body += decoder.decode();
    } finally { signal.removeEventListener("abort", cancelBody); await reader.cancel().catch(() => {}); }
    input = translationRequest(JSON.parse(body));
  } catch { return json({code: "invalid_request"}, 400); }
  if (!input) return json({code: "invalid_request"}, 400);
  const values = input;
  const output = await Promise.all(values.items.map(async ref => {
    try { return await translateContent(ref, values.locale, userId, key, signal); }
    catch { return null; }
  }));
  const checked = await Promise.all(output.map(async item => {
    try { return await recheckTranslation(item, userId, signal); } catch { return null; }
  }));
  return json({locale: values.locale, items: checked.filter(Boolean)});
}
