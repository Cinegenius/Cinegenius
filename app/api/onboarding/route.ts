import { clerkClient } from "@clerk/nextjs/server";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const KEY = "cinegeniusOnboarding";
const INTENTS = new Set(["location", "equipment", "talent", "search", "company"]);
const MAX_BYTES = 7000;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(authResult.userId);
    return json({ draft: user.privateMetadata?.[KEY] ?? null });
  } catch (error) {
    console.error("[onboarding GET] private progress could not be loaded", error);
    return json({ error: "Dein gespeicherter Fortschritt konnte nicht geladen werden." }, 503);
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || !INTENTS.has(payload.intent)) {
    return json({ error: "Bitte wähle einen gültigen Einrichtungsweg aus." }, 400);
  }
  const encoded = JSON.stringify(payload);
  if (new TextEncoder().encode(encoded).byteLength > MAX_BYTES) {
    return json({ error: "Der Entwurf ist zu umfangreich. Entferne einige optionale Angaben oder Bilder." }, 413);
  }
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(authResult.userId);
    const current = user.privateMetadata?.[KEY] && typeof user.privateMetadata[KEY] === "object"
      ? user.privateMetadata[KEY] as Record<string, unknown>
      : {};
    const next = { ...current, ...payload } as Record<string, unknown>;
    const incomingListing = (payload as Record<string, unknown>).listingDraft;
    if (incomingListing && typeof incomingListing === "object") {
      const listing = incomingListing as Record<string, unknown>;
      const type = listing.type;
      if (type === "location" || type === "equipment") {
        const legacy = current.listingDraft && typeof current.listingDraft === "object"
          ? current.listingDraft as Record<string, unknown>
          : null;
        const previous = current.listingDrafts && typeof current.listingDrafts === "object"
          ? current.listingDrafts as Record<string, unknown>
          : {};
        next.listingDrafts = {
          ...previous,
          ...(legacy && (legacy.type === "location" || legacy.type === "equipment") ? { [legacy.type]: legacy } : {}),
          [type]: listing,
        };
        delete next.listingDraft;
      }
    }
    if (typeof (payload as Record<string, unknown>).setupComplete === "boolean") {
      next.setupComplete = (payload as Record<string, unknown>).setupComplete;
    }
    const serialized = JSON.stringify(next);
    if (new TextEncoder().encode(serialized).byteLength > MAX_BYTES) {
      return json({ error: "Der gespeicherte Fortschritt ist zu umfangreich. Entferne optionale Angaben aus einem Entwurf." }, 413);
    }
    await clerk.users.updateUserMetadata(authResult.userId, {
      privateMetadata: { [KEY]: next },
    });
    return json({ saved: true });
  } catch (error) {
    console.error("[onboarding PUT] private progress could not be saved", error);
    return json({ error: "Dein Fortschritt konnte nicht gespeichert werden. Bitte versuche es erneut." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(authResult.userId);
    const requestedType = request.nextUrl.searchParams.get("type");
    const privateMetadata = { ...(user.privateMetadata ?? {}) };
    const current = privateMetadata[KEY] && typeof privateMetadata[KEY] === "object"
      ? { ...(privateMetadata[KEY] as Record<string, unknown>) }
      : null;
    if (current && (requestedType === "location" || requestedType === "equipment")) {
      const listingDrafts = current.listingDrafts && typeof current.listingDrafts === "object"
        ? { ...(current.listingDrafts as Record<string, unknown>) }
        : {};
      delete listingDrafts[requestedType];
      if (listingDrafts.location || listingDrafts.equipment) current.listingDrafts = listingDrafts;
      else delete current.listingDrafts;
      if (current.listingDraft && typeof current.listingDraft === "object" && (current.listingDraft as Record<string, unknown>).type === requestedType) delete current.listingDraft;
      if (Object.keys(current).length) privateMetadata[KEY] = current;
      else delete privateMetadata[KEY];
      current.setupComplete = true;
      privateMetadata[KEY] = current;
    } else if (current && requestedType === "company") {
      delete current.companyDraft;
      current.setupComplete = true;
      if (Object.keys(current).length) privateMetadata[KEY] = current;
      else delete privateMetadata[KEY];
    } else if (current && requestedType === "profile") {
      delete current.profileDraft;
      current.setupComplete = true;
      if (Object.keys(current).length) privateMetadata[KEY] = current;
      else delete privateMetadata[KEY];
    } else {
      delete privateMetadata[KEY];
    }
    await clerk.users.updateUserMetadata(authResult.userId, { privateMetadata });
    return json({ deleted: true });
  } catch (error) {
    console.error("[onboarding DELETE] private progress could not be cleared", error);
    return json({ error: "Der gespeicherte Einrichtungsfortschritt konnte nicht entfernt werden." }, 503);
  }
}
