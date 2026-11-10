/** Shared stable room IDs from the existing location editor. Labels never become stored IDs. */
export const LOCATION_ROOMS: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  "Wohnen": [
    ["living_room", "Wohnzimmer"], ["bedroom", "Schlafzimmer"], ["dining_room", "Esszimmer"],
    ["kitchen_room", "Küche"], ["bathroom", "Badezimmer"], ["home_office", "Arbeitszimmer"],
    ["garden", "Garten"], ["garage", "Garage"], ["basement", "Keller"],
    ["attic", "Dachboden"], ["balcony", "Balkon / Terrasse"], ["pool", "Pool"],
  ],
  "Villa": [
    ["living_room", "Wohnzimmer"], ["bedroom", "Schlafzimmer"], ["dining_room", "Esszimmer"],
    ["kitchen_room", "Küche"], ["bathroom", "Badezimmer"], ["garden", "Garten"],
    ["garage", "Garage"], ["pool", "Pool / Swimmingpool"], ["spa", "Sauna / Spa"],
    ["home_cinema", "Heimkino"], ["wine_cellar", "Weinkeller"], ["library", "Bibliothek"],
    ["balcony", "Balkon / Terrasse"], ["rooftop", "Rooftop"],
  ],
  "Büro": [
    ["open_space", "Open Space"], ["conference_room", "Konferenzraum"], ["meeting_room", "Besprechungsraum"],
    ["reception", "Empfang / Lobby"], ["kitchen_room", "Teeküche"], ["coworking", "Coworking-Bereich"],
    ["server_room", "Serverraum"], ["archive", "Archiv"], ["terrace", "Dachterrasse"],
  ],
  "Industrie": [
    ["warehouse", "Lagerhalle"], ["production", "Produktion / Werkstatt"], ["office_area", "Bürobereich"],
    ["changing_room_area", "Umkleide"], ["loading_area", "Verladebereich"], ["cold_storage", "Kühlraum"],
    ["rooftop", "Dach / Außenbereich"], ["showroom", "Showroom"],
  ],
  "Natur": [
    ["forest", "Wald"], ["meadow", "Wiese / Feld"], ["lake", "See / Gewässer"],
    ["beach", "Strand"], ["mountain", "Berg / Hügel"], ["park", "Park / Gartenanlage"],
    ["farm", "Bauernhof / Hof"], ["ruins", "Ruine / Lost Place"],
  ],
  "Gastronomie": [
    ["restaurant_area", "Restaurantbereich"], ["bar_area", "Bar / Theke"], ["terrace", "Terrasse / Außenbereich"],
    ["private_room", "Privatraum / VIP"], ["kitchen_room", "Profiküche"], ["storage", "Lager"],
    ["rooftop", "Rooftop"],
  ],
  "Studio": [
    ["main_stage", "Hauptstage"], ["green_room_area", "Green Room"], ["makeup_room", "Maske / Make-up"],
    ["control_room", "Regieraum"], ["prop_storage", "Requisitenlager"], ["changing_room_area", "Umkleide"],
    ["office_area", "Bürobereich"], ["outdoor_set", "Außenset"],
  ],
  "Fotostudio": [
    ["shooting_area", "Shootingfläche"], ["cyclorama", "Cyclorama / Hohlkehle"], ["makeup_room", "Maske / Make-up"],
    ["changing_room_area", "Umkleide"], ["lounge", "Lounge / Wartebereich"], ["storage", "Fundus / Lager"],
    ["office_area", "Bürobereich"],
  ],
  "Speziallocation": [
    ["main_area", "Hauptbereich"], ["garden", "Garten / Außenbereich"], ["basement", "Keller / UG"],
    ["rooftop", "Dach / Rooftop"], ["terrace", "Terrasse"], ["private_room", "Nebenraum"],
    ["storage", "Lager"],
  ],
};

