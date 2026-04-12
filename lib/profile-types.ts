// ═══════════════════════════════════════════════════════════════════════════
// CineGenius — Vollständiges Profilsystem
// ═══════════════════════════════════════════════════════════════════════════

// ─── Profiltypen ────────────────────────────────────────────────────────────

export type ProfileType =
  // Talent
  | "actor"
  | "model"
  | "extra"
  | "host"
  | "dancer"
  | "stunt"
  | "voiceover"
  | "creator"
  // Crew
  | "camera"
  | "lighting"
  | "sound"
  | "director_of_photography"
  | "director"
  | "production"
  | "makeup"
  | "costume"
  | "postproduction"
  | "vfx"
  | "sfx"
  | "art_department"
  | "broadcast"
  // Kreativ
  | "filmmaker"
  | "writer"
  | "photographer"
  | "editor"
  | "motion_designer"
  | "art_director"
  // Anbieter
  | "location"
  | "equipment"
  | "vehicle"
  | "studio"
  | "props";

export type ProfileCategory = "talent" | "crew" | "creative" | "vendor";

export const PROFILE_CATEGORY_MAP: Record<ProfileType, ProfileCategory> = {
  actor: "talent", model: "talent", extra: "talent", host: "talent",
  dancer: "talent", stunt: "talent", voiceover: "talent", creator: "talent",
  camera: "crew", lighting: "crew", sound: "crew", director_of_photography: "crew",
  director: "crew", production: "crew", makeup: "crew", costume: "crew",
  postproduction: "crew", vfx: "crew", sfx: "crew", art_department: "crew",
  broadcast: "crew",
  filmmaker: "creative", writer: "creative", photographer: "creative",
  editor: "creative", motion_designer: "creative", art_director: "creative",
  location: "vendor", equipment: "vendor", vehicle: "vendor",
  studio: "vendor", props: "vendor",
};

export const PROFILE_TYPE_LABELS: Record<ProfileType, string> = {
  actor: "Schauspieler/in", model: "Model", extra: "Komparse / Kleindarsteller",
  host: "Moderator/in", dancer: "Tänzer/in", stunt: "Stunt Performer",
  voiceover: "Synchronsprecher/in", creator: "Influencer / Creator",
  camera: "Kamera", lighting: "Licht / Gaffer", sound: "Ton",
  director_of_photography: "Director of Photography", director: "Regie",
  production: "Produktion", makeup: "Maske", costume: "Kostüm",
  postproduction: "Postproduktion", vfx: "VFX", sfx: "SFX",
  art_department: "Szenenbild / Art Department", broadcast: "Broadcast",
  filmmaker: "Regisseur/in", writer: "Autor/in / Drehbuch",
  photographer: "Fotograf/in", editor: "Editor/in / Cutter",
  motion_designer: "Motion Designer", art_director: "Art Director",
  location: "Location Anbieter", equipment: "Equipment Verleiher",
  vehicle: "Fahrzeug Anbieter", studio: "Studio Anbieter",
  props: "Requisiten Anbieter",
};

// ─── Module ─────────────────────────────────────────────────────────────────

export type ModuleType =
  | "hero"
  | "facts"         // kompakte Kerndaten (Spielalter, Größe, Haarfarbe …)
  | "portfolio"
  | "showreel"
  | "about"
  | "skills"
  | "filmography"
  | "awards"
  | "listings"
  | "availability"
  | "downloads"     // Sedcard, Pressemappe
  | "agency"        // Agentur / Management
  | "contact";

export interface ProfileModule {
  type: ModuleType;
  enabled: boolean;
  order: number;
  locked?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>;
}

// ─── Physische Merkmale (Talent) ─────────────────────────────────────────────

export type BodyType = "slim" | "athletic" | "normal" | "strong" | "muscular" | "curvy";
export type HairLength = "bald" | "short" | "medium" | "long" | "very_long";
export type HairTexture = "straight" | "wavy" | "curly" | "afro";
export type EthnicRead =
  | "central_european" | "mediterranean" | "eastern_european"
  | "middle_eastern" | "african" | "east_asian" | "south_asian"
  | "latin_american" | "mixed" | "diverse";

