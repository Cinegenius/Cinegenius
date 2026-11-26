// Isolated, explicitly requested comparison scope. Provider contract only.
// Saved/full results continue through the unchanged canonical validators.
import {AnalysisError} from './core.mjs';

export const PERSONAL_DISPO_TIMES_PLACES_TEST_INSTRUCTIONS = `EXPLICIT USER-REQUESTED MINIMAL PHONE ANALYSIS. This FINAL scope overrides earlier full-roster, all-locations, note and contact extraction requests. Do not extract excluded records and then hide them. Every day retains the SAME closed schema with notes=[] and contacts=[]. Keep the COMPLETE UNCHANGED original source and all evidence rules.
TIMES: Keep exact operative day/date/shooting-day, general or source-restricted unit shooting start, general crew call, production break/lunch and planned wrap. Keep explicitly selected department work-starts and its operational personal work-start/calls only when the source clearly assigns them to that selected department; people records exist only when needed for those exact bindings. No actor-ready, HMU/costume, actor work-end or unrelated department time for Lighting/Camera; no electrical/power logistics for Hair and Makeup. Never infer applicability. Source-explicit general/single-unit DREHFERTIG is onSet readiness, never shootingStart or arrival; retain exact clock, original label in evidence and unit restriction even when a separate explicit shooting start exists. Personal/department readiness or pure rehearsal stays separate.
PLACES: Keep ALL actual current shooting motives in ORIGINAL order for weather and motive changes. Also keep clearly GENERAL crew base, techbase, meeting, crew parking and general transport pickup locations. A department-specific place is allowed ONLY when the source clearly assigns it to the selected department. Do not extract Hair/Makeup or Costume-only places for Lighting or Camera; do not extract power/electrical service places for Hair and Makeup. A source-unclear place that is neither an actual shooting motive nor clearly general must be omitted from this minimal output, not relabelled general. Do not invent audience/unit/department assignment, geocode or move excluded material to another field. Story-only addresses remain excluded. Missing or unclear data stays missing; exact source/evidence/identity/date/clock/row-binding protections remain unchanged. Required notes and contacts arrays remain present and EMPTY.`;

export function personalDispoTimesPlacesTestArgs(args) {
 const schema=structuredClone(args?.schema);
 const day=schema?.properties?.days?.items;
 if(typeof args?.instructions!=='string'||args?.context?.kind!=='personal_dispo'||schema?.type!=='object'||day?.type!=='object'||!Array.isArray(day.required)||
    !['notes','contacts'].every(key=>day.required.includes(key)&&day.properties?.[key]?.type==='array')) {
  throw new AnalysisError('invalid_configuration',503);
 }
 for(const key of ['notes','contacts']) {
  // Constrain the existing generated provider schema; retain its item schema.
  day.properties[key].minItems=0;
  day.properties[key].maxItems=0;
 }
 const ids=args?.context?.analysisScope?.departmentIDs;
 const kinds=day.properties?.locations?.items?.properties?.kind;
 if(Array.isArray(ids)&&Array.isArray(kinds?.enum))kinds.enum=kinds.enum.filter(kind=>kind!=='makeup'||ids.includes('maske')).filter(kind=>kind!=='costume'||ids.includes('kostuem'));
 return {...args,schema,instructions:args.instructions+'\n'+PERSONAL_DISPO_TIMES_PLACES_TEST_INSTRUCTIONS};
}
