import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { unifiedSearchAccess } from "@/lib/unified-search-access";
import { rateLimit } from "@/lib/rateLimit";
import { nativeDiscoveryForAccount } from "@/lib/native-smart-discovery-server";
import { NATIVE_DISCOVERY_CONTRACT } from "@/lib/native-smart-discovery";
import { isDiscoverySeed } from "@/lib/discovery-seed";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    // The app marker/endpoint/header never grants Smart or map permissions.
    if (!unifiedSearchAccess(user.userId, process.env.ADMIN_USER_IDS).canReadResults) return json({ error: "in_development" }, 403);
    if (request.headers.get("X-CineGenius-Native-Discovery") !== NATIVE_DISCOVERY_CONTRACT) return json({ error: "invalid_request" }, 400);
    if (request.headers.get("X-Native-Account") !== user.userId) return json({ error: "account_changed" }, 409);
    const params = new URL(request.url).searchParams;
    const seed = params.get("seed") ?? undefined;
    if ([...params.keys()].some(key => !["focus", "seed"].includes(key)) || params.getAll("focus").length > 1 || params.getAll("seed").length > 1
      || (seed !== undefined && !isDiscoverySeed(seed)) || (params.has("focus") && !["profile", "neutral"].includes(params.get("focus")!))) return json({ error: "invalid_request" }, 400);
    if (!(await rateLimit(`unified-search:${user.userId}`, 40, 60)).allowed) return json({ error: "rate_limited" }, 429);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
    return json(await nativeDiscoveryForAccount(user.userId, await getLocale(), params.get("focus") === "neutral" ? "neutral" : "profile", signal, seed));
  } catch { return json({ error: "unavailable" }, 503); }
}
