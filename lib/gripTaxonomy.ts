/**
 * Shared German/international grip and camera-support occupation catalogue.
 * Titles vary by country and production; aliases aid discovery and are not
 * assertions that every market uses the titles interchangeably.
 */
export type GripOccupation = {
  id: string;
  label: string;
  labelEn: string;
  aliases: readonly string[];
  description: string;
  seniority?: "junior" | "senior" | "lead";
};

export const GRIP_DEPARTMENT_LABEL = "Kamerabühne / Grip";

const LEGACY_GRIP_ROLE_IDS: Record<string, string> = {
  "1-kamerabuhne": "key-grip",
  "2-kamerabuhne": "best-boy-grip",
  "u-crane": "u-crane-operator",
  "stabilized-remote-head": "remote-head-technician",
  "kamera-drohnen-pilot": "kamera-drohnen-operator",
  "kamerabuhne-praktikant": "grip-intern",
};

export function normalizeGripDepartmentId(value: string | null): string | null {
  return value === "kamerabuhne" ? "grip" : value;
}

export function normalizeGripRoleId(value: string | null): string | null {
  return value ? LEGACY_GRIP_ROLE_IDS[value] ?? value : value;
}

export const GRIP_OCCUPATIONS: readonly GripOccupation[] = [
  {
    id: "key-grip",
    label: "Key Grip",
    labelEn: "Key Grip",
    aliases: ["1. Kamerabühne", "1st Camera Grip", "Kamerabühnenmeister*in", "Head Grip"],
    description: "Leitet die Kamerabühne und verantwortet Kameraunterstützung, Rigging und sichere Bewegungsaufbauten.",
    seniority: "lead",
  },
  {
    id: "best-boy-grip",
    label: "Best Boy Grip / 2. Kamerabühne",
    labelEn: "Best Boy Grip / 2nd Camera Grip",
    aliases: ["Best Boy Grip", "Grip Best", "2nd Camera Grip", "2. Kamerabühne"],
    description: "Unterstützt die Leitung der Kamerabühne; genaue Zuständigkeiten unterscheiden sich nach Land und Produktion.",
    seniority: "senior",
  },
  {
    id: "dolly-grip",
    label: "Dolly Grip / Dollyfahrer*in",
    labelEn: "Dolly Grip / Dolly Operator",
    aliases: ["Dolly Grip", "Dollyfahrer", "Dollyfahrerin", "Dollyfahrer*in", "Dolly Operator", "Dolly Grip Operator"],
    description: "Richtet Kameradolly und Schienen ein und führt kontrollierte Kamerafahrten aus.",
  },
  {
    id: "grip",
    label: "Grip / Kamerabühne",
    labelEn: "Grip",
    aliases: ["Grips", "Kamerabühne", "Kamerabühnencrew", "Camera Grip"],
    description: "Baut und betreut Halterungen, Stative, Schienen und andere mechanische Kameraunterstützung.",
  },
  {
    id: "kamerabuhnen-assistent",
    label: "Kamerabühnenassistenz",
    labelEn: "Grip Assistant",
    aliases: ["Camera Grip Assistant", "Kamerabühnenassistent*in", "Grip Assistant"],
    description: "Assistiert beim Vorbereiten, Sichern und Umbauen der Kamerabühnenausrüstung.",
    seniority: "junior",
  },
  {
    id: "rigging-grip",
    label: "Rigging Grip",
    labelEn: "Rigging Grip",
    aliases: ["Rigging Kamerabühne", "Rigging Grip Technician"],
    description: "Bereitet mechanische Kameraaufbauten und Rigging vor, häufig vor dem Dreh oder an wechselnden Sets.",
  },
  {
    id: "rigging-key-grip",
    label: "Rigging Key Grip",
    labelEn: "Rigging Key Grip",
    aliases: ["Key Rigging Grip", "Rigging Grip Supervisor"],
    description: "Leitet den Rigging-Bereich der Kamerabühne; diese eigene Zuständigkeit wird vor allem in größeren Produktionen geführt.",
    seniority: "lead",
  },
  {
    id: "rigging-best-boy-grip",
    label: "Rigging Best Boy Grip",
    labelEn: "Rigging Best Boy Grip",
    aliases: ["Rigging Grip Best", "Rigging Best Boy"],
    description: "Koordiniert die Assistenz und Abläufe im Rigging-Grip-Team, sofern die Produktion diese Position ausweist.",
    seniority: "senior",
  },
  {
    id: "special-grip-constructions",
    label: "Spezialkonstruktionen (Kamerabühne)",
    labelEn: "Special Grip Constructions",
    aliases: ["Spezial Konstruktionen", "Special Constructions"],
    description: "Entwickelt oder baut besondere mechanische Kameraaufbauten für einen konkreten Dreh.",
  },
  {
    id: "kran-operator",
    label: "Kamera-Kran- / Jib-Operator*in",
    labelEn: "Camera Crane / Jib Operator",
    aliases: ["Kran-Operator", "Crane Operator", "Jib Operator", "Kamerakranoperator*in", "Kamerakran Operator"],
    description: "Bedient Kamera-Kräne oder Jibs. Zuständigkeit und erforderliche Qualifikation hängen vom System und Einsatzort ab.",
  },
  {
    id: "camera-crane-technician",
    label: "Kamerakran-Techniker*in",
    labelEn: "Camera Crane Technician",
    aliases: ["Crane Technician", "Kamerakran-Techniker", "Kamerakran Techniker"],
    description: "Richtet Kamera-Kransysteme technisch ein und unterstützt deren sichere Nutzung; nicht automatisch gleichbedeutend mit Operator.",
  },
  {
    id: "u-crane-operator",
    label: "U-Crane / Technocrane Operator*in",
    labelEn: "U-Crane / Technocrane Operator",
    aliases: ["U-Crane Operator", "Technocrane Operator"],
    description: "Spezialisierte Bedienung eines teleskopischen Kamera-Kransystems.",
  },
  {
    id: "remote-head-technician",
    label: "Remote-Head-Techniker*in / -Operator*in",
    labelEn: "Remote Head Technician / Operator",
    aliases: ["Remote Head Technician", "Remote Head Operator", "Stabilized Remote Head Technician"],
    description: "Richtet oder bedient fernsteuerbare Kameraköpfe; je nach Produktion als technische oder operative Spezialfunktion geführt.",
  },
  {
    id: "grip-intern",
    label: "Praktikant*in Kamerabühne / Grip",
    labelEn: "Grip Intern",
    aliases: ["Kamerabühne Praktikant*in", "Camera Grip Intern"],
    description: "Unterstützt das Kamerabühnen-Team im Rahmen eines Praktikums.",
    seniority: "junior",
  },
];

