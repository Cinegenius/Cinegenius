import { normalizeQuickStartDraft, validateQuickStartDraft } from "./quick-start-flow";

type SavedSetup = { setupComplete?: boolean; quickStart?: unknown; intent?: string; companyDraft?: unknown; profileDraft?: unknown } | null;
export type SetupReminder = { title: string; description: string; href: string };

/** One contextual reminder; optional profile enrichment never causes a reminder. */
export function getSetupReminder(hasProfile: boolean, saved: SavedSetup): SetupReminder | null {
  if (saved?.setupComplete) return null;
  if (hasProfile && !saved?.quickStart) return null;
  if (saved?.quickStart) {
    const draft = normalizeQuickStartDraft(saved.quickStart);
    const error = validateQuickStartDraft(draft);
    const personal = draft.intents.includes("crew") || draft.intents.includes("talent");
    const names: Record<string, string> = {
      name: "dein Name", personCity: "dein Ort", personCountry: "dein Land", goals: "deine gewünschte Nutzung",
      "crew-departments": "dein Gewerk", "crew-roles": "deine Tätigkeit", "talent-roles": "deine Tätigkeit",
      "company-title": "der Firmenname", "company-city": "der Firmenstandort", "company-categories": "die Branche",
      "location-category": "die Locationart", "location-title": "der Name der Location", "location-city": "der Standort der Location",
      "equipment-category": "die Angebotskategorie", "equipment-title": "der Name des Angebots", "equipment-city": "der Angebotsstandort",
    };
    return {
      title: personal && !hasProfile ? "Dein Profil ist noch nicht öffentlich sichtbar." : "Deine Einrichtung ist noch nicht abgeschlossen.",
      description: error && names[error.field]
        ? `Es fehlt noch ${names[error.field]}. Deine bisherigen Eingaben bleiben gespeichert.`
        : "Deine Eingaben sind privat gespeichert. Prüfe sie und schließe die Einrichtung ausdrücklich ab.",
      href: "/profile-setup?resume=1",
    };
  }
  const legacy = saved?.intent;
  const href = legacy === "company" ? "/company-setup?onboarding=1&resume=1"
    : legacy === "talent" ? "/guided-profile?resume=1"
      : legacy === "location" || legacy === "equipment" ? `/guided-listing?type=${legacy}&resume=1`
        : "/profile-setup";
  return { title: "Dein Konto ist erstellt. Deine Einrichtung ist noch offen.", description: "Wähle, ob du suchen oder dich, deine Firma oder ein Angebot präsentieren möchtest.", href };
}
