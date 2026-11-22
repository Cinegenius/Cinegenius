// Deterministic source-header completion. This module makes no provider calls,
// changes no input objects and does not infer production addresses or shoot times.
const FINAL_STORY_TIMES = new Set([
  'TAG','NACHT','MORGEN','ABEND','DÄMMERUNG',
  'DAY','NIGHT','MORNING','EVENING','DAWN','DUSK',
  'DÍA','DIA','NOCHE','MAÑANA','TARDE','AMANECER','ATARDECER',
  'GIORNO','NOTTE','MATTINA','SERA','ALBA','TRAMONTO',
  'DEN','NOC','RÁNO','VEČER','SVÍTÁNÍ','SOUMRAK',
  'NAPPAL','ÉJJEL','ÉJSZAKA','REGGEL','ESTE','HAJNAL','ALKONYAT',
  'DAG','OCHTEND','AVOND','SCHEMERING',
  'NATT','MORGON','KVÄLL','GRYNING','SKYMNING'
]);
const HEADING_PREFIX = /^(?:(?:BILD|SZENE|SCENE)\s+)?(?:\d{1,4}[A-Za-z]?(?:[./-]\d+[A-Za-z]?)?\.?\s+)?(?:INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|INNEN\s*\/\s*(?:AUSSEN|AUẞEN)|(?:AUSSEN|AUẞEN)\s*\/\s*INNEN|INT\.?|EXT\.?|INNEN|AUSSEN|AUẞEN|I\.?\s*\/\s*A\.?)(?:\s|[.:–—-])+(.+)$/iu;

function sourceHeading(scene, document, coverage) {
  const page = document.pages[scene.sourcePage - 1];
  if (!page || !Number.isInteger(scene.sourceLine) || scene.sourceLine < 1) return;
  const pieces = page.text.split(/\r\n|\r|\n/u);
  const line = pieces[scene.sourceLine - 1];
  if (typeof line !== 'string' || line.trim() !== scene.heading) return;
  let lineStart = 0, lineNumber = 1;
  for (const match of page.text.matchAll(/\r\n|\r|\n/gu)) {
    if (lineNumber === scene.sourceLine) break;
    lineStart = match.index + match[0].length; lineNumber++;
  }
  const leading = line.length - line.trimStart().length;
  const start = lineStart + leading, end = start + scene.heading.length;
  if (!coverage.some(c => c.page === scene.sourcePage && c.startUTF16 <= start && c.endUTF16 >= end)) return;
  const body = scene.heading.match(HEADING_PREFIX)?.[1]?.trim();
  if (!body) return;
  const final = body.match(/^(.*\S)\s+[-–—]\s+([^-–—]+)$/u)?.[2]?.trim();
  return {
    heading: scene.heading,
    time: final && FINAL_STORY_TIMES.has(final.normalize('NFC').toUpperCase()) ? final : undefined
  };
}

/**
 * Accepts the unchanged raw provider shape {scenes:[{id,synopsis,entries}]},
 * preferably the candidate that has already passed numeric quarantine.
 * outline and validateProviderResult are injected from the canonical core.
 * All existing content and every new fact must pass that strict validator.
 * The caller uses `scenes` as the validated native-shaped batch; `value` is
 * available only if another strict provider-shape transformation follows.
 */
export function addMissingHeadingFacts(value, document, coverage, {
  outline, validateProviderResult, documentType = 'screenplay',
  maxEntriesPerScene = 160, maxEntries = 25000
} = {}) {
  if (typeof outline !== 'function' || typeof validateProviderResult !== 'function') throw new TypeError('heading_fact_dependencies');
  if (!Number.isInteger(maxEntriesPerScene) || maxEntriesPerScene < 0 || maxEntriesPerScene > 160 || !Number.isInteger(maxEntries) || maxEntries < 0 || maxEntries > 25000) throw new TypeError('heading_fact_limits');
  const originalScenes = validateProviderResult(value, document, coverage, documentType);
  const counts = {addedLocations: 0, addedTimeOfDay: 0, skippedByLimit: 0};
  if (documentType !== 'screenplay') return {value, scenes: originalScenes, ...counts};
  const known = outline(document, documentType);
  let candidate = value, copied = false;
  let entryCount = value.scenes.reduce((n, scene) => n + scene.entries.length, 0);
  for (const scene of known) {
    const facts = sourceHeading(scene, document, coverage);
    if (!facts) continue;
    let target = candidate.scenes.find(item => item.id === scene.id);
    for (const [category, text, countKey] of [
      ['locations', facts.heading, 'addedLocations'],
      ['timeOfDay', facts.time, 'addedTimeOfDay']
    ]) {
      if (!text || target?.entries.some(entry => entry.category === category)) continue;
      if ((target?.entries.length ?? 0) >= maxEntriesPerScene || entryCount >= maxEntries) {counts.skippedByLimit++; continue;}
      if (!copied) {candidate = structuredClone(value); copied = true; target = candidate.scenes.find(item => item.id === scene.id);}
      if (!target) {target = {id: scene.id, synopsis: '', entries: []}; candidate.scenes.push(target);}
      target.entries.push({category, text, evidence: [{page: scene.sourcePage, quote: facts.heading}], interpretation: 'explicit'});
      entryCount++; counts[countKey]++;
    }
  }
  const scenes = copied ? validateProviderResult(candidate, document, coverage, documentType) : originalScenes;
  return {value: candidate, scenes, ...counts};
}
