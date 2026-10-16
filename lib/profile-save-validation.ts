export type ProfileSaveField = "name" | "city" | "activity";
export type ProfileSaveFieldErrors = Partial<Record<ProfileSaveField, string>>;

export function validateProfileSave(input: {
  name: string;
  city: string;
  positions: readonly string[];
  profileTypes: readonly string[];
}): ProfileSaveFieldErrors {
  const errors: ProfileSaveFieldErrors = {};
  if (!input.name.trim()) errors.name = "Bitte gib deinen Namen ein.";
  if (!input.city.trim()) errors.city = "Bitte gib deinen Standort ein.";
  if (input.positions.length === 0 && input.profileTypes.length === 0) {
    errors.activity = "Bitte wähle mindestens eine Tätigkeit aus.";
  }
  return errors;
}
