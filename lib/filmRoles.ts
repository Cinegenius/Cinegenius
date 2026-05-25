/**
 * CineGenius – Berufe-Struktur
 * Single source of truth für alle Departments und Rollen.
 * Umfasst Film, Social Media und Fotografie.
 */

export type Platform = "film" | "social" | "photo";

export type FilmRole = {
  id: string;
  label: string;               // Anzeigename (DE)
  labelEn?: string;            // Englische Entsprechung
  seniority?: "junior" | "senior" | "lead"; // Optional
};

export type FilmDepartment = {
  id: string;
  label: string;               // Gewerkname
  color: string;               // Tailwind text-color
  bg: string;                  // Tailwind bg/border (für Badges)
  platform: Platform;          // Film | Social Media | Fotografie
  roles: FilmRole[];
};

export const FILM_DEPARTMENTS: FilmDepartment[] = [
  {
    id: "vor-der-kamera",
    label: "Vor der Kamera",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    platform: "film",
    roles: [
      { id: "hauptdarsteller",    label: "Hauptdarsteller/in",          labelEn: "Lead Actor/Actress" },
      { id: "nebendarsteller",    label: "Nebendarsteller/in",          labelEn: "Supporting Actor/Actress" },
      { id: "statist",            label: "Statist / Komparse",          labelEn: "Background / Extra" },
      { id: "model",              label: "Model",                       labelEn: "Model" },
      { id: "stunt-darsteller",   label: "Stunt-Darsteller/in",        labelEn: "Stunt Performer" },
      { id: "sprecher",           label: "Sprecher / Voice-Over",       labelEn: "Voice Actor / Voice-Over" },
    ],
  },
  {
    id: "regie",
    label: "Regie",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    platform: "film",
    roles: [
      { id: "regisseur",          label: "Regisseur/in",                labelEn: "Director" },
      { id: "1-regieassistenz",   label: "1. Regieassistenz",           labelEn: "1st Assistant Director (1st AD)" },
      { id: "2-regieassistenz",   label: "2. Regieassistenz",           labelEn: "2nd Assistant Director (2nd AD)" },
      { id: "key-2nd-ad",         label: "Key 2nd AD",                  labelEn: "Key 2nd AD" },
      { id: "floor-2nd-ad",       label: "Floor 2nd AD",                labelEn: "Floor 2nd AD" },
      { id: "crowd-2nd-ad",       label: "Crowd 2nd AD",                labelEn: "Crowd 2nd AD" },
      { id: "3rd-ad",             label: "3rd AD",                      labelEn: "3rd Assistant Director (3rd AD)" },
      { id: "3rd-ad-crowd",       label: "3rd AD Crowd",                labelEn: "3rd AD Crowd" },
      { id: "base-3rd-ad",        label: "Base 3rd AD",                 labelEn: "Base 3rd AD" },
      { id: "floor-3rd-ad",       label: "Floor 3rd AD",                labelEn: "Floor 3rd AD" },
      { id: "ad-pa",              label: "AD PA",                       labelEn: "AD PA" },
      { id: "key-ad-pa",          label: "Key AD PA",                   labelEn: "Key AD PA" },
      { id: "ad-trainee",         label: "AD Trainee",                  labelEn: "AD Trainee" },
      { id: "crowd-marshall",     label: "Crowd Marshall",              labelEn: "Crowd Marshall" },
      { id: "assistant-crowd-marshall", label: "Assistant Crowd Marshall", labelEn: "Assistant Crowd Marshall" },
      { id: "script-supervisor",  label: "Script Supervisor",           labelEn: "Script Supervisor / Continuity" },
      { id: "regieassistenz",     label: "Regieassistenz (Set-Runner)", labelEn: "Set PA / Runner" },
    ],
  },
  {
    id: "kamera",
    label: "Kamera",
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
    platform: "film",
    roles: [
      { id: "dop",                label: "Director of Photography (DoP)", labelEn: "Cinematographer / DoP" },
      { id: "kamera-operator",    label: "Kamera-Operator",               labelEn: "Camera Operator" },
      { id: "focus-puller",       label: "1. AC / Focus Puller",          labelEn: "1st AC / Focus Puller" },
      { id: "2nd-ac",             label: "2. AC / Klappe",                labelEn: "2nd AC / Clapper Loader" },
      { id: "dit",                label: "DIT (Digital Imaging Technician)", labelEn: "DIT" },
      { id: "steadicam",          label: "Steadicam-Operator",            labelEn: "Steadicam Operator" },
      { id: "drohne",             label: "Drohnen-Pilot / Aerial",        labelEn: "Drone Operator / Aerial DP" },
      { id: "zusatzliche-kamera", label: "Zusätzliche Kamera",            labelEn: "Additional Camera Operator" },
      { id: "vr-dop",             label: "VR Director of Photography",    labelEn: "VR Director of Photography" },
      { id: "e-kameramann",       label: "E-Kameramann*frau (Studio/AU)", labelEn: "ENG Camera Operator (Studio)" },
      { id: "eb-kameramann",      label: "EB Kameramann*frau",            labelEn: "ENG/EB Camera Operator" },
      { id: "2nd-unit-kamera",    label: "2nd Unit Kameramann*frau",      labelEn: "2nd Unit Camera Operator" },
      { id: "3rd-unit-kamera",    label: "3rd Unit Kameramann*frau",      labelEn: "3rd Unit Camera Operator" },
      { id: "director-of-imagery",label: "Director of Imagery (DoI)",     labelEn: "Director of Imagery" },
      { id: "3d-stereo-kamera",   label: "3D Stereo Kameramann*frau",     labelEn: "3D Stereo Camera Operator" },
      { id: "unterwasser-kamera", label: "Unterwasser Kameramann*frau",   labelEn: "Underwater Camera Operator" },
      { id: "freifall-kamera",    label: "Freifall Kameramann*frau",      labelEn: "Freefall / Skydive Camera Operator" },
    ],
  },
  {
    id: "licht",
    label: "Licht",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    platform: "film",
    roles: [
      { id: "oberbeleuchter",     label: "Oberbeleuchter / Gaffer",     labelEn: "Gaffer" },
      { id: "best-boy-licht",     label: "Best Boy Licht",              labelEn: "Best Boy Electric" },
      { id: "rigging-gaffer",     label: "Rigging Gaffer",              labelEn: "Rigging Gaffer" },
      { id: "beleuchter",         label: "Beleuchter",                  labelEn: "Electrician / Lighting Tech" },
    ],
  },
  {
    id: "grip",
    label: "Grip",
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
    platform: "film",
    roles: [
      { id: "key-grip",           label: "Key Grip",                    labelEn: "Key Grip" },
      { id: "best-boy-grip",      label: "Best Boy Grip",               labelEn: "Best Boy Grip" },
      { id: "dolly-grip",         label: "Dolly Grip",                  labelEn: "Dolly Grip" },
      { id: "kran-operator",      label: "Kran-Operator",               labelEn: "Crane / Jib Operator" },
    ],
  },
  {
    id: "ton",
    label: "Ton",
    color: "text-teal-400",
    bg: "bg-teal-500/10 border-teal-500/20",
    platform: "film",
    roles: [
      { id: "tonmeister",         label: "Tonmeister / Sound Mixer",    labelEn: "Production Sound Mixer" },
      { id: "boom-operator",      label: "Boom Operator",               labelEn: "Boom Operator" },
      { id: "tonassistenz",       label: "Tonassistenz",                labelEn: "Sound Assistant" },
    ],
  },
  {
    id: "maske",
    label: "Maske & Hair",
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
    platform: "film",
    roles: [
      { id: "maskenbildner",      label: "Maskenbildner/in",            labelEn: "Make-up Artist" },
      { id: "sfx-makeup",         label: "SFX Make-up Artist",          labelEn: "Special FX Make-up" },
      { id: "hair-stylist",       label: "Hair Stylist",                labelEn: "Hair Stylist" },
      { id: "hmu-head",           label: "Head of Make-up & Hair",      labelEn: "Head of Make-up & Hair" },
    ],
  },
  {
    id: "kostuem",
    label: "Kostüm",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    platform: "film",
    roles: [
      { id: "kostuembildner",     label: "Kostümbildner/in",            labelEn: "Costume Designer" },
      { id: "garderobier",        label: "Garderobier/in",              labelEn: "Wardrobe Supervisor" },
      { id: "kostuemassistenz",   label: "Kostümassistenz",             labelEn: "Costume Assistant" },
    ],
  },
  {
    id: "szenenbild",
    label: "Szenenbild / Art",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
    platform: "film",
    roles: [
      { id: "production-designer", label: "Production Designer",        labelEn: "Production Designer" },
      { id: "art-director",        label: "Art Director",               labelEn: "Art Director" },
      { id: "set-decorator",       label: "Set Decorator",              labelEn: "Set Decorator" },
      { id: "requisiteur",         label: "Requisiteur/in",             labelEn: "Props Master" },
      { id: "buehnenbildner",      label: "Bühnenbauer/in",             labelEn: "Set Builder / Construction" },
      { id: "graphic-artist",      label: "Graphic Artist (Art Dept.)", labelEn: "Graphic Artist" },
    ],
  },
  {
    id: "produktion",
    label: "Produktion",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    platform: "film",
    roles: [
      { id: "produzent",           label: "Produzent/in",               labelEn: "Producer" },
      { id: "line-producer",       label: "Line Producer",              labelEn: "Line Producer" },
      { id: "produktionsleiter",   label: "Produktionsleiter/in",       labelEn: "Production Manager" },
      { id: "aufnahmeleiter",      label: "Aufnahmeleiter/in",          labelEn: "Unit Production Manager" },
      { id: "produktionsassistenz",label: "Produktionsassistenz",       labelEn: "Production Assistant (PA)" },
      { id: "location-manager",    label: "Location Manager",           labelEn: "Location Manager" },
      { id: "casting-director",    label: "Casting Director",           labelEn: "Casting Director" },
    ],
  },
  {
    id: "post",
    label: "Postproduktion",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    platform: "film",
    roles: [
      { id: "post-producer",        label: "Postproduction Producer*in",  labelEn: "Postproduction Producer" },
      { id: "post-supervisor",      label: "Postproduction Supervisor",  labelEn: "Postproduction Supervisor" },
      { id: "post-manager",         label: "Postproduction Manager",     labelEn: "Postproduction Manager" },
      { id: "post-koordinator",     label: "Post-Produktionskoordinator*in", labelEn: "Post-Production Coordinator" },
      { id: "post-disponent",       label: "Postproduktionsdisponent/in", labelEn: "Post-Production Scheduler" },
      { id: "asst-post-supervisor", label: "Assistant to Postprod. Supervisor", labelEn: "Assistant to Post Supervisor" },
      { id: "delivery-manager",     label: "Delivery Manager / Delivery Supervisor", labelEn: "Delivery Manager / Supervisor" },
      { id: "cutter",              label: "Cutter/in (Editor)",         labelEn: "Film Editor" },
      { id: "colorist",            label: "Colorist",                   labelEn: "Colorist / DI" },
      { id: "vfx-producer",        label: "VFX Producer*in",            labelEn: "VFX Producer" },
      { id: "vfx-herstellungsleiter", label: "VFX Herstellungsleiter*in", labelEn: "VFX Production Manager" },
      { id: "vfx-outsource-producer", label: "VFX Outsource Producer",  labelEn: "VFX Outsource Producer" },
      { id: "assistant-vfx-producer", label: "Assistant VFX Producer*in", labelEn: "Assistant VFX Producer" },
      { id: "vfx-artist",          label: "VFX Artist / Compositor",    labelEn: "VFX Artist / Compositor" },
      { id: "vr-producer",         label: "VR Producer*in",             labelEn: "VR Producer" },
      { id: "sound-designer",      label: "Sound Designer",             labelEn: "Sound Designer" },
      { id: "sound-editor",        label: "Sound Editor / Cutter",      labelEn: "Sound Editor" },
      { id: "motion-designer",     label: "Motion Designer",            labelEn: "Motion Designer" },
      { id: "finishing-artist",    label: "Finishing Artist",           labelEn: "Finishing Artist" },
      { id: "online-editor",       label: "Online-Editor",              labelEn: "Online Editor" },
      { id: "compositing-supervisor",    label: "Compositing Supervisor",          labelEn: "Compositing Supervisor" },
      { id: "digital-compositor",        label: "Digital Compositor / Compositing Artist", labelEn: "Digital Compositor" },
      { id: "digital-effects-supervisor",label: "Digital Effects Supervisor",      labelEn: "Digital Effects Supervisor" },
      { id: "digital-effects-designer",  label: "Digital Effects Designer*in",     labelEn: "Digital Effects Designer" },
      { id: "digital-matte-painter",     label: "Digital Matte Painter",           labelEn: "Digital Matte Painter" },
      { id: "screen-designer",           label: "Screen Designer*in",              labelEn: "Screen Designer" },
      { id: "title-designer",            label: "Title Designer*in",               labelEn: "Title Designer" },
      { id: "dcp-technician",            label: "DCP Technician",                  labelEn: "DCP Technician" },
      { id: "dcp-artist",                label: "DCP Artist",                      labelEn: "DCP Artist" },
      { id: "filmscan-operator",         label: "Filmscan Operator",               labelEn: "Filmscan Operator" },
      { id: "filmscanning-supervisor",   label: "Filmscanning Supervisor",         labelEn: "Filmscanning Supervisor" },
      { id: "film-recorder-operator",    label: "Film Recorder Operator",          labelEn: "Film Recorder Operator" },
      { id: "mistika-operator",          label: "Mistika Operator",                labelEn: "Mistika Operator" },
      { id: "vfx-animation-supervisor",  label: "VFX Animation Supervisor",        labelEn: "VFX Animation Supervisor" },
      { id: "post-assistent",            label: "Post-Produktionsassistent*in",    labelEn: "Post-Production Assistant" },
      { id: "post-techniker",            label: "Post-Produktionstechniker*in",    labelEn: "Post-Production Technician" },
    ],
  },
  {
    id: "vfx",
    label: "VFX / Visual Effects",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
    platform: "film",
    roles: [
      { id: "vfx-supervisor",            label: "VFX Supervisor",                  labelEn: "VFX Supervisor" },
      { id: "vfx-technical-director",    label: "VFX Technical Director",          labelEn: "VFX Technical Director" },
      { id: "vfx-consultant",            label: "VFX Consultant*in",               labelEn: "VFX Consultant" },
      { id: "vfx-lighting-supervisor",   label: "VFX Lighting Supervisor",         labelEn: "VFX Lighting Supervisor" },
      { id: "vfx-set-supervisor",        label: "VFX Set Supervisor",              labelEn: "VFX Set Supervisor" },
      { id: "vfx-production-manager",    label: "VFX Production Manager*in",       labelEn: "VFX Production Manager" },
      { id: "vfx-production-coordinator",label: "VFX Production Coordinator",      labelEn: "VFX Production Coordinator" },
      { id: "assistant-vfx-coordinator", label: "Assistant VFX Coordinator",       labelEn: "Assistant VFX Coordinator" },
      { id: "vfx-executive",             label: "VFX Executive",                   labelEn: "VFX Executive" },
      { id: "vfx-hr-manager",            label: "VFX HR Manager",                  labelEn: "VFX HR Manager" },
      { id: "vfx-it-admin",              label: "VFX IT Admin",                    labelEn: "VFX IT Admin" },
      { id: "vfx-it-support",            label: "VFX IT Support",                  labelEn: "VFX IT Support" },
      { id: "vfx-it-system-engineer",    label: "VFX IT System Engineer / Technician", labelEn: "VFX IT System Engineer" },
      { id: "pipeline-technical-director",label: "Pipeline Technical Director",    labelEn: "Pipeline Technical Director" },
      { id: "computer-graphics-supervisor",label: "Computer Graphics Supervisor",  labelEn: "Computer Graphics Supervisor" },
      { id: "cg-software-entwickler",    label: "CG Software Entwickler*in",       labelEn: "CG Software Developer" },
      { id: "concept-artist-vfx",        label: "Concept Artist (VFX)",            labelEn: "Concept Artist (VFX)" },
      { id: "character-designer",        label: "Character Designer",              labelEn: "Character Designer" },
      { id: "character-supervisor",      label: "Character Supervisor",            labelEn: "Character Supervisor" },
      { id: "animatronics-supervisor",   label: "Animatronics Supervisor",         labelEn: "Animatronics Supervisor" },
      { id: "previs-supervisor",         label: "Previs Supervisor",               labelEn: "Previs Supervisor" },
      { id: "previs-artist",             label: "Previs Artist*in",                labelEn: "Previs Artist" },
      { id: "motion-capture-supervisor", label: "Motion Capture Supervisor",       labelEn: "Motion Capture Supervisor" },
      { id: "motioncontrol-supervisor",  label: "Motioncontrol Supervisor",        labelEn: "Motion Control Supervisor" },
      { id: "dailies-operator",          label: "Dailies Operator",                labelEn: "Dailies Operator" },
      { id: "io-coordinator",            label: "I/O Coordinator",                 labelEn: "I/O Coordinator" },
      { id: "telecine-operator",         label: "Telecine Operator",               labelEn: "Telecine Operator" },
      { id: "digital-matchmover",        label: "Digital Matchmover",              labelEn: "Digital Matchmover" },
      { id: "rotoscoping-artist",        label: "Rotoscoping Artist",              labelEn: "Rotoscoping Artist" },
      { id: "dam-manager",               label: "DAM Digital Asset Manager",       labelEn: "Digital Asset Manager (DAM)" },
      { id: "di-supervisor",             label: "DI Digital Intermediate Supervisor", labelEn: "DI Supervisor" },
      { id: "digital-intermediate-engineer", label: "Digital Intermediate Engineer", labelEn: "Digital Intermediate Engineer" },
      { id: "digital-intermediate-assistent", label: "Digital Intermediate Assistent*in", labelEn: "Digital Intermediate Assistant" },
      { id: "vfx-data-wrangler",         label: "VFX Data Wrangler",               labelEn: "VFX Data Wrangler" },
      { id: "render-wrangler",           label: "Render Wrangler",                 labelEn: "Render Wrangler" },
      { id: "3d-stereo-supervisor",      label: "3D Stereo Supervisor",            labelEn: "3D Stereo Supervisor" },
      { id: "on-set-screen-zuspielung",  label: "On-Set Screen-Zuspielung",        labelEn: "On-Set Playback Operator" },
      { id: "vfx-praktikant",            label: "VFX Praktikant*in",               labelEn: "VFX Intern" },
      { id: "vfx-production-assistent",  label: "VFX Production Assistent*in",     labelEn: "VFX Production Assistant" },
      { id: "vfx-team-manager",          label: "VFX Team Manager",                labelEn: "VFX Team Manager" },
    ],
  },
  {
    id: "animation-3d",
    label: "Animation / 3D",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    platform: "film",
    roles: [
      { id: "head-of-3d",                label: "Head of 3D",                      labelEn: "Head of 3D" },
      { id: "3d-artist",                 label: "3D Artist",                       labelEn: "3D Artist" },
      { id: "3d-animation-director",     label: "3D Animation Director",           labelEn: "3D Animation Director" },
      { id: "3d-lead-character-animator",label: "3D Lead Character Animator",      labelEn: "3D Lead Character Animator" },
      { id: "3d-character-animator",     label: "3D Character Animator",           labelEn: "3D Character Animator" },
      { id: "3d-rigger",                 label: "3D Rigger",                       labelEn: "3D Rigger" },
      { id: "3d-modeler",                label: "3D Modeler",                      labelEn: "3D Modeler" },
      { id: "3d-lighter",                label: "3D Lighter",                      labelEn: "3D Lighter" },
      { id: "3d-texturer",               label: "3D Texturer",                     labelEn: "3D Texturer" },
      { id: "3d-camera-artist",          label: "3D Camera Artist",                labelEn: "3D Camera Artist" },
      { id: "3d-camera-supervisor",      label: "3D Camera Supervisor",            labelEn: "3D Camera Supervisor" },
      { id: "fx-animator",               label: "FX Animator",                     labelEn: "FX Animator" },
      { id: "particle-animator",         label: "Particle Animator",               labelEn: "Particle Animator" },
      { id: "2d-artist",                 label: "2D Artist",                       labelEn: "2D Artist" },
      { id: "2d-rigger",                 label: "2D Rigger",                       labelEn: "2D Rigger" },
      { id: "2d-animation-director",     label: "2D Animation Director",           labelEn: "2D Animation Director" },
      { id: "2d-lead-character-animator",label: "2D Lead Character Animator",      labelEn: "2D Lead Character Animator" },
      { id: "2d-character-animator",     label: "2D Character Animator",           labelEn: "2D Character Animator" },
      { id: "motionbuilder-artist",      label: "MotionBuilder Artist",            labelEn: "MotionBuilder Artist" },
      { id: "motionbuilder-operator",    label: "MotionBuilder Operator",          labelEn: "MotionBuilder Operator" },
    ],
  },

  {
    id: "besetzung",
    label: "Besetzung / Casting",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    platform: "film",
    roles: [
      { id: "casting-director-jugendliche", label: "Casting Director (Jugendliche)", labelEn: "Youth Casting Director" },
      { id: "casting-director-kinder",  label: "Casting Director (Kinder)",       labelEn: "Children's Casting Director" },
      { id: "casting-associate",        label: "Casting Associate",               labelEn: "Casting Associate" },
      { id: "castingassistent",         label: "Castingassistent*in",             labelEn: "Casting Assistant" },
      { id: "streetcasting",            label: "Streetcasting",                   labelEn: "Street Casting" },
      { id: "komparsen-casting",        label: "Komparsen-, Kleindarstellercasting", labelEn: "Background / Supporting Casting" },
      { id: "castingpraktikant",        label: "Castingpraktikant*in",            labelEn: "Casting Intern" },
    ],
  },
  {
    id: "drehbuch",
    label: "Drehbuch / Screenplay",
    color: "text-orange-300",
    bg: "bg-orange-500/10 border-orange-500/20",
    platform: "film",
    roles: [
      { id: "showrunner",               label: "Showrunner",                      labelEn: "Showrunner" },
      { id: "headautor",                label: "Headautor*in",                    labelEn: "Head Writer" },
      { id: "assistent-headautor",      label: "Assistent der*des Headautor*in",  labelEn: "Assistant to Head Writer" },
      { id: "assistant-showrunner",     label: "Assistant Showrunner",            labelEn: "Assistant Showrunner" },
      { id: "drehbuchautor",            label: "Drehbuchautor*in",                labelEn: "Screenwriter" },
      { id: "co-autor",                 label: "Co-Autor*in",                     labelEn: "Co-Writer" },
      { id: "re-writer",                label: "Re-Writer*in",                    labelEn: "Re-Writer" },
      { id: "script-doctor",            label: "Script Doctor",                   labelEn: "Script Doctor" },
      { id: "story-editor",             label: "Story Editor*in",                 labelEn: "Story Editor" },
      { id: "storyliner",               label: "Storyliner",                      labelEn: "Storyliner" },
      { id: "drehbucheditor",           label: "Drehbucheditor*in",               labelEn: "Script Editor" },
      { id: "dialogeditor",             label: "Dialogeditor*in",                 labelEn: "Dialogue Editor" },
      { id: "dialogautor",              label: "Dialogautor*in",                  labelEn: "Dialogue Writer" },
      { id: "drehbuchlektor",           label: "Drehbuchlektor*in",               labelEn: "Script Reader" },
      { id: "dramaturg",                label: "Dramaturg, Script Consultant",    labelEn: "Dramaturg / Script Consultant" },
      { id: "stoffentwicklung",         label: "Drehbuch-Stoffentwicklung",       labelEn: "Story Development" },
      { id: "head-of-script",           label: "Head of Script",                  labelEn: "Head of Script" },
      { id: "head-of-story",            label: "Head of Story",                   labelEn: "Head of Story" },
      { id: "formatentwickler",         label: "Formatentwickler*in",             labelEn: "Format Developer" },
      { id: "treatmentliner",           label: "Treatmentliner",                  labelEn: "Treatment Writer" },
      { id: "synchron-dialogbuchautor", label: "Synchron-Dialogbuchautor*in",     labelEn: "Dubbing Script Writer" },
      { id: "hoerfilmautor",            label: "Hörfilmautor*in",                 labelEn: "Audio Description Writer" },
      { id: "filmubersetzer",           label: "Filmübersetzer*in",               labelEn: "Film Translator" },
      { id: "drehbuchubersetzer",       label: "Drehbuchübersetzer*in",           labelEn: "Script Translator" },
      { id: "untertitel-ubersetzung",   label: "Untertitel Übersetzung",          labelEn: "Subtitle Translation" },
      { id: "ubersetzung-dialoge",      label: "Übersetzung Dialoge",             labelEn: "Dialogue Translation" },
      { id: "transkript-ubersetzung",   label: "Transkript Übersetzung",          labelEn: "Transcript Translation" },
      { id: "dialogue-list-transcriber",label: "Dialogue List Transcriber",       labelEn: "Dialogue List Transcriber" },
      { id: "texter-copywriter",        label: "Texter*in, Copywriter",           labelEn: "Copywriter" },
      { id: "language-assistant",       label: "Language Assistant",              labelEn: "Language Assistant" },
      { id: "rechercheur",              label: "Rechercheur*in",                  labelEn: "Researcher" },
      { id: "recherche-assistent",      label: "Recherche Assistent*in",          labelEn: "Research Assistant" },
      { id: "script-coordinator",       label: "Script Coordinator",              labelEn: "Script Coordinator" },
      { id: "drehbuchpraktikant",       label: "Drehbuchpraktikant*in",           labelEn: "Script Intern" },
    ],
  },
  {
    id: "filmgeschaeftsfuehrung",
    label: "Filmgeschäftsführung",
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    platform: "film",
    roles: [
      { id: "produktionscontroller",    label: "Produktionscontroller*in",        labelEn: "Production Controller" },
      { id: "filmgeschaftsfuhrer",      label: "Filmgeschäftsführer*in",          labelEn: "Film Business Manager" },
      { id: "buchhalter",               label: "Buchhalter*in",                   labelEn: "Accountant" },
      { id: "assistent-filmgeschaft",   label: "Assistent*in der Filmgeschäftsführung", labelEn: "Assistant Business Affairs" },
      { id: "kassenfuhrer",             label: "Kassenführer*in",                 labelEn: "Cashier / Petty Cash" },
      { id: "payroll-accountant",       label: "Payroll Accountant / Lohnbuchhalter*in", labelEn: "Payroll Accountant" },
      { id: "praktikant-filmgeschaft",  label: "Praktikant*in der Filmgeschäftsführung", labelEn: "Business Affairs Intern" },
    ],
  },

  // ── SOCIAL MEDIA ─────────────────────────────────────────────────────────

  {
    id: "content-creation",
    label: "Content Creation",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    platform: "social",
    roles: [
      { id: "content-creator",     label: "Content Creator",             labelEn: "Content Creator" },
      { id: "influencer",          label: "Influencer / Creator",        labelEn: "Influencer / Creator" },
      { id: "social-media-manager",label: "Social Media Manager",        labelEn: "Social Media Manager" },
      { id: "community-manager",   label: "Community Manager",           labelEn: "Community Manager" },
      { id: "brand-storyteller",   label: "Brand Storyteller",           labelEn: "Brand Storyteller" },
    ],
  },
  {
    id: "social-video",
    label: "Social Video",
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-500/10 border-fuchsia-500/20",
    platform: "social",
    roles: [
      { id: "videograf-social",    label: "Videograf (Social Content)",  labelEn: "Social Videographer" },
      { id: "reels-editor",        label: "Editor (Reels / TikTok)",     labelEn: "Shortform Editor" },
      { id: "motion-social",       label: "Motion Designer (Social)",    labelEn: "Motion Designer (Social)" },
      { id: "ugc-creator",         label: "UGC Creator",                 labelEn: "UGC Creator" },
    ],
  },

  // ── FOTOGRAFIE ───────────────────────────────────────────────────────────

  {
    id: "fotografie",
    label: "Fotografie",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    platform: "photo",
    roles: [
      { id: "fotograf",            label: "Fotograf/in",                 labelEn: "Photographer" },
      { id: "modefotograf",        label: "Modefotograf/in",             labelEn: "Fashion Photographer" },
      { id: "produktfotograf",     label: "Produktfotograf/in",          labelEn: "Product Photographer" },
      { id: "eventfotograf",       label: "Eventfotograf/in",            labelEn: "Event Photographer" },
      { id: "portraitfotograf",    label: "Portraitfotograf/in",         labelEn: "Portrait Photographer" },
      { id: "werbefotograf",       label: "Werbefotograf/in",            labelEn: "Commercial Photographer" },
      { id: "food-fotograf",       label: "Food Fotograf/in",            labelEn: "Food Photographer" },
    ],
  },
  {
    id: "foto-post",
    label: "Foto-Postproduktion",
    color: "text-lime-400",
    bg: "bg-lime-500/10 border-lime-500/20",
    platform: "photo",
    roles: [
      { id: "retoucher",           label: "Retoucher/in",                labelEn: "Retoucher" },
      { id: "bildbearbeiter",      label: "Bildbearbeiter/in",           labelEn: "Photo Editor" },
      { id: "fotoassistenz",       label: "Fotoassistenz",               labelEn: "Photo Assistant" },
      { id: "studio-manager",      label: "Studio Manager/in",           labelEn: "Studio Manager" },
    ],
  },
];

