/** Display-only labels for stable profile IDs. Unknown legacy/member values stay
 * intact; translated labels are never storage identities or filter values. */
export const PROFILE_TRAIT_MESSAGE_KEYS = {
  hair: {
    black: 'hairBlack', dark_brown: 'hairDarkBrown', brown: 'hairBrown',
    light_brown: 'hairLightBrown', blonde: 'hairBlonde', light_blonde: 'hairLightBlonde',
    red: 'hairRed', grey: 'hairGrey', white: 'hairWhite', dyed: 'hairDyed',
  },
  eyes: {
    brown: 'eyesBrown', dark_brown: 'eyesDarkBrown', green: 'eyesGreen',
    blue_green: 'eyesBlueGreen', blue: 'eyesBlue', grey: 'eyesGrey',
    hazel: 'eyesHazel', black: 'eyesBlack',
  },
  body: {
    slim: 'bodySlim', athletic: 'bodyAthletic', normal: 'bodyNormal',
    strong: 'bodyStrong', muscular: 'bodyMuscular', curvy: 'bodyCurvy',
  },
  travel: {
    none: 'travelNone', regional: 'travelRegional', national: 'travelNational',
    european: 'travelEuropean', worldwide: 'travelWorldwide',
  },
} as const;

export type ProfileTrait = keyof typeof PROFILE_TRAIT_MESSAGE_KEYS;
export type ProfileTraitTranslator = (key: string) => string;

export function profileTraitLabel(kind: ProfileTrait, value: string, translate: ProfileTraitTranslator): string {
  const keys: Readonly<Record<string, string>> = PROFILE_TRAIT_MESSAGE_KEYS[kind];
  return Object.hasOwn(keys, value) ? translate(keys[value]) : value;
}

export function profileTraitOptions(kind: ProfileTrait, values: readonly string[], translate: ProfileTraitTranslator, locale: string) {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  return [...new Set(values)].map(value => ({ value, label: profileTraitLabel(kind, value, translate) }))
    .sort((left, right) => collator.compare(left.label, right.label) || left.value.localeCompare(right.value));
}

/** Match the existing directory/API precedence without rewriting the profile. */
export function profileTravelValue(profile: { availability_config?: { travel?: unknown } | null; travel_ready?: boolean | null }): string {
  const value = profile.availability_config?.travel;
  return typeof value === 'string' ? value : profile.travel_ready ? 'national' : '';
}
