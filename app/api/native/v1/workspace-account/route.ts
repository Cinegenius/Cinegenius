import { getCurrentUser } from "@/lib/auth";
import { nativeWorkspaceAccount } from "@/lib/native-workspace-account-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

/** Read-only projection for the existing account-bound native Workspace. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
    return json(await nativeWorkspaceAccount(user.userId, signal));
  } catch {
    return json({ error: "unavailable" }, 503);
  }
}
