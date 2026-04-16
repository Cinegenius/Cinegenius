// ─── Single Source of Truth: Category-specific fields ────────────────────────
// Used by:
//   - app/inserat/page.tsx  → renders dynamic form fields per category
//   - app/props/PropsContent.tsx → renders dynamic search filters per dept

export type PropFieldDef = {
  key: string;
  label: string;
  type: "select" | "text";
  options?: string[];
  placeholder?: string;
};

export type CategoryFieldConfig = {
  fields: PropFieldDef[];
};

// Keys match: form item id stripped of "mk_" prefix  AND  DEPARTMENTS deptId
export const PROP_CATEGORY_FIELDS: Record<string, CategoryFieldConfig> = {

  kostuem: {
    fields: [
      {
        key: "size",
        label: "Größe",
        type: "select",
        options: ["XS", "S", "M", "L", "XL", "XXL", "Einheitsgröße"],
      },
      {
        key: "gender",
        label: "Für",
        type: "select",
        options: ["Damen", "Herren", "Unisex", "Kinder"],
      },
      {
        key: "era",
        label: "Epoche",
        type: "select",
        options: [
          "Modern", "1990er", "1980er", "1970er", "1960er", "1950er",
          "Viktorianisch", "Mittelalter", "Antike", "Fantasy / Sci-Fi",
        ],
      },
      {
        key: "style",
        label: "Stil",
        type: "select",
        options: [
          "Alltagskleidung", "Business", "Abendgarderobe",
          "Uniform", "Sportswear", "Historisch", "Sonstiges",
        ],
      },
    ],
  },

  kamera: {
    fields: [
      {
        key: "camera_type",
        label: "Kameratyp",
        type: "select",
        options: [
          "Kinokamera", "DSLR / DSLM", "Camcorder",
          "Actioncam", "360° / VR", "Spezialkamera",
        ],
      },
      {
        key: "sensor_format",
        label: "Sensorformat",
        type: "select",
        options: ["Super 35", "Full Frame", "Super 16", "Micro Four Thirds", "1 Zoll", "Sonstiges"],
      },
      {
        key: "mount",
        label: "Bajonett / Mount",
        type: "select",
        options: ["PL", "LPL", "EF", "Sony E", "MFT", "Nikon F/Z", "Sonstiges"],
      },
      {
        key: "resolution",
        label: "Auflösung",
        type: "select",
        options: ["HD", "2K", "4K", "6K", "8K", "12K+"],
      },
      {
        key: "max_fps",
        label: "Max. FPS",
        type: "select",
        options: ["25 fps", "50 fps", "60 fps", "120 fps", "240+ fps"],
      },
    ],
  },

  licht: {
    fields: [
      {
        key: "light_type",
        label: "Lichttyp",
        type: "select",
        options: [
          "LED Panel", "Fresnel", "HMI", "Tungsten",
          "Tube Light", "Softbox / Diffusion", "Praktisches Licht", "Stroboskop / Effektlicht",
        ],
      },
      {
        key: "wattage",
        label: "Leistung",
        type: "select",
        options: ["bis 200 W", "200–500 W", "500 W – 1 kW", "1–2 kW", "2–5 kW", "über 5 kW"],
      },
      {
        key: "color_temp",
        label: "Farbtemperatur",
        type: "select",
        options: ["Tageslicht (5600 K)", "Tungsten (3200 K)", "Bi-Color", "RGB / Tunable"],
      },
      {
        key: "dimmer",
        label: "Dimmer",
        type: "select",
        options: ["Ja", "Nein"],
      },
      {
        key: "dmx",
        label: "DMX-fähig",
        type: "select",
        options: ["Ja", "Nein"],
      },
    ],
  },

  ton: {
    fields: [
      {
        key: "audio_type",
        label: "Typ",
        type: "select",
        options: [
          "Richtrohrmikrofon", "Lavalier / Clip", "Field Recorder",
          "Wireless Set", "Mischpult", "Kopfhörer", "Zubehör",
        ],
      },
      {
        key: "wireless",
        label: "Funkstrecke",
        type: "select",
        options: ["Ja", "Nein"],
      },
      {
        key: "channels",
        label: "Kanäle",
        type: "select",
        options: ["Mono", "Stereo", "4-Kanal", "8-Kanal+"],
      },
    ],
  },

  grip: {
    fields: [
      {
        key: "grip_type",
        label: "Typ",
        type: "select",
        options: [
          "Stativ / Tripod", "Slider", "Dolly", "Jib / Crane",
          "Gimbal", "C-Stands / Sandsäcke", "Kamerawagen", "Rigging-Equipment", "Sonstiges",
        ],
      },
      {
        key: "payload",
        label: "Max. Tragkraft",
        type: "select",
        options: ["bis 5 kg", "5–10 kg", "10–20 kg", "über 20 kg"],
      },
    ],
  },

  requisiten: {
    fields: [
      {
        key: "era",
        label: "Epoche / Stil",
        type: "select",
        options: [
          "Modern", "1990er", "1980er", "1970er", "1960er",
          "1950er", "Vintage / Antik", "Mittelalter", "Historisch", "Fantasy / Sci-Fi",
        ],
      },
      {
        key: "material",
        label: "Material",
        type: "select",
        options: ["Holz", "Metall", "Kunststoff", "Stoff / Leder", "Glas / Keramik", "Papier / Karton", "Gemischt"],
      },
    ],
  },

  moebel: {
    fields: [
      {
        key: "furniture_style",
        label: "Stil",
        type: "select",
        options: ["Modern", "Industrial", "Vintage / Retro", "Klassisch", "Rustikal", "Minimalistisch", "Luxus"],
      },
      {
        key: "material",
        label: "Material",
        type: "select",
        options: ["Holz", "Metall", "Stoff / Polster", "Kunststoff", "Glas", "Gemischt"],
      },
      {
        key: "era",
        label: "Epoche",
        type: "select",
        options: ["Modern", "1990er", "1980er", "1970er", "1960er", "Vintage", "Antik"],
      },
    ],
  },

  maske: {
    fields: [
      {
        key: "makeup_type",
        label: "Typ",
        type: "select",
        options: [
          "Standard Make-up", "HD / Airbrush", "SFX Make-up",
          "Prothesen", "Perücken / Haare", "Body Paint", "Komplett-Kit",
        ],
      },
      {
        key: "includes_products",
        label: "Enthält Produkte",
        type: "select",
        options: ["Ja — Kit mit Produkten", "Nein — nur Equipment"],
      },
    ],
  },

  fotoequipment: {
    fields: [
      {
        key: "camera_type",
        label: "Kameratyp",
        type: "select",
        options: [
          "DSLR", "Mirrorless / DSLM", "Mittelformat",
          "Analogfilm", "Studioblitz", "Licht-Modifier", "Stativ / Support",
        ],
      },
      {
        key: "mount",
        label: "Bajonett / Mount",
        type: "select",
        options: ["Canon EF/RF", "Sony E", "Nikon F/Z", "Fuji X", "MFT", "Keines"],
      },
      {
        key: "megapixel",
        label: "Auflösung",
        type: "select",
        options: ["bis 24 MP", "24–50 MP", "über 50 MP", "Analog"],
      },
    ],
  },

  backdrops: {
    fields: [
      {
        key: "backdrop_type",
        label: "Typ",
        type: "select",
        options: [
          "Greenscreen", "Bluescreen", "Papierhintergrund",
          "Muslin / Stoff", "Vinyl / Bedruckt", "LED Wall",
        ],
      },
      {
        key: "backdrop_size",
        label: "Maße",
        type: "select",
        options: ["bis 2×2 m", "2×3 m", "3×5 m", "4×6 m", "5×8 m+", "Auf Anfrage"],
      },
      {
        key: "color",
        label: "Farbe / Muster",
        type: "text",
        placeholder: "z.B. Weiß, Grau, Schwarz, Marmoroptik",
      },
    ],
  },

  produktion: {
    fields: [
      {
        key: "prod_type",
        label: "Typ",
        type: "select",
        options: [
          "Walkie Talkies", "Set-Möbel", "Zelte / Shelter",
          "Monitore / PA", "Catering-Equipment", "Cases / Transport",
          "Strom / Generator", "Sonstiges",
        ],
      },
    ],
  },

  contentsets: {
    fields: [
      {
        key: "content_type",
        label: "Typ",
        type: "select",
        options: [
          "Flat Lay Set", "Lifestyle-Studio", "Ring Light Set",
          "Green Screen Set", "Podcast / Interview Set", "Product Display", "Sonstiges",
        ],
      },
      {
        key: "platform",
        label: "Optimal für",
        type: "select",
        options: [
          "Instagram / Reels", "TikTok", "YouTube",
          "Podcast", "E-Commerce", "Alle Plattformen",
        ],
      },
    ],
  },

};
