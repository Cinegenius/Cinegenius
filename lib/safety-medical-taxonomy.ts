export const SAFETY_MEDICAL_DEPARTMENT_ID = "sicherheit-sanitaetsdienst";
export const SAFETY_MEDICAL_DEPARTMENT_LABEL = "Sicherheit & Sanitätsdienst";
export const SAFETY_MEDICAL_COMPANY_CATEGORY_ID = "sanitaetsdienst-brandschutz";

export type SafetyMedicalTranslator = (key: string) => string;

export function safetyMedicalCompanyCategoryLabel(
  id: string,
  fallback: string,
  t: SafetyMedicalTranslator,
) {
  return id === SAFETY_MEDICAL_COMPANY_CATEGORY_ID ? t("companyCategory") : fallback;
}

export const SAFETY_MEDICAL_DEPARTMENT_LABELS: Record<string, string> = {
  de: SAFETY_MEDICAL_DEPARTMENT_LABEL,
  en: "Safety & Medical Services",
  es: "Seguridad y servicios médicos",
  it: "Sicurezza e servizio sanitario",
  cs: "Bezpečnost a zdravotní služba",
  hu: "Biztonság és egészségügyi szolgálat",
};

export const SAFETY_MEDICAL_OCCUPATIONS = [
  { id: "set-medic", label: "Set-Sanitäter/in / Set Medic", labelEn: "Set Medic", aliases: ["Set Medic", "Medic / Set-Arzt", "Set-Arzt", "Production Medic", "On-Set Medic"] },
  { id: "rettungssanitaeter", label: "Rettungssanitäter/in", labelEn: "Emergency Medical Technician", aliases: ["Rettungssanitäter", "Rettungssanitäterin", "EMT", "Paramedic"] },
  { id: "betriebssanitaeter", label: "Betriebssanitäter/in", labelEn: "Occupational First Aid Medic", aliases: ["Betriebssanitäter", "Betriebssanitäterin", "Occupational Medic"] },
  { id: "brandwache", label: "Brandwache / Brandsicherheitswache", labelEn: "Fire Watch / Fire Safety Watch", aliases: ["Brandwache", "Brandsicherheitswache", "Fire Watch", "Fire Safety Watch", "Fire Safety Officer"] },
  { id: "brandschutzhelfer", label: "Brandschutzhelfer/in", labelEn: "Fire Safety Assistant", aliases: ["Brandschutzhelfer", "Brandschutzhelferin", "Fire Safety Assistant"] },
  { id: "brandschutzbeauftragte", label: "Brandschutzbeauftragte/r", labelEn: "Fire Safety Officer", aliases: ["Brandschutzbeauftragter", "Brandschutzbeauftragte", "Fire Protection Officer"] },
] as const;

export const SAFETY_MEDICAL_ROLE_LABELS: Record<string, Record<string, string>> = {
  "Set-Sanitäter/in / Set Medic": { en: "Set Medic", es: "Sanitario/a de rodaje / Set Medic", it: "Sanitario/a di set / Set Medic", cs: "Zdravotník/zdravotnice na place / Set Medic", hu: "Forgatási egészségügyi szakember / Set Medic" },
  "Rettungssanitäter/in": { en: "Emergency Medical Technician", es: "Técnico/a en emergencias sanitarias", it: "Soccorritore/trice", cs: "Zdravotnický záchranář / záchranářka", hu: "Mentőszakápoló" },
  "Betriebssanitäter/in": { en: "Occupational First Aid Medic", es: "Sanitario/a de empresa", it: "Addetto/a al primo soccorso aziendale", cs: "Podnikový zdravotník / zdravotnice", hu: "Üzemi elsősegélynyújtó" },
  "Brandwache / Brandsicherheitswache": { en: "Fire Watch / Fire Safety Watch", es: "Vigilancia de incendios", it: "Sorveglianza antincendio", cs: "Požární hlídka", hu: "Tűzőrség" },
  "Brandschutzhelfer/in": { en: "Fire Safety Assistant", es: "Auxiliar de protección contra incendios", it: "Addetto/a antincendio", cs: "Pomocník/pomocnice požární ochrany", hu: "Tűzvédelmi segítő" },
  "Brandschutzbeauftragte/r": { en: "Fire Safety Officer", es: "Responsable de protección contra incendios", it: "Responsabile antincendio", cs: "Technik/technička požární ochrany", hu: "Tűzvédelmi megbízott" },
};

export const SAFETY_MEDICAL_COMPANY_SERVICES = [
  { id: "set-medical", label: "Set-Sanitätsdienst / Set Medic" },
  { id: "emergency-medical", label: "Rettungs- und Sanitätsdienst" },
  { id: "occupational-medical", label: "Betriebssanitätsdienst" },
  { id: "fire-watch", label: "Brandwache / Brandsicherheitswache" },
  { id: "fire-safety", label: "Brandschutzunterstützung und -beratung" },
] as const;

export const SAFETY_MEDICAL_LEGACY_REFERENCES = [
  { roleId: `set-logistik/${encodeURIComponent("Medic / Set-Arzt")}`, departmentId: "set-logistik", targetLabel: "Set-Sanitäter/in / Set Medic" },
  { roleId: `set-logistik/${encodeURIComponent("Fire Safety Officer")}`, departmentId: "set-logistik", targetLabel: "Brandwache / Brandsicherheitswache" },
] as const;

export function safetyMedicalSearchTerms(query: string): boolean {
  const q = query.trim().toLocaleLowerCase("de");
  return ["sanität", "sanitaet", "set medic", "rettung", "betriebssan", "brandwache", "brandsicherheit", "brandschutz", "fire watch", "fire safety", "paramedic", "emt"].some(term => q.includes(term));
}

export function safetyMedicalProfileValues(query: string): string[] {
  if (!safetyMedicalSearchTerms(query)) return [];
  return [...new Set(SAFETY_MEDICAL_OCCUPATIONS.flatMap(role => [role.label, role.labelEn, ...role.aliases]))];
}
