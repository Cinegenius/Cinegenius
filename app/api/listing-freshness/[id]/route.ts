import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { trustedMutationOrigin } from "@/lib/request-origin";
import { isAppLocale } from "@/lib/i18n/locales";
import { actOnListingFreshness, getListingFreshness, ListingFreshnessError } from "@/lib/listing-freshness-server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
function privateJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
function failure(error: unknown) {
  return error instanceof ListingFreshnessError
    ? privateJson({ code: error.code }, error.status)
    : privateJson({ code: "unavailable" }, 503);
}
function privateAuth(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(_request: NextRequest, { params }: Context) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return privateAuth(auth);
  try {
    const { id } = await params;
    return privateJson(await getListingFreshness(id, auth.userId));
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return privateAuth(auth);
  if (!trustedMutationOrigin({
    requestUrl: request.url, origin: request.headers.get("origin"), referer: request.headers.get("referer"),
    development: process.env.NODE_ENV !== "production", deploymentHost: process.env.VERCEL_URL,
  })) return privateJson({ code: "forbidden" }, 403);
  let body: unknown;
  try { body = await request.json(); } catch { return privateJson({ code: "invalid" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return privateJson({ code: "invalid" }, 400);
  const input = body as Record<string, unknown>;
  if ((input.action !== "renew" && input.action !== "end")
    || !Number.isInteger(input.version) || (input.version as number) < 0
    || !Number.isInteger(input.cycle) || (input.cycle as number) < 0
    || typeof input.requestId !== "string"
    || (input.locale !== undefined && !isAppLocale(input.locale))) return privateJson({ code: "invalid" }, 400);
  try {
    const { id } = await params;
    return privateJson(await actOnListingFreshness({
      id, userId: auth.userId, action: input.action, version: input.version as number,
      cycle: input.cycle as number, requestId: input.requestId,
      ...(isAppLocale(input.locale) ? { locale: input.locale } : {}),
    }));
  } catch (error) { return failure(error); }
}
