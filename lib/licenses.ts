// ─── Strukturiertes Lizenzsystem für CineGenius ──────────────────────────────
// Keine Freitexteingabe für Standardlizenzen.
// Jede Lizenz ist einer Kategorie zugeordnet.

export type LicenseCategory = {
  id: string;
  label: string;
  icon: string; // emoji for category header
  items: string[];
};

export const LICENSE_CATEGORIES: LicenseCategory[] = [
  {
    id: "strassenfahrzeuge",
    label: "Straßenfahrzeuge",
    icon: "🚗",
    items: [
      "AM – Mofa / Leichtkraftrad",
      "A1 – Motorrad bis 125 ccm",
      "A2 – Motorrad bis 35 kW",
      "A – Motorrad (unbeschränkt)",
      "B – PKW",
      "B96 – PKW mit Anhänger (bis 4.250 kg)",
      "BE – PKW mit Anhänger",
      "C1 – LKW bis 7,5 t",
      "C1E – LKW bis 7,5 t mit Anhänger",
      "C – LKW über 7,5 t",
      "CE – LKW mit Anhänger",
      "D1 – Kleinbus bis 16 Sitze",
      "D – Bus",
      "DE – Bus mit Anhänger",
      "L – Landwirtschaftliche Zugmaschine",
      "T – Traktor",
    ],
  },
  {
    id: "set-maschinen",
    label: "Bau- & Setmaschinen",
    icon: "🏗️",
    items: [
      "Gabelstapler",
      "Teleskopstapler",
      "Bagger",
      "Radlader",
      "Kran (mobil)",
      "Turmdrehkran",
      "Hubarbeitsbühne / Steiger",
      "Scherenbühne",
    ],
  },
  {
    id: "film-spezial",
    label: "Film- & Speziallizenzen",
    icon: "🎬",
    items: [
      "Drohnenpilot A1/A3 (Open Category)",
      "Drohnenpilot A2 (Open Category)",
      "Drohnenpilot Specific Category",
      "FPV Drohnenpilot",
      "Kamerakran / Technocrane",
      "Rigging Zertifikat",
      "Pyrotechnik",
      "Waffen-Sachkunde (Film)",
      "SFX Lizenz",
      "Stunt Rigging",
    ],
  },
  {
    id: "luftfahrzeuge",
    label: "Luftfahrzeuge",
    icon: "✈️",
    items: [
      "PPL – Privatpilotenlizenz",
      "CPL – Berufspilotenlizenz",
      "ATPL – Verkehrspilotenlizenz",
      "Helikopter-Lizenz",
      "Ultraleichtflug (UL)",
      "Segelflug",
    ],
  },
  {
    id: "wasserfahrzeuge",
    label: "Wasserfahrzeuge",
    icon: "⛵",
    items: [
      "Sportbootführerschein Binnen",
      "Sportbootführerschein See",
      "SKS – Sportküstenschifferschein",
      "SSS – Sportseeschifferschein",
      "Jetski / PWC Lizenz",
    ],
  },
  {
    id: "sicherheit",
    label: "Sicherheit & Zusatzqualifikationen",
    icon: "🦺",
    items: [
      "Erste Hilfe / Set Medic",
      "Brandschutzbeauftragter",
      "PSA-Zertifikat (Schutzausrüstung)",
      "Höhenarbeit",
      "Absturzsicherung",
      "Elektriker-Zertifikat",
      "Generatorbetrieb",
    ],
  },
];

// Flat list for search
export const ALL_LICENSES: { category: string; label: string }[] = LICENSE_CATEGORIES.flatMap(
  (cat) => cat.items.map((item) => ({ category: cat.label, label: item }))
);
