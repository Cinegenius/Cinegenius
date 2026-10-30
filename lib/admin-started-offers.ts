import { normalizeQuickStartDraft } from "@/lib/quick-start-flow";

/** Minimal admin summaries only. Never project raw recovery data, contacts or media. */
export const OFFER_RECOVERY_KEYS = ["listing:new", "company:new", "guided:location", "guided:equipment"] as const;
export type StartedOfferKind = "location" | "marketplace" | "company" | "animal" | "job";
export type OfferRecoveryRow = { user_id: string; form_key: string; draft_data: unknown; updated_at: string };
export type StartedOffer = { id: string; userId: string; kind: StartedOfferKind; title: string; editUrl: string; updatedAt: string | null };
const sources = ["listing:new", "company:new", "guided:location", "guided:equipment", "setup:location", "setup:equipment", "setup:company", "legacy:location", "legacy:equipment", "legacy:company", "legacy:location-form"] as const;
type Source = typeof sources[number];
export function draftRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 200) : "";
export function startedOfferId(userId: string, source: Source) { return `${userId}~${source}`; }
export function parseStartedOfferId(id: string) {
  const [userId, source, extra] = id.split("~");
  return !extra && /^user_[A-Za-z0-9]{1,100}$/.test(userId) && sources.includes(source as Source) ? { userId, source: source as Source } : null;
}
function kindForListing(draft: Record<string, unknown>): StartedOfferKind | null {
  const category = text(draft.categoryId);
  if (category.startsWith("loc_")) return "location";
  if (category.startsWith("tier_")) return "animal";
  if (category.startsWith("job_")) return "job";
  if (category.startsWith("mk_") || text(draftRecord(draft.marketplace).category)) return "marketplace";
  // Selecting a section alone does not create an offer (nor does a crew form).
  return null;
}
function meaningful(draft: Record<string, unknown>, company = false) {
  return Boolean(text(company ? draft.name : draft.title) || text(draft.description) || text(draft.category)
    || text(draft.logoUrl) || text(draft.imageUrl) || (Array.isArray(draft.imageUrls) && draft.imageUrls.length)
    || (Array.isArray(draft.selectedCategories) && draft.selectedCategories.length));
}
export function startedOffersForAccount(userId: string, metadata: unknown, rows: OfferRecoveryRow[]): StartedOffer[] {
  const progress = draftRecord(draftRecord(metadata).cinegeniusOnboarding);
  const own = new Map(rows.filter(row => row.user_id === userId && OFFER_RECOVERY_KEYS.includes(row.form_key as typeof OFFER_RECOVERY_KEYS[number])).map(row => [row.form_key, row]));
  const offers: StartedOffer[] = [];
  const add = (source: Source, kind: StartedOfferKind, draft: Record<string, unknown>, editUrl: string, date: unknown) => {
    const title = text(kind === "company" ? draft.name ?? draft.title : draft.title);
    offers.push({ id: startedOfferId(userId, source), userId, kind, title, editUrl,
      updatedAt: typeof date === "string" && Number.isFinite(Date.parse(date)) ? date : null });
  };
  for (const row of own.values()) {
    const draft = draftRecord(row.draft_data);
    if (!Object.keys(draft).length) continue; // Includes completion/discard tombstones.
    if (row.form_key === "company:new" && meaningful(draft, true)) add("company:new", "company", draft, "/company-setup?onboarding=1", row.updated_at);
    else if (row.form_key === "listing:new") {
      const kind = kindForListing(draft);
      if (kind) add("listing:new", kind, draftRecord(draft.form), "/inserat", row.updated_at);
    } else if (row.form_key.startsWith("guided:") && meaningful(draft)) {
      const location = row.form_key === "guided:location";
      add(row.form_key as Source, location ? "location" : "marketplace", draft, `/guided-listing?type=${location ? "location" : "equipment"}`, row.updated_at);
    }
  }
  const quick = draftRecord(normalizeQuickStartDraft(progress.quickStart));
  const sections = draftRecord(quick.sections);
  const completed = draftRecord(quick.completed);
  const completedListings = draftRecord(completed.listings);
  for (const intent of ["location", "equipment", "company"] as const) {
    const section = draftRecord(sections[intent]);
    const finished = intent === "company" ? completed.company : completedListings[intent];
    if (Array.isArray(quick.intents) && quick.intents.includes(intent) && !finished && meaningful(section)) {
      add(`setup:${intent}`, intent === "equipment" ? "marketplace" : intent, section, "/profile-setup?resume=1", progress.updatedAt);
    }
    const legacy = intent === "company" ? draftRecord(progress.companyDraft)
      : draftRecord(draftRecord(progress.listingDrafts)[intent] ?? (draftRecord(progress.listingDraft).type === intent ? progress.listingDraft : null));
    const shadowed = intent === "company" ? own.has("company:new") : own.has(`guided:${intent}`);
    if (!shadowed && meaningful(legacy, intent === "company")) {
      add(`legacy:${intent}`, intent === "equipment" ? "marketplace" : intent, legacy,
        intent === "company" ? "/company-setup?onboarding=1" : `/guided-listing?type=${intent}`, progress.updatedAt);
    }
  }
  const oldLocation = draftRecord(progress.locationFormDraft);
  if (!own.has("listing:new") && oldLocation.version === 1 && text(oldLocation.categoryId) && meaningful(draftRecord(oldLocation.form))) {
    add("legacy:location-form", "location", draftRecord(oldLocation.form), "/inserat", progress.locationFormDraftUpdatedAt);
  }
  // Mirrored copies from the old and current onboarding writers are one reminder target.
  return offers.filter((offer, index) => !offers.slice(0, index).some(previous => previous.kind === offer.kind && previous.title === offer.title));
}