/** Flat list of all roles (für Suche, Validierung etc.) */
export const ALL_ROLES: (FilmRole & { departmentId: string; departmentLabel: string })[] =
  FILM_DEPARTMENTS.flatMap((d) =>
    d.roles.map((r) => ({ ...r, departmentId: d.id, departmentLabel: d.label }))
  );

/** Department-ID → Department */
export const DEPT_BY_ID = Object.fromEntries(FILM_DEPARTMENTS.map((d) => [d.id, d]));

/** Role-ID → Role + Department */
export const ROLE_BY_ID = Object.fromEntries(ALL_ROLES.map((r) => [r.id, r]));

/**
 * Für die Suche: Welche Suchbegriffe treffen auf ein Department?
 * Wird in CreatorsContent und JobsContent für Keyword-Matching verwendet.
 */
export const DEPT_KEYWORDS: Record<string, string[]> = {
  "vor-der-kamera": [
    "schauspieler", "schauspielerin", "actor", "actress", "darsteller",
    "hauptdarsteller", "nebendarsteller", "statist", "komparse", "extra",
    "background", "model", "stunt", "sprecher", "voice",
  ],
  regie: [
    "regisseur", "regisseurin", "director", "1st ad", "2nd ad", "3rd ad",
    "key 2nd ad", "floor 2nd ad", "crowd 2nd ad", "floor 3rd ad", "base 3rd ad",
    "ad pa", "key ad pa", "ad trainee", "crowd marshall",
    "regieassistenz", "script supervisor", "continuity", "runner", "set pa",
  ],
  kamera: [
    "kamera", "camera", "dop", "cinematograph", "dp",
    "kamera-operator", "operator", "focus puller", "1st ac", "1. ac",
    "2nd ac", "2. ac", "dit", "steadicam", "drohne", "aerial", "drone",
  ],
  licht: [
    "licht", "lighting", "gaffer", "oberbeleuchter", "beleuchter",
    "best boy", "electrician", "rigging gaffer", "rigging",
  ],
  grip: [
    "grip", "key grip", "dolly", "kran", "crane", "jib", "rigging",
  ],
  ton: [
    "ton", "sound", "audio", "tonmeister", "mixer", "boom operator",
    "tonassistenz",
  ],
  maske: [
    "maske", "make-up", "makeup", "maskenbildner", "hair", "stylist",
    "sfx makeup", "hmu",
  ],
  kostuem: [
    "kostüm", "kostum", "costume", "wardrobe", "garderobier",
    "kostümbildner", "kostumbildner",
  ],
  szenenbild: [
    "szenenbild", "production designer", "art director", "set decorator",
    "requisiteur", "props", "art department", "bühnenbau", "buhnenbau",
  ],
  produktion: [
    "produzent", "producer", "line producer", "produktionsleiter",
    "aufnahmeleiter", "produktionsassistenz", "pa", "location manager",
    "casting",
  ],
  post: [
    "cutter", "editor", "schnitt", "colorist", "color grading",
    "compositor", "sound designer", "sound editor",
    "motion design", "online editor", "postproduktion",
    "post producer", "postproduction supervisor", "postproduction manager",
    "post koordinator", "post disponent", "delivery manager", "delivery supervisor",
    "vfx producer", "vfx herstellungsleiter", "vfx outsource", "assistant vfx",
    "vr producer", "finishing artist", "dcp", "filmscan", "matte painter",
    "title designer", "screen designer", "compositing", "digital compositor",
  ],
  vfx: [
    "vfx", "visual effects", "vfx supervisor", "vfx technical director",
    "vfx consultant", "vfx lighting", "vfx set", "vfx production",
    "vfx coordinator", "vfx executive", "vfx hr", "vfx it",
    "pipeline", "computer graphics", "cg software", "concept artist",
    "character designer", "character supervisor", "animatronics",
    "previs", "motion capture", "mocap", "motioncontrol", "dailies", "i/o coordinator",
    "telecine", "matchmover", "rotoscoping", "roto", "digital asset", "dam",
    "digital intermediate", "di supervisor", "wrangler", "render wrangler",
    "stereo supervisor", "screen zuspielung", "playback",
  ],
  besetzung: [
    "casting", "besetzung", "casting director", "casting associate",
    "castingassistent", "streetcasting", "komparsen", "komparse",
  ],
  drehbuch: [
    "drehbuch", "screenplay", "script", "autor", "autorin", "writer",
    "showrunner", "headautor", "drehbuchautor", "co-autor", "re-writer",
    "script doctor", "story editor", "storyliner", "dialogautor", "dramaturg",
    "stoffentwicklung", "formatentwickler", "synchron", "hörfilm", "übersetzer",
    "translator", "untertitel", "transkript", "recherche", "copywriter",
  ],
  filmgeschaeftsfuehrung: [
    "filmgeschäftsführung", "geschäftsführung", "controller", "buchhalter",
    "accountant", "payroll", "lohnbuchhaltung", "kassenführer", "petty cash",
  ],
  "animation-3d": [
    "3d", "animation", "animator", "rigger", "modeler", "lighter", "texturer",
    "3d artist", "character animator", "fx animator", "particle", "motionbuilder",
    "2d animation", "head of 3d",
  ],

  // Social Media
  "content-creation": [
    "content creator", "content", "influencer", "social media manager",
    "social media", "community manager", "brand storyteller", "creator",
  ],
  "social-video": [
    "videograf", "videographer", "reels", "tiktok", "shortform", "short form",
    "ugc", "motion designer", "social video", "instagram", "youtube shorts",
  ],

  // Fotografie
  fotografie: [
    "fotograf", "fotografin", "photographer", "photo", "foto",
    "modefotograf", "fashion photographer", "produktfotograf", "product photographer",
    "eventfotograf", "event photographer", "portraitfotograf", "portrait",
    "werbefotograf", "commercial photographer", "food fotograf", "food photographer",
  ],
  "foto-post": [
    "retoucher", "retusche", "bildbearbeiter", "photo editor", "fotoassistenz",
    "photo assistant", "studio manager", "bildbearbeitung",
  ],
};

/** Departments grouped by platform — für UI-Tabs */
export const DEPARTMENTS_BY_PLATFORM: Record<Platform, FilmDepartment[]> = {
  film: FILM_DEPARTMENTS.filter((d) => d.platform === "film"),
  social: FILM_DEPARTMENTS.filter((d) => d.platform === "social"),
  photo: FILM_DEPARTMENTS.filter((d) => d.platform === "photo"),
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  film: "Film",
  social: "Social Media",
  photo: "Fotografie",
};
