
import { hasPlaceCity } from "@/lib/places/core";
export type ProfileSaveField = "name" | "city" | "activity";
export type ProfileSaveFieldErrors = Partial<Record<ProfileSaveField, string>>;

export function validateProfileSave(input: {
  name: string;
  city: string;
  positions: readonly string[];
  profileTypes: readonly string[];
}, translate?: (key: string) => string): ProfileSaveFieldErrors {
  const errors: ProfileSaveFieldErrors = {};
  if (!input.name.trim()) errors.name = translate ? translate("Ui.text_f08a575aecfb55") : "Bitte gib deinen Namen ein.";
  if (!hasPlaceCity(input.city)) errors.city = translate ? translate("Ui.text_a4789c8ce64209") : "Bitte gib deinen Standort ein.";
  if (input.positions.length === 0 && input.profileTypes.length === 0) {
    errors.activity = translate ? translate("Ui.text_f25450253ed66e") : "Bitte wähle mindestens eine Tätigkeit aus.";
  }
  return errors;
}