export interface PhysicalData {
  height_cm?: number;
  weight_kg?: number;
  body_type?: BodyType;
  appearance_age?: number;      // Erscheinungsalter
  playing_age_min?: number;     // Spielalter von
  playing_age_max?: number;     // Spielalter bis
  clothing_size?: string;
  shoe_size?: number;
  // Haare
  hair_color?: string;
  hair_color_natural?: string;
  hair_length?: HairLength;
  hair_texture?: HairTexture;
  beard?: boolean;
  beard_style?: string;
  hair_dyeable?: boolean;
  hair_cuttable?: boolean;
  wig_ok?: boolean;
  // Augen
  eye_color?: string;
  glasses?: boolean;
  contacts_ok?: boolean;
  // Merkmale
  tattoos?: boolean;
  tattoos_coverable?: boolean;
  piercings?: boolean;
  piercings_removable?: boolean;
  freckles?: boolean;
  scars?: boolean;
  // Ethnic Read
  ethnic_read?: EthnicRead[];
  ethnic_read_custom?: string;
}

export interface ModelMeasurements {
  bust_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  inseam_cm?: number;
  collar_cm?: number;
  dress_size?: string;
  suit_size?: string;
  cup_size?: string;           // optional / sensitiv
  model_categories?: ModelCategory[];
}

export type ModelCategory =
  | "fashion" | "commercial" | "beauty" | "curvy" | "plus_size"
  | "fitness" | "editorial" | "runway" | "ecommerce" | "parts";

// ─── Performance Skills (Talent) ─────────────────────────────────────────────

export interface PerformanceData {
  // Erfahrung
  acting_experience?: boolean;
  camera_experience?: boolean;
  theatre_experience?: boolean;
  improv?: boolean;
  hosting?: boolean;
  // Körper / Bewegung
  dance_styles?: string[];
  stunts?: boolean;
  riding?: boolean;
  swimming?: boolean;
  diving?: boolean;
  sports?: string[];
  // Stimme
  singing?: boolean;
  voiceover_experience?: boolean;
  languages_spoken?: LanguageEntry[];
  accents?: string[];
  dialects?: string[];
  instruments?: string[];
  // Technik
  mocap_experience?: boolean;
  greenscreen_experience?: boolean;
  // Führerscheine
  driving_licenses?: string[];
  // Freitext
  special_skills?: string[];
}

export interface LanguageEntry {
  language: string;
  level: "native" | "fluent" | "good" | "basic";
}

// ─── Rollenprofil (Talent) ────────────────────────────────────────────────────

export interface CastingProfile {
  playable_roles?: string[];       // CEO, Polizist, Mutter …
  character_types?: string[];      // sympathisch, mysteriös, tough …
  target_formats?: TargetFormat[];
  gender?: string;                 // Freitext: Frau, Mann, non-binary …
}

export type TargetFormat =
  | "film" | "series" | "commercial" | "music_video"
  | "editorial" | "social_media" | "beauty" | "corporate" | "theatre";

// ─── Crew / Technik ──────────────────────────────────────────────────────────

export interface CrewData {
  department?: string;
  positions?: string[];
  experience_years?: number;
  preferred_formats?: TargetFormat[];
  software?: string[];
  equipment_known?: string[];
  certificates?: string[];
  own_equipment?: boolean;
  day_rate?: number;
  day_rate_on_request?: boolean;
  team_size?: number;            // Assistenten möglich
}

// ─── Kreativ ─────────────────────────────────────────────────────────────────

export interface CreativeData {
  disciplines?: string[];
  style_tags?: string[];
  inspiration_fields?: string[];
  clients?: string[];
  publications?: string[];
  festival_selections?: string[];
}

// ─── Anbieter ────────────────────────────────────────────────────────────────

export type VendorCategory = "location" | "equipment" | "vehicle" | "studio" | "props";

export interface VendorData {
  company_name?: string;
  vendor_category?: VendorCategory;
  service_radius_km?: number;
  delivery_possible?: boolean;
  pickup_only?: boolean;
}

// Listings — einzelne Angebote eines Anbieters
export interface Listing {
  id: string;
  type: "location" | "equipment" | "vehicle";
  title: string;
  description?: string;
  images?: string[];
  price_per_day?: number;
  price_on_request?: boolean;
  available?: boolean;
  // Location spezifisch
  location_type?: string;
  indoor?: boolean;
  outdoor?: boolean;
  size_sqm?: number;
  parking?: boolean;
  power_available?: boolean;
  noise_level?: "quiet" | "moderate" | "loud";
  filming_permit_info?: string;
  // Equipment spezifisch
  equipment_category?: string;
  insurance_required?: boolean;
  deposit_required?: boolean;
  includes_accessories?: string[];
  // Fahrzeug spezifisch
  vehicle_type?: string;
  vehicle_year?: number;
  drivable?: boolean;
  with_driver?: boolean;
  camera_car_possible?: boolean;
  stunt_suitable?: boolean;
}

