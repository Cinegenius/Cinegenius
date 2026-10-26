import { clerkClient } from "@clerk/nextjs/server";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { compressProfileEditorDraft, expandProfileEditorDraft } from "@/lib/profile-editor-private-draft";
import { normalizeQuickStartDraft, QUICK_START_INTENTS, validateQuickStartDraft } from "@/lib/quick-start-flow";
import { clerkRateLimitSeconds } from "@/lib/onboarding-save";

export const runtime = "nodejs";

const KEY = "cinegeniusOnboarding";
const INTENTS = new Set(["crew", "location", "equipment", "talent", "search", "company"]);
const MAX_BYTES = 7000;

function rateLimitResponse(error: unknown) {
  const retryAfter = clerkRateLimitSeconds(error);
  return retryAfter === null ? null : NextResponse.json({ error: `Zu viele Speicheranfragen. Bitte versuche es in ${retryAfter} Sekunden erneut.`, retryAfter }, {
    status: 429, headers: { "Cache-Control": "private, no-store", "Retry-After": String(retryAfter) },
  });
}

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
    const draft = user.privateMetadata?.[KEY] && typeof user.privateMetadata[KEY] === "object"
      ? { ...(user.privateMetadata[KEY] as Record<string, unknown>) }
      : null;
    if (draft && typeof draft.profileEditorDraftEncoded === "string") {
      try {
        const decoded = expandProfileEditorDraft(draft.profileEditorDraftEncoded);
        draft.profileEditorDraft = decoded;
      } catch {
        return json({ error: "Der private Profilentwurf konnte nicht gelesen werden." }, 503);
      }
      delete draft.profileEditorDraftEncoded;
    }
    return json({ draft });
  } catch (error) {
    const limited = rateLimitResponse(error);
    if (limited) return limited;
    console.error("[onboarding GET] private progress could not be loaded", error);
    return json({ error: "Dein gespeicherter Fortschritt konnte nicht geladen werden." }, 503);
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const payload = await request.json().catch(() => null);
  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const isProfileEditorDraft = Boolean(record && Object.hasOwn(record, "profileEditorDraft"));
  const isLocationFormDraft = Boolean(record && Object.hasOwn(record, "locationFormDraft"));
  if (!record || (!isProfileEditorDraft && !isLocationFormDraft && !INTENTS.has(String(record.intent)))) {
    return json({ error: "Bitte wähle einen gültigen Einrichtungsweg aus." }, 400);
  }
  if (Object.hasOwn(record, "quickStart") && record.quickStart !== null) {
    const raw = record.quickStart;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return json({ error: "Dein Einrichtungsentwurf ist ungültig." }, 400);
    }
    const input = raw as Record<string, unknown>;
    const normalized = normalizeQuickStartDraft(input);
    if ((normalized.intents.length > 0 && !normalized.intents.includes(record.intent as typeof QUICK_START_INTENTS[number]))
      || ((input.version === 2 || input.version === 3) && typeof input.step !== "string")) {
      return json({ error: "Dein Einrichtungsentwurf passt nicht zur gewählten Aufgabe." }, 400);
    }
    const validation = normalized.step === "review" ? validateQuickStartDraft(normalized) : null;
    if (validation) {
      return json({ error: validation.message }, 400);
    }
    record.quickStart = normalized;
  }
  if (isLocationFormDraft) {
    const raw = record.locationFormDraft;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json({ error: "Der Locationentwurf ist ungültig." }, 400);
    const draft = raw as Record<string, unknown>;
    const imageUrls = draft.imageUrls;
    if (draft.version !== 1 || typeof draft.categoryId !== "string" || draft.categoryId.length > 80
      || !Array.isArray(imageUrls) || imageUrls.length > 20
      || imageUrls.some((url) => typeof url !== "string" || url.length > 2048)) {
      return json({ error: "Der Locationentwurf enthält ungültige Angaben oder zu viele Fotos." }, 400);
    }
  }
  const encoded = JSON.stringify(record);
  const maxIncomingBytes = isProfileEditorDraft ? 100_000 : MAX_BYTES;
  if (new TextEncoder().encode(encoded).byteLength > maxIncomingBytes) {
    return json({ error: "Der Entwurf ist zu umfangreich. Entferne einige optionale Angaben oder Bilder." }, 413);
  }
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(authResult.userId);
    const current = user.privateMetadata?.[KEY] && typeof user.privateMetadata[KEY] === "object"
      ? user.privateMetadata[KEY] as Record<string, unknown>
      : {};
    const next = { ...current, ...record } as Record<string, unknown>;
    if (isLocationFormDraft) next.locationFormDraftUpdatedAt = new Date().toISOString();
    if (isProfileEditorDraft) {
      const editorDraft = record.profileEditorDraft;
      if (!editorDraft || typeof editorDraft !== "object" || Array.isArray(editorDraft)) {
        return json({ error: "Der Profilentwurf ist ungültig." }, 400);
      }
      next.profileEditorDraftEncoded = compressProfileEditorDraft(editorDraft as Record<string, unknown>);
      next.profileEditorDraftUpdatedAt = new Date().toISOString();
      delete next.profileEditorDraft;
    }
    const incomingListing = record.listingDraft;
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
    if (typeof record.setupComplete === "boolean") {
      next.setupComplete = record.setupComplete;
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
    const limited = rateLimitResponse(error);
    if (limited) return limited;
    console.error("[onboarding PUT] private progress could not be saved", error);
    return json({ error: "Dein Fortschritt konnte nicht gespeichert werden. Bitte versuche es erneut." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  try {
    const clerk = await clerkClient();
    const requestedType = request.nextUrl.searchParams.get("type");
    if (requestedType === "quick-start") {
      // Clerk deep-merges metadata. Omission does not delete a nested key;
      // null does. One atomic patch also preserves unrelated private drafts.
      await clerk.users.updateUserMetadata(authResult.userId, {
        privateMetadata: { [KEY]: { quickStart: null, setupComplete: true } },
      });
      return json({ deleted: true, completed: true });
    }
    const user = await clerk.users.getUser(authResult.userId);
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
    } else if (current && requestedType === "profile-edit") {
      delete current.profileEditorDraft;
      delete current.profileEditorDraftEncoded;
      delete current.profileEditorDraftUpdatedAt;
      if (Object.keys(current).length) privateMetadata[KEY] = current;
      else delete privateMetadata[KEY];
    } else if (current && requestedType === "location-form") {
      delete current.locationFormDraft;
      delete current.locationFormDraftUpdatedAt;
      if (Object.keys(current).length) privateMetadata[KEY] = current;
      else delete privateMetadata[KEY];
    } else {
      delete privateMetadata[KEY];
    }
    await clerk.users.updateUserMetadata(authResult.userId, { privateMetadata });
    return json({ deleted: true });
  } catch (error) {
    const limited = rateLimitResponse(error);
    if (limited) return limited;
    console.error("[onboarding DELETE] private progress could not be cleared", error);
    return json({ error: "Der gespeicherte Einrichtungsfortschritt konnte nicht entfernt werden." }, 503);
  }
}