const ROOM_LABEL_KEYS: Readonly<Record<string, string>> = {
  "Arbeitszimmer": "Ui.text_2396c83101c3bf",
  "Archiv": "Ui.text_27207439933298",
  "Außenset": "Ui.text_1e53ee82c369c3",
  "Badezimmer": "Ui.text_5d662eade635b5",
  "Balkon / Terrasse": "Ui.text_b7a3a7c78bba32",
  "Bar / Theke": "Ui.text_efa4ec5f1ebcb4",
  "Bauernhof / Hof": "Ui.text_e9c1fdfdd87e81",
  "Berg / Hügel": "Ui.text_c9619c6579b5a6",
  "Besprechungsraum": "Ui.text_bad397419c051c",
  "Bibliothek": "Ui.text_70862cdee3da4d",
  "Bürobereich": "Ui.text_fe1c0c444ae4e5",
  "Coworking-Bereich": "Ui.text_5fc749bfaf4e22",
  "Cyclorama / Hohlkehle": "Ui.text_be6529edfffb7c",
  "Dach / Außenbereich": "Ui.text_c00b0a3fab0248",
  "Dach / Rooftop": "Ui.text_ac3f3b292f3bec",
  "Dachboden": "Ui.text_9b38abc0d84263",
  "Dachterrasse": "Ui.text_c02bfb35fb0a0d",
  "Empfang / Lobby": "Ui.text_0ed474d04f3403",
  "Esszimmer": "Ui.text_7ab86957a50a86",
  "Fundus / Lager": "Ui.text_b6275262d19bde",
  "Garage": "Ui.text_b15f6253519634",
  "Garten": "Ui.text_d81f9bcfd66015",
  "Garten / Außenbereich": "Ui.text_0364dc8c38b028",
  "Green Room": "Ui.text_cd4db9724f65a4",
  "Hauptbereich": "Ui.text_f655e29e87927f",
  "Hauptstage": "Ui.text_b3f926d138e222",
  "Heimkino": "Ui.text_c167cde5813dec",
  "Keller": "Ui.text_32dfe2cbdfb72c",
  "Keller / UG": "Ui.text_508832fca3eb30",
  "Konferenzraum": "Ui.text_247e05dd4552dd",
  "Küche": "Ui.text_a9ec872e661915",
  "Kühlraum": "Ui.text_4818a9abc64032",
  "Lager": "Ui.text_3781688d9e695d",
  "Lagerhalle": "Ui.text_546956663b0bce",
  "Lounge / Wartebereich": "Ui.text_e1af31f4a151e1",
  "Maske / Make-up": "Ui.text_ff1f6c7ca6813a",
  "Nebenraum": "Ui.text_ee373efc76fdbd",
  "Open Space": "Ui.text_17ddc308ad55f4",
  "Park / Gartenanlage": "Ui.text_908019d609bb0e",
  "Pool": "Ui.text_f13024272c385f",
  "Pool / Swimmingpool": "Ui.text_986686737acb7c",
  "Privatraum / VIP": "Ui.text_70c374423575e2",
  "Produktion / Werkstatt": "Ui.text_82568a934bc9a6",
  "Profiküche": "Ui.text_d6b03d178f4e05",
  "Regieraum": "Ui.text_cd64412276d0ad",
  "Requisitenlager": "Ui.text_cd2bae3271ee26",
  "Restaurantbereich": "Ui.text_874f1fb3504a11",
  "Rooftop": "Ui.text_66d5c95f408bbb",
  "Ruine / Lost Place": "Ui.text_642dcff01846fd",
  "Sauna / Spa": "Ui.text_26dab981d365b2",
  "Schlafzimmer": "Ui.text_d169602d01f7a9",
  "See / Gewässer": "Ui.text_ce72d09f088113",
  "Serverraum": "Ui.text_89cec591faf24c",
  "Shootingfläche": "Ui.text_85611f9368aa7a",
  "Showroom": "Ui.text_74cc1d00fe9ede",
  "Strand": "Ui.text_770baae20e7bb5",
  "Teeküche": "Ui.text_89498b946a009b",
  "Terrasse": "Ui.text_cbff339342911e",
  "Terrasse / Außenbereich": "Ui.text_642e5dcb308419",
  "Umkleide": "Ui.text_6bb28e219f8023",
  "Verladebereich": "Ui.text_9b24667ff52422",
  "Wald": "Ui.text_cad1dafa8fe5e2",
  "Weinkeller": "Ui.text_9bfe47142475ad",
  "Wiese / Feld": "Ui.text_56102faf95b015",
  "Wohnzimmer": "Ui.text_08f7b944a44e64"
};

/** Resolve category-specific labels first; keep unknown or ambiguous legacy text intact. */
export function locationRoomLabel(room: string, category: string, translate: (key: string) => string): string {
  const categoryRooms = Object.hasOwn(LOCATION_ROOMS, category) ? LOCATION_ROOMS[category] : [];
  const exact = categoryRooms.find(([id]) => id === room)?.[1];
  const candidates = exact ? [exact] : [...new Set(Object.values(LOCATION_ROOMS).flatMap(entries =>
    entries.filter(([id]) => id === room).map(([, label]) => label)))];
  if (candidates.length !== 1) return room;
  const label = candidates[0];
  return Object.hasOwn(ROOM_LABEL_KEYS, label) ? translate(ROOM_LABEL_KEYS[label]) : room;
}