// ─── Verfügbarkeit ────────────────────────────────────────────────────────────

export type AvailabilityStatus = "available" | "busy" | "selective";
export type TravelReadiness = "none" | "regional" | "national" | "european" | "worldwide";

export interface AvailabilityConfig {
  status: AvailabilityStatus;
  available_from?: string;          // ISO date
  blocked_dates?: string[];         // ISO dates
  short_notice?: boolean;
  weekends?: boolean;
  night_shoots?: boolean;
  travel: TravelReadiness;
  locations: string[];
  work_radius_km?: number;
}

// ─── Agentur / Management ─────────────────────────────────────────────────────

export interface AgencyData {
  represented?: boolean;
  agency_name?: string;
  agency_contact?: string;
  agency_url?: string;
  management_name?: string;
  management_contact?: string;
  union?: string;                   // Verband / Gewerkschaft
}

// ─── Ausbildung ───────────────────────────────────────────────────────────────

export interface EducationEntry {
  school?: string;
  degree?: string;
  year?: number;
  type: "school" | "workshop" | "coaching" | "certificate";
}

// ─── Filmografie ─────────────────────────────────────────────────────────────

export interface FilmographyEntry {
  year: number;
  title: string;
  role: string;
  type?: string;
  director?: string;
  production?: string;
  festival?: string;
  imdb_url?: string;
}

// ─── Project Credits ─────────────────────────────────────────────────────────

export interface ProjectCredit {
  id: string;
  role: string;
  project_id: string;
  projects: {
    id: string;
    title: string;
    year: number | null;
    type: string | null;
    director: string | null;
    poster_url: string | null;
  } | null;
}

// ─── Awards ──────────────────────────────────────────────────────────────────

export interface ProfileAward {
  title: string;
  event?: string;
  year?: number;
  category?: string;
  nominated_only?: boolean;
}

// ─── Medien ───────────────────────────────────────────────────────────────────

export type MediaType =
  | "headshot" | "fullbody" | "editorial" | "polaroid" | "bts"
  | "portfolio" | "set_photo" | "product";

export interface ProfileImage {
  url: string;
  caption?: string;
  media_type?: MediaType;
  featured?: boolean;
}

export interface ProfileDownload {
  label: string;
  url: string;
  type: "sedcard" | "presskit" | "portfolio" | "other";
}

// ─── Sichtbarkeit ─────────────────────────────────────────────────────────────

export interface VisibilitySettings {
  weight?: "public" | "hidden";
  day_rate?: "public" | "on_request" | "hidden";
  phone?: "public" | "members" | "hidden";
  exact_location?: "public" | "city_only" | "hidden";
}

// ─── Vollständiges Profil ────────────────────────────────────────────────────

export interface UserProfile {
  // Identität
  user_id: string;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  stage_name?: string | null;
  company_name?: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  tagline: string | null;
  bio: string | null;
  slug: string | null;

  // Profiltyp
  profile_type: ProfileType;
  profile_types?: ProfileType[];    // Mehrfachauswahl möglich
  verified: boolean;

  // Standort
  location: string | null;
  location_city?: string | null;
  location_region?: string | null;
  location_country?: string | null;

  // Verfügbarkeit
  available: boolean;
  available_from: string | null;
  availability_config: AvailabilityConfig | null;

  // Konditionen
  day_rate: number | null;
  day_rate_on_request?: boolean;
  languages: string[] | null;
  travel_ready: boolean | null;
  role: string | null;
  positions: string[] | null;

  // Talent-Daten
  physical?: PhysicalData | null;
  model_measurements?: ModelMeasurements | null;
  performance?: PerformanceData | null;
  casting?: CastingProfile | null;

  // Crew-Daten
  crew?: CrewData | null;

  // Kreativ-Daten
  creative?: CreativeData | null;

  // Anbieter-Daten
  vendor?: VendorData | null;
  listings?: Listing[] | null;

  // Agentur
  agency?: AgencyData | null;

  // Medien
  profile_images: ProfileImage[] | null;
  showreel_url: string | null;
  reel_url?: string | null;
  video_links?: string[] | null;
  downloads?: ProfileDownload[] | null;

  // Credits
  skills: string[] | null;
  filmography: FilmographyEntry[] | null;
  awards: ProfileAward[] | null;
  education?: EducationEntry[] | null;

  // Social
  instagram_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  tiktok_url?: string | null;
  vimeo_url?: string | null;
  imdb_url?: string | null;
  spotlight_url?: string | null;

  // Datenschutz
  visibility?: VisibilitySettings | null;

