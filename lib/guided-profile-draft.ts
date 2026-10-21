import { departments, getProfileTypesForDepartment } from "@/lib/departments";
import { PROFILE_TYPE_LABELS, type ProfileType } from "@/lib/profile-types";

export type GuidedProfileDraft = {
  step: number;
  name: string;
  city: string;
  /** Non-department profile types retained for legacy drafts and casting roles. */
  types: string[];
  departmentIds: string[];
  positions: string[];
  bio: string;
};

export const START_GUIDED_PROFILE_DRAFT: GuidedProfileDraft = {
  step: 1, name: "", city: "", types: [], departmentIds: [], positions: [], bio: "",
};

const profileTypeIds = new Set(Object.keys(PROFILE_TYPE_LABELS));
const oldWizardTypeToDepartment: Record<string, string> = {
  camera: "kamera", grip: "grip", lighting: "licht", sound: "ton", director: "regie",
  editor: "post", makeup: "maske", costume: "kostuem", production: "produktion", photographer: "foto",
};
const oldWizardTalentPosition: Record<string, string> = {
  actor: "Schauspieler", model: "Model", extra: "Komparse",
};

export function normalizeGuidedProfileDraft(value: Partial<GuidedProfileDraft> & { gripPositions?: string[]; types?: string[] }): GuidedProfileDraft {
  const { gripPositions: _legacyGripPositions, ...currentValues } = value;
  void _legacyGripPositions;
  const rawTypes = Array.isArray(value.types) ? value.types : [];
  const departmentIds = new Set(Array.isArray(value.departmentIds) ? value.departmentIds : []);
  const types: string[] = [];
  const positions = [...new Set([
    ...(Array.isArray(value.positions) ? value.positions : []),
    ...(Array.isArray(value.gripPositions) ? value.gripPositions : []),
  ])];

  for (const type of rawTypes) {
    const legacyTalentPosition = oldWizardTalentPosition[type];
    if (legacyTalentPosition) {
      departmentIds.add("cast");
      if (!positions.includes(legacyTalentPosition)) positions.push(legacyTalentPosition);
      continue;
    }
    const departmentId = oldWizardTypeToDepartment[type];
    if (departmentId) departmentIds.add(departmentId);
    else if (profileTypeIds.has(type)) types.push(type);
  }

  for (const department of departments) {
    if (department.roles.some((role) => positions.includes(role))) departmentIds.add(department.id);
  }
  if ((value.gripPositions?.length ?? 0) > 0) departmentIds.add("grip");

  return {
    ...START_GUIDED_PROFILE_DRAFT,
    ...currentValues,
    step: Math.max(1, Math.min(4, Number(value.step) || 1)),
    types: [...new Set(types)],
    departmentIds: [...departmentIds].filter((id) => departments.some((department) => department.id === id)),
    positions,
  };
}

export function removeGuidedDepartment(draft: GuidedProfileDraft, departmentId: string): GuidedProfileDraft {
  const department = departments.find((item) => item.id === departmentId);
  if (!department) return draft;
  const departmentIds = draft.departmentIds.filter((id) => id !== departmentId);
  const remainingRoleLabels = new Set(departmentIds.flatMap((id) => departments.find((item) => item.id === id)?.roles ?? []));
  const positions = draft.positions.filter((position) => !department.roles.includes(position) || remainingRoleLabels.has(position));
  const castTypes: string[] = ["actor", "model", "extra", "stunt", "voiceover", "host"];
  return {
    ...draft,
    departmentIds,
    positions,
    types: draft.types.filter((type) => !(departmentId === "cast" && castTypes.includes(type))),
  };
}

export function getGuidedProfileTypes(draft: GuidedProfileDraft): ProfileType[] {
  const selectedTypes = new Set(draft.types.filter((type): type is ProfileType => profileTypeIds.has(type)));
  for (const departmentId of draft.departmentIds) {
    const department = departments.find((item) => item.id === departmentId);
    if (!department) continue;
    const selectedRoles = department.roles.filter((role) => draft.positions.includes(role));
    for (const type of getProfileTypesForDepartment(departmentId, selectedRoles)) selectedTypes.add(type);
  }
  return [...selectedTypes];
}
