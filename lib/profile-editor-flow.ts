export const PROFILE_EDITOR_STEPS = [
  { id: 1, title: "Was möchtest du anbieten?", description: "Wähle die Bereiche aus, in denen du gefunden werden möchtest." },
  { id: 2, title: "Welche Tätigkeiten passen zu dir?", description: "Suche nach einem Beruf oder wähle zuerst ein Gewerk. Mehrere Tätigkeiten sind möglich." },
  { id: 3, title: "Wie heißt du und wo arbeitest du?", description: "Name und Standort sind die Pflichtangaben für dein öffentliches Profil." },
  { id: 4, title: "Fotos und kurze Vorstellung", description: "Dieser Schritt ist freiwillig. Du kannst ihn überspringen und später ergänzen." },
  { id: 5, title: "Weitere passende Angaben", description: "Ergänze bei Bedarf Verfügbarkeit, Erfahrungen und weitere Angaben zu deinen Tätigkeiten." },
  { id: 6, title: "Prüfen und speichern", description: "Kontrolliere deine Angaben. Erst der Abschluss übernimmt Änderungen in dein öffentliches Profil." },
] as const;

export type ProfileEditorStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type ProfileEditorErrorField = "activity" | "name" | "city";

export function profileEditorStepForErrors(fields: readonly ProfileEditorErrorField[]): ProfileEditorStep {
  if (fields.includes("activity")) return 1;
  if (fields.includes("name") || fields.includes("city")) return 3;
  return 6;
}

export function profileEditorStepForHint(key: string): ProfileEditorStep {
  if (key === "type" || key === "role") return key === "type" ? 1 : 2;
  if (key === "name" || key === "city") return 3;
  if (key === "avatar" || key === "photos" || key === "bio") return 4;
  return 5;
}

export function profileEditorRequiredMissing(input: {
  name: string;
  city: string;
  positions: readonly string[];
  profileTypes: readonly string[];
}) {
  return [
    ...(input.profileTypes.length || input.positions.length ? [] : ["activity" as const]),
    ...(input.name.trim() ? [] : ["name" as const]),
    ...(input.city.trim() ? [] : ["city" as const]),
  ];
}

export function shouldResumeProfileEditorDraft(input: {
  profileExists: boolean;
  draftUpdatedAt: string | null | undefined;
  profileUpdatedAt: string | null | undefined;
}) {
  if (!input.profileExists) return true;
  const draftTime = Date.parse(input.draftUpdatedAt ?? "");
  const profileTime = Date.parse(input.profileUpdatedAt ?? "");
  return Number.isFinite(draftTime) && Number.isFinite(profileTime) && draftTime > profileTime;
}