export function normalizeOccupation(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("de").replace(/[^a-z0-9]+/g, " ").trim();
}

export function findGripOccupation(value: string): GripOccupation | undefined {
  const normalized = normalizeOccupation(value);
  return GRIP_OCCUPATIONS.find((occupation) =>
    [occupation.label, occupation.labelEn, ...occupation.aliases]
      .some((candidate) => normalizeOccupation(candidate) === normalized),
  );
}

/** Returns the canonical display title and regional/search aliases for a grip title. */
export function gripSearchTerms(value: string): string[] {
  const occupation = findGripOccupation(value);
  return occupation
    ? [...new Set([occupation.label, occupation.labelEn, ...occupation.aliases])]
    : [value];
}

export function matchesGripOccupation(value: string, term: string): boolean {
  const valueTerms = gripSearchTerms(value).map(normalizeOccupation);
  const searchTerms = gripSearchTerms(term).map(normalizeOccupation);
  return searchTerms.some((searchTerm) => valueTerms.some((valueTerm) =>
    valueTerm === searchTerm ||
    (searchTerm.length >= 4 && valueTerm.includes(searchTerm)) ||
    (valueTerm.length >= 4 && searchTerm.includes(valueTerm)),
  ));
}

export function isGripDepartmentSearch(value: string): boolean {
  const normalized = normalizeOccupation(value);
  return ["grip", "kamerabuhne", "camera grip", "camera support"]
    .some((term) => normalized.includes(normalizeOccupation(term)));
}

export function isGripOccupation(value: string): boolean {
  return Boolean(findGripOccupation(value));
}

export function buildGuidedGripProfileOccupations(
  selectedTypes: readonly string[],
  labelsByType: Readonly<Record<string, string | undefined>>,
  selectedGripPositions: readonly string[],
): { profileTypes: string[]; positions: string[] } {
  return {
    profileTypes: [...new Set(selectedTypes.map((type) => type === "grip" ? "camera" : type))],
    positions: [...new Set([
      ...selectedTypes.map((type) => type === "grip" ? GRIP_DEPARTMENT_LABEL : labelsByType[type]).filter((label): label is string => Boolean(label)),
      ...selectedGripPositions,
    ])],
  };
}
