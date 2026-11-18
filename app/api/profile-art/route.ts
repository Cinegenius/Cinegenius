import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { runProfileArtReservation } from "@/lib/profile-art-reservations-server";
import { readArtStream, withArtDeadline } from "@/lib/profile-art-io";

function json(body: unknown, status = 200) {
  const response = NextResponse.json(body, {status});
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const t = await getTranslations("ExclusiveProfileArt");
  if (request.headers.get("X-Profile-Account") !== session.userId) return json({error: t("error")}, 409);
  const limit = await rateLimit(`profile-art:${session.userId}`, 40, 60);
  if (!limit.allowed) return json({error: t("error")}, 429);
  let input: unknown;
  try {
    input = await withArtDeadline(async signal => JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(await readArtStream(request.body, 2048, signal))), request.signal, 5000);
  } catch { return json({error: t("error")}, 400); }
  const result = await runProfileArtReservation(input, session.userId);
  if (!result.ok) return json({error: t(result.code === "ART_EXPIRED" ? "expired" : "error"), code: result.code}, result.status);
  return json({data: result.data});
}
