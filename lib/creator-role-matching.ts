import { departments, getOccupationSearchTerms, type Department } from "@/lib/departments";
import { gripSearchTerms, normalizeOccupation } from "@/lib/gripTaxonomy";

export type CreatorRoleSource = {
  role: string;
  positions?: readonly string[];
};

type PreparedRoleMatch = {
  label: string;
  needles: string[];
  occupationTerms: string[];
  gripTerms: string[];
};

type PreparedCreatorMatch = {
  values: string[];
  occupationTerms: string[];
  gripTerms: string[];
};

function normalizeRole(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/\([^)]+\)/g, " ")
    .split(" / ")
    .map((value) => value.trim())
    .filter(Boolean);
}

function prepareRoleMatch(label: string): PreparedRoleMatch {
  return {
    label,
    needles: normalizeRole(label),
    occupationTerms: [...new Set(getOccupationSearchTerms(label).map(normalizeOccupation))],
    gripTerms: [...new Set(gripSearchTerms(label).map(normalizeOccupation))],
  };
}

function prepareCreatorMatch(creator: CreatorRoleSource): PreparedCreatorMatch {
  const values = [...(creator.positions ?? []), creator.role].flatMap(normalizeRole);
  return {
    values: [...new Set(values)],
    occupationTerms: [...new Set(values.flatMap((value) => getOccupationSearchTerms(value).map(normalizeOccupation)))],
    gripTerms: [...new Set(values.flatMap((value) => gripSearchTerms(value).map(normalizeOccupation)))],
  };
}

function termsMatch(needles: readonly string[], candidates: readonly string[]): boolean {
  return needles.some((needle) => candidates.some((candidate) =>
    needle === candidate ||
    (needle.length >= 4 && candidate.includes(needle)) ||
    (candidate.length >= 4 && needle.includes(candidate)),
  ));
}

function matchesPreparedRole(creator: PreparedCreatorMatch, role: PreparedRoleMatch): boolean {
  return termsMatch(role.occupationTerms, creator.occupationTerms) ||
    termsMatch(role.gripTerms, creator.gripTerms) ||
    termsMatch(role.needles, creator.values);
}

/** Match a profile's explicit positions and role against one department title. */
export function matchesCreatorRole(creator: CreatorRoleSource, roleLabel: string): boolean {
  return matchesPreparedRole(prepareCreatorMatch(creator), prepareRoleMatch(roleLabel));
}

/**
 * Find roles represented by the current directory. Precompute the static role
 * aliases once per call and normalize each profile once, instead of repeatedly
 * normalizing each creator × department-role pair during initial HTML render.
 */
export function findOccupiedCreatorRoles(
  creators: readonly CreatorRoleSource[],
  roleDepartments: readonly Department[] = departments,
): Set<string> {
  const preparedCreators = creators.map(prepareCreatorMatch);
  const roleMatchers = roleDepartments.flatMap((department) => department.roles.map(prepareRoleMatch));
  const occupied = new Set<string>();

  for (const role of roleMatchers) {
    if (occupied.has(role.label)) continue;
    if (preparedCreators.some((creator) => matchesPreparedRole(creator, role))) occupied.add(role.label);
  }

  return occupied;
}