  // Modulsystem
  modules: ProfileModule[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MODUL-PRESETS
// ═══════════════════════════════════════════════════════════════════════════

const heroBase = (style: "cinematic" | "blurred" | "solid") =>
  ({ type: "hero" as ModuleType, enabled: true, order: 0, locked: true,
     config: { backgroundStyle: style, badges: [], showLocation: true, showAvailability: true } });

export const PROFILE_PRESETS: Record<ProfileCategory, ProfileModule[]> = {

  // ── Talent ─────────────────────────────────────────────────────────────
  talent: [
    { ...heroBase("cinematic"), config: { backgroundStyle: "cinematic", badges: ["available"], showLocation: true, showAvailability: true } },
    { type: "facts",        enabled: true,  order: 1,               config: {} },
    { type: "portfolio",    enabled: true,  order: 2,               config: { layout: "featured_first", maxVisible: 9, captions: false } },
    { type: "showreel",     enabled: true,  order: 3,               config: { label: "Showreel" } },
    { type: "skills",       enabled: true,  order: 4,               config: { layout: "grouped", groups: [] } },
    { type: "filmography",  enabled: true,  order: 5,               config: { style: "timeline", limit: 6, showRoles: true } },
    { type: "about",        enabled: true,  order: 6,               config: {} },
    { type: "agency",       enabled: false, order: 7,               config: {} },
    { type: "awards",       enabled: false, order: 8,               config: { limit: 4 } },
    { type: "downloads",    enabled: false, order: 9,               config: {} },
    { type: "availability", enabled: true,  order: 10,              config: { status: "available", locations: [], travel: "national" } },
    { type: "contact",      enabled: true,  order: 11, locked: true, config: {} },
  ],

  // ── Crew ───────────────────────────────────────────────────────────────
  crew: [
    { ...heroBase("blurred"), config: { backgroundStyle: "blurred", badges: ["hire"], showLocation: true, showAvailability: true } },
    { type: "showreel",     enabled: true,  order: 1,               config: { label: "Showreel" } },
    { type: "filmography",  enabled: true,  order: 2,               config: { style: "timeline", limit: 8, showRoles: true } },
    { type: "skills",       enabled: true,  order: 3,               config: { layout: "grouped", groups: [] } },
    { type: "about",        enabled: true,  order: 4,               config: {} },
    { type: "portfolio",    enabled: true,  order: 5,               config: { layout: "masonry", maxVisible: 6, captions: true } },
    { type: "awards",       enabled: true,  order: 6,               config: { limit: 4 } },
    { type: "availability", enabled: true,  order: 7,               config: { status: "available", locations: [], travel: "national" } },
    { type: "facts",        enabled: false, order: 8,               config: {} },
    { type: "downloads",    enabled: false, order: 9,               config: {} },
    { type: "contact",      enabled: true,  order: 10, locked: true, config: {} },
  ],

  // ── Kreativ ────────────────────────────────────────────────────────────
  creative: [
    { ...heroBase("cinematic"), config: { backgroundStyle: "cinematic", badges: ["hire"], showLocation: true, showAvailability: false } },
    { type: "portfolio",    enabled: true,  order: 1,               config: { layout: "featured_first", maxVisible: 8, captions: true } },
    { type: "showreel",     enabled: true,  order: 2,               config: { label: "Reel" } },
    { type: "about",        enabled: true,  order: 3,               config: {} },
    { type: "filmography",  enabled: true,  order: 4,               config: { style: "timeline", limit: 6, showRoles: true } },
    { type: "awards",       enabled: true,  order: 5,               config: { limit: 6 } },
    { type: "skills",       enabled: true,  order: 6,               config: { layout: "tags", groups: [] } },
    { type: "availability", enabled: true,  order: 7,               config: { status: "selective", locations: [], travel: "national" } },
    { type: "downloads",    enabled: false, order: 8,               config: {} },
    { type: "contact",      enabled: true,  order: 9,  locked: true, config: {} },
  ],

  // ── Anbieter ───────────────────────────────────────────────────────────
  vendor: [
    { ...heroBase("cinematic"), config: { backgroundStyle: "cinematic", badges: ["verified"], showLocation: true, showAvailability: true } },
    { type: "listings",     enabled: true,  order: 1,               config: { types: ["location"], layout: "grid" } },
    { type: "portfolio",    enabled: true,  order: 2,               config: { layout: "featured_first", maxVisible: 12, captions: true } },
    { type: "about",        enabled: true,  order: 3,               config: {} },
    { type: "availability", enabled: true,  order: 4,               config: { status: "available", locations: [], travel: "none" } },
    { type: "contact",      enabled: true,  order: 5,  locked: true, config: {} },
    { type: "showreel",     enabled: false, order: 6,               config: { label: "Video" } },
    { type: "awards",       enabled: false, order: 7,               config: { limit: 3 } },
    { type: "skills",       enabled: false, order: 8,               config: { layout: "tags", groups: [] } },
  ],
};

// Hilfsfunktion: Kategorie → Preset-Module
export function getPresetForType(type: ProfileType): ProfileModule[] {
  const category = PROFILE_CATEGORY_MAP[type];
  return PROFILE_PRESETS[category] ?? PROFILE_PRESETS["talent"];
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTERBARE FELDER (für Suche)
// ═══════════════════════════════════════════════════════════════════════════

export const SEARCHABLE_FILTERS = {
  talent: [
    "location_city", "playing_age_min", "playing_age_max",
    "physical.height_cm", "physical.hair_color", "physical.eye_color",
    "physical.body_type", "physical.ethnic_read",
    "physical.tattoos", "physical.beard",
    "performance.dance_styles", "performance.languages_spoken",
    "performance.driving_licenses", "performance.sports",
    "casting.target_formats", "casting.character_types",
    "agency.represented", "available", "travel_ready",
    "profile_type",
  ],
  crew: [
    "location_city", "positions", "crew.department",
    "crew.experience_years", "crew.software", "crew.own_equipment",
    "crew.day_rate", "crew.preferred_formats",
    "available", "travel_ready", "profile_type",
  ],
  creative: [
    "location_city", "creative.disciplines", "creative.style_tags",
    "creative.clients", "available", "travel_ready", "profile_type",
  ],
  vendor: [
    "location_city", "vendor.vendor_category", "vendor.service_radius_km",
    "vendor.delivery_possible", "day_rate", "available", "profile_type",
  ],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING STEPS
// ═══════════════════════════════════════════════════════════════════════════

export type OnboardingStep =
  | "type"          // Profiltyp wählen
  | "basics"        // Name, Bild, Stadt, Kurztext
  | "specifics"     // typspezifische Felder
  | "media"         // Bilder, Video
  | "modules";      // Modulauswahl & Reihenfolge

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "type", "basics", "specifics", "media", "modules",
];

// ═══════════════════════════════════════════════════════════════════════════
// STANDARD-LAYOUTS pro spezifischem Profiltyp
// ═══════════════════════════════════════════════════════════════════════════

export const TYPE_LAYOUTS: Partial<Record<ProfileType, {
  above_fold: string[];   // Felder die above the fold sichtbar sind
  module_order: ModuleType[];
}>> = {
  actor: {
    above_fold: ["display_name", "profile_type", "location", "playing_age_min", "playing_age_max",
                 "physical.height_cm", "physical.hair_color", "physical.eye_color",
                 "available", "agency.represented"],
    module_order: ["hero", "facts", "portfolio", "showreel", "skills", "filmography", "about", "awards", "agency", "downloads", "availability", "contact"],
  },
  model: {
    above_fold: ["display_name", "profile_type", "location", "physical.height_cm",
                 "physical.hair_color", "physical.eye_color", "model_measurements.model_categories",
                 "available", "agency.represented"],
    module_order: ["hero", "facts", "portfolio", "showreel", "about", "skills", "filmography", "awards", "agency", "downloads", "availability", "contact"],
  },
  director_of_photography: {
    above_fold: ["display_name", "profile_type", "location", "crew.experience_years",
                 "crew.equipment_known", "available", "crew.day_rate"],
    module_order: ["hero", "showreel", "filmography", "portfolio", "skills", "about", "awards", "availability", "contact"],
  },
  lighting: {
    above_fold: ["display_name", "profile_type", "location", "crew.experience_years",
                 "crew.own_equipment", "available", "crew.day_rate"],
    module_order: ["hero", "filmography", "skills", "portfolio", "about", "availability", "contact"],
  },
  filmmaker: {
    above_fold: ["display_name", "profile_type", "location", "creative.style_tags", "available"],
    module_order: ["hero", "portfolio", "showreel", "about", "filmography", "awards", "skills", "availability", "contact"],
  },
  location: {
    above_fold: ["display_name", "vendor.vendor_category", "location", "day_rate", "available"],
    module_order: ["hero", "listings", "portfolio", "about", "availability", "contact"],
  },
  equipment: {
    above_fold: ["display_name", "vendor.vendor_category", "location", "vendor.delivery_possible", "available"],
    module_order: ["hero", "listings", "portfolio", "about", "availability", "contact"],
  },
};
