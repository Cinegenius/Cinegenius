import {AnalysisError} from './core.mjs';
import {
  executePersonalDispo as executeStrict,
  canonicalizePersonalDispo,
  DISPO_LIMITS,
  PERSONAL_DISPO_SCHEMA,
  validatePersonalDispoAnalysis,
  validatePersonalDispoRequest
} from './personal-dispo-strict-core.mjs';

export {canonicalizePersonalDispo, validatePersonalDispoRequest};
export const MAX_REVIEW_ISSUES = 32;

const sourceText = (value, maximum = 200) =>
  typeof value === 'string' && value.length >= 1 && value.length <= maximum &&
  value.trim().length > 0 && !value.includes('\0');
const normalized = value => value.normalize('NFC').split(/\s+/u).filter(Boolean).join(' ');
const inProof = (value, proof) => proof.some(e => normalized(e.quote).includes(normalized(value)));
// Same source-label guard as the unchanged strict validator. No fuzzy matching.
const generalCall = /\b(?:general\s*call|crew\s*call|team\s*call|allgemein(?:er|e)?\s*call|allgemeiner\s*arbeitsbeginn|teamcall)\b/iu;
const callLabel = /\b(?:call|Behívás|Inställelse)\b/iu;
// Exact existing strict work-start and clock/ambiguous-row rules, without aliases.
const workStart = /\b(?:AB|Arbeitsbeginn|Dienstbeginn|work[ -]?start|working[ -]?start|start\s*of\s*work|inizio\s*lavoro|inicio\s*(?:del\s*)?trabajo|začátek\s*práce|munkakezdés|werkbegin|start\s*werk|arbetsstart)\b/iu;
const clockValues = value => new Set([...value.matchAll(/\b([01]?\d|2[0-3])[.:hH]([0-5]\d)\b/gu)]
  .filter(match => Number(match[1]) < 24).map(match => Number(match[1]) * 60 + Number(match[2])));

function departmentClassificationProof(time, input) {
  const audience = time.audience;
  if (!object(audience) || audience.kind !== 'departments' ||
      !Array.isArray(audience.personIDs) || audience.personIDs.length !== 0 ||
      !Array.isArray(audience.departments) || audience.departments.length < 1 ||
      audience.departments.length > 30 || new Set(audience.departments).size !== audience.departments.length ||
      !validSourceEvidence(time.evidence, input) || !validSourceEvidence(audience.evidence, input) ||
      !sourceText(time.literal, 300) || !inProof(time.literal, time.evidence) ||
      clockValues(time.literal).size !== 1 || time.evidence.some(entry => workStart.test(entry.quote))) return false;
  if (audience.departments.some(label => !sourceText(label, 200) || !inProof(label, audience.evidence))) return false;
  const proof = [...time.evidence, ...audience.evidence];
  // Keep the native department/time joint source binding after kind becomes unclear.
  if (!audience.departments.every(label => proof.some(entry =>
      inProof(label, [entry]) && inProof(time.literal, [entry])))) return false;
  // Preserve the strict source-row ambiguity test, including subgroup time / --.
  return !proof.some(entry => entry.quote.split(/\r\n|\r|\n/).some(line =>
    audience.departments.some(label => normalized(line).includes(normalized(label))) &&
    /\b(?:[01]?\d|2[0-3])[.:hH][0-5]\d\s*\/\s*[-–—?]{1,}/u.test(line)));
}
const fail = () => { throw new AnalysisError('invalid_schema', 502); };
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const recordKeys = ['id', 'dayID', 'itemID', 'kind', 'originalValue', 'evidence', 'status'];
const bindingKinds = new Set(['timePersonBinding', 'notePersonBinding']);
const timeKinds = new Set(PERSONAL_DISPO_SCHEMA.properties.days.items.properties.times.items.properties.kind.enum);
const issueSuffix = kind => bindingKinds.has(kind) ? '-review-people' :
  kind === 'timeClassification' ? '-review-kind' : kind === 'personDepartment' ? '-review-department' : '-review-address';

function validSourceEvidence(proof, input) {
  if (!Array.isArray(proof) || proof.length < 1 || proof.length > 5 ||
      new Set(proof.map(e => JSON.stringify(e))).size !== proof.length) return false;
  return proof.every(e => object(e) && Object.keys(e).length === 2 &&
    Object.hasOwn(e, 'page') && Object.hasOwn(e, 'quote') &&
    Number.isSafeInteger(e.page) && e.page >= 1 && e.page <= input.document.pages.length &&
    sourceText(e.quote, 4000) && input.document.pages[e.page - 1].text.includes(e.quote));
}

function sourceValidPersonWithoutDepartment(person, input) {
  return object(person) && validSourceEvidence(person.evidence, input) &&
    sourceText(person.name, 200) && inProof(person.name, person.evidence) &&
    (person.role === undefined || (sourceText(person.role, 300) && inProof(person.role, person.evidence)));
}

function sourceValidPeopleAudience(audience, day, input) {
  if (!object(audience) || audience.kind !== 'people' || !validSourceEvidence(audience.evidence, input) ||
      !Array.isArray(audience.personIDs) || audience.personIDs.length < 1 || audience.personIDs.length > 100 ||
      new Set(audience.personIDs).size !== audience.personIDs.length ||
      !Array.isArray(audience.departments) || audience.departments.length !== 0) return false;
  if (audience.units !== undefined && (!Array.isArray(audience.units) || audience.units.length < 1 ||
      audience.units.length > 20 || new Set(audience.units).size !== audience.units.length ||
      audience.units.some(unit => !sourceText(unit, 200) || !inProof(unit, audience.evidence)))) return false;
  const people = new Map(day.people.map(person => [person.id, person]));
  if (people.size !== day.people.length) return false;
  return audience.personIDs.every(id => {
    const person = people.get(id);
    return sourceText(id, 100) && sourceValidPersonWithoutDepartment(person, input) &&
      (person.department === undefined || (sourceText(person.department, 200) && inProof(person.department, person.evidence)));
  });
}

function strictProbeFailure(working, input, dayIndex, section, itemIndex, edit) {
  const probe = structuredClone(working);
  edit(probe.days[dayIndex][section][itemIndex]);
  try { canonicalizePersonalDispo(probe, input); return null; }
  catch (error) { return error; }
}

function pendingPersonBinding(error, working, input, dayIndex, section, itemIndex) {
  if (!['times', 'notes'].includes(section)) return null;
  const day = working.days[dayIndex], item = day[section][itemIndex];
  if (!validSourceEvidence(item.evidence, input) || !sourceValidPeopleAudience(item.audience, day, input)) return null;
  if (section === 'times') {
    if (!timeKinds.has(item.kind) || !sourceText(item.literal, 300) || !inProof(item.literal, item.evidence)) return null;
    // Changing classification alone must leave this SAME strict binding error.
    // A missing AB/end label alone cannot qualify as a person-binding issue.
    const probe = strictProbeFailure(working, input, dayIndex, section, itemIndex, t => { t.kind = 'unclear'; });
    if (!(probe instanceof AnalysisError) || probe.code !== 'invalid_evidence' || probe.validationPath !== error.validationPath) return null;
  } else {
    if (!sourceText(item.text, 2000) || !inProof(item.text, item.evidence)) return null;
    const probe = strictProbeFailure(working, input, dayIndex, section, itemIndex, note => {
      note.audience.kind = 'unclear'; note.audience.personIDs = [];
    });
    if (probe && (!(probe instanceof AnalysisError) || probe.validationPath === error.validationPath)) return null;
  }
  return {dayIndex, section, itemIndex,
    kind: section === 'times' ? 'timePersonBinding' : 'notePersonBinding',
    originalValue: section === 'times' ? item.kind : 'people',
    originalPersonIDs: [...item.audience.personIDs], evidence: structuredClone(item.evidence)};
}

function pendingIssueForFailure(error, working, input) {
  if (!(error instanceof AnalysisError) || error.code !== 'invalid_evidence') return null;
  const match = error.validationPath?.match(/^days\[(\d+)\]\.(times|people|locations|notes)\[(\d+)\]$/);
  if (!match) return null;
  const dayIndex = Number(match[1]), section = match[2], itemIndex = Number(match[3]);
  const item = working.days?.[dayIndex]?.[section]?.[itemIndex];
  if (!object(item)) return null;
  const binding = pendingPersonBinding(error, working, input, dayIndex, section, itemIndex);
  if (binding) return binding;
  if (section === 'notes') return null;
  if (section === 'times') {
    if (item.kind === 'departmentWorkStart' && departmentClassificationProof(item, input)) {
      return {dayIndex, section, itemIndex, kind: 'timeClassification',
        originalValue: 'departmentWorkStart', evidence: structuredClone(item.evidence)};
    }
    // Only the demonstrated missing Call-label or GeneralCall conflict qualify.
    // Demotion cannot alter or relax any remaining evidence/audience test.
    if (item.kind !== 'personalCall' || item.audience?.kind !== 'people' || !validSourceEvidence(item.evidence, input) ||
        !sourceText(item.literal, 300) || !inProof(item.literal, item.evidence) ||
        (item.evidence.some(e => callLabel.test(e.quote)) &&
         !item.evidence.some(e => generalCall.test(e.quote) && inProof(item.literal, [e])))) return null;
    return {dayIndex, section, itemIndex, kind: 'timeClassification', originalValue: 'personalCall',
      evidence: structuredClone(item.evidence)};
  }
  if (section === 'locations') {
    // Optional address only. Never borrow proof or infer a replacement address.
    if (!validSourceEvidence(item.evidence, input) || !sourceText(item.label, 300) ||
        !inProof(item.label, item.evidence) || !sourceText(item.address, 1000) ||
        inProof(item.address, item.evidence)) return null;
    return {dayIndex, section, itemIndex, kind: 'locationAddress', originalValue: item.address,
      evidence: structuredClone(item.evidence)};
  }
  // An unsupported optional label may be held for review, never completed
  // with an unrelated source quote. Names/roles/proofs must already be valid.
  if (!sourceValidPersonWithoutDepartment(item, input) ||
      !sourceText(item.department, 200) || inProof(item.department, item.evidence)) return null;
  return {dayIndex, section, itemIndex, kind: 'personDepartment', originalValue: item.department,
    evidence: structuredClone(item.evidence)};
}

function pendingDayHeaderForFailure(error, working, input) {
  if (!(error instanceof AnalysisError) || error.code !== 'invalid_evidence') return null;
  const match = error.validationPath?.match(/^days\[(\d+)\]$/);
  if (!match) return null;
  const dayIndex = Number(match[1]), day = working.days?.[dayIndex];
  if (!object(day) || !validSourceEvidence(day.evidence, input) ||
      (day.dateISO === undefined && day.dateLiteral === undefined && day.shootingDay === undefined)) return null;
  const probe = structuredClone(working);
  delete probe.days[dayIndex].dateISO;
  delete probe.days[dayIndex].dateLiteral;
  delete probe.days[dayIndex].shootingDay;
  try { canonicalizePersonalDispo(probe, input); }
  catch (probeError) {
    if (probeError instanceof AnalysisError && probeError.code === error.code &&
        probeError.validationPath === error.validationPath) return null;
  }
  return {dayIndex, kind: 'dayHeaderEvidence'};
}

/** Strict original fact validation plus the narrowly bounded review envelope. */
export function validateRecoveryAnalysis(value, input) {
  if (!object(value)) fail();
  const {reviewIssues, ...facts} = value;
  validatePersonalDispoAnalysis(facts, input);
  if (reviewIssues === undefined) return value;
  if (!Array.isArray(reviewIssues) || reviewIssues.length < 1 || reviewIssues.length > MAX_REVIEW_ISSUES) fail();
  const days = new Map(facts.days.map(day => [day.id, day]));
  const allIDs = new Set(facts.days.flatMap(day => [day.id,
    ...['people', 'times', 'locations', 'notes', 'contacts'].flatMap(key => day[key].map(item => item.id))]));
  const targetPairs = new Set();
  const canonicalFacts = reviewIssues.some(issue => bindingKinds.has(issue?.kind)) ? canonicalizePersonalDispo(facts, input) : null;
  for (const issue of reviewIssues) {
    const keys = [...recordKeys, ...(bindingKinds.has(issue?.kind) ? ['originalPersonIDs'] : [])];
    if (!object(issue) || Object.keys(issue).length !== keys.length ||
        keys.some(key => !Object.hasOwn(issue, key)) || issue.status !== 'unconfirmed' ||
        !sourceText(issue.id, 100) || allIDs.has(issue.id) || !sourceText(issue.dayID, 100) ||
        !sourceText(issue.itemID, 100) || !['timeClassification', 'personDepartment', 'locationAddress', 'timePersonBinding', 'notePersonBinding'].includes(issue.kind)) fail();
    allIDs.add(issue.id);
    const pair = JSON.stringify([issue.dayID, issue.itemID]);
    if (targetPairs.has(pair)) fail();
    targetPairs.add(pair);
    const day = days.get(issue.dayID);
    const section = ['timeClassification', 'timePersonBinding'].includes(issue.kind) ? 'times' :
      issue.kind === 'personDepartment' ? 'people' : issue.kind === 'notePersonBinding' ? 'notes' : 'locations';
    const item = day?.[section].find(item => item.id === issue.itemID);
    const suffix = issueSuffix(issue.kind);
    if (!item || issue.id !== issue.itemID + suffix ||
        !validSourceEvidence(issue.evidence, input) || !equal(issue.evidence, item.evidence)) fail();
    if (bindingKinds.has(issue.kind)) {
      if (item.audience.kind !== 'unclear' || item.audience.personIDs.length || item.audience.departments.length ||
          !Array.isArray(issue.originalPersonIDs) || issue.originalPersonIDs.length < 1 || issue.originalPersonIDs.length > 100 ||
          new Set(issue.originalPersonIDs).size !== issue.originalPersonIDs.length) fail();
      const dayPeople = new Set(day.people.map(person => person.id));
      if (issue.originalPersonIDs.some(id => !sourceText(id, 100) || !dayPeople.has(id))) fail();
      const dayIndex = facts.days.indexOf(day), canonicalDay = canonicalFacts.days[dayIndex];
      if (day.id !== canonicalDay.id || day.people.some((person,index) => person.id !== canonicalDay.people[index].id)) fail();
      if (issue.kind === 'timePersonBinding' ? item.kind !== 'unclear' || !timeKinds.has(issue.originalValue) : issue.originalValue !== 'people') fail();
    } else if (issue.kind === 'timeClassification') {
      if (item.kind !== 'unclear') fail();
      if (issue.originalValue === 'departmentWorkStart') {
        if (!departmentClassificationProof(item, input)) fail();
      } else if (item.audience.kind !== 'people' || issue.originalValue !== 'personalCall' ||
                 (item.evidence.some(e => callLabel.test(e.quote)) &&
                  !item.evidence.some(e => generalCall.test(e.quote) && inProof(item.literal, [e])))) fail();
    } else if (issue.kind === 'personDepartment') {
      if (item.department !== undefined || !sourceText(issue.originalValue, 200) ||
          inProof(issue.originalValue, item.evidence)) fail();
    } else if (item.address !== undefined || !sourceText(issue.originalValue, 1000) ||
               inProof(issue.originalValue, item.evidence)) fail();
  }
  if (Buffer.byteLength(JSON.stringify(value)) > DISPO_LIMITS.resultBytes)
    throw new AnalysisError('provider_response_too_large', 413);
  return value;
}

/**
 * Bounded unconfirmed recovery, followed by complete strict fact validation.
 * Unproved people bindings become unclear; original IDs remain review-only.
 * Literals, units, both evidence arrays and record order never change.
 */
export function recoverCanonicalPersonalDispo(restored, input, {
  maxCorrections = MAX_REVIEW_ISSUES, signal, onPrivateDiagnostic
} = {}) {
  if (!Number.isSafeInteger(maxCorrections) || maxCorrections < 1 || maxCorrections > MAX_REVIEW_ISSUES)
    throw new AnalysisError('invalid_configuration', 503);
  validatePersonalDispoRequest(input);
  const working = structuredClone(restored), pending = [];
  const dayHeaderCorrections = [];
  const record = event => { try { onPrivateDiagnostic?.(event); } catch {} };
  for (;;) {
    signal?.throwIfAborted();
    let result;
    try { result = canonicalizePersonalDispo(working, input); }
    catch (error) {
      const dayHeader = pendingDayHeaderForFailure(error, working, input);
      if (dayHeader && pending.length + dayHeaderCorrections.length < maxCorrections &&
          !dayHeaderCorrections.some(p => p.dayIndex === dayHeader.dayIndex)) {
        const day = working.days[dayHeader.dayIndex];
        delete day.dateISO; delete day.dateLiteral; delete day.shootingDay;
        dayHeaderCorrections.push(dayHeader);
        continue;
      }
      const issue = pendingIssueForFailure(error, working, input);
      if (!issue || pending.length + dayHeaderCorrections.length >= maxCorrections || pending.some(p => p.dayIndex === issue.dayIndex && p.section === issue.section && p.itemIndex === issue.itemIndex)) {
        if (error instanceof AnalysisError && !error.validationStage) error.validationStage = 'validation';
        record({stage: 'recovery', recovered: false, attemptedCorrections: pending.length + dayHeaderCorrections.length,
          clearedDayHeaders: dayHeaderCorrections.map(({dayIndex}) => ({dayIndex})),
          pendingTargets: pending.map(({dayIndex, section, itemIndex, kind}) => ({dayIndex, section, itemIndex, kind})),
          remainingFailure: {code: error.code, path: error.validationPath}});
        throw error;
      }
      const item = working.days[issue.dayIndex][issue.section][issue.itemIndex];
      if (bindingKinds.has(issue.kind)) {
        if (issue.kind === 'timePersonBinding') item.kind = 'unclear';
        item.audience.kind = 'unclear'; item.audience.personIDs = [];
      } else if (issue.kind === 'timeClassification') item.kind = 'unclear';
      else if (issue.kind === 'personDepartment') delete item.department;
      else delete item.address;
      pending.push(issue);
      continue;
    }
    if (!pending.length) {
      if (dayHeaderCorrections.length) record({stage: 'recovery', recovered: true,
        attemptedCorrections: dayHeaderCorrections.length,
        clearedDayHeaders: dayHeaderCorrections.map(({dayIndex}) => ({dayIndex}))});
      return result;
    }
    result.reviewIssues = pending.map(issue => {
      const day = result.days[issue.dayIndex], item = day[issue.section][issue.itemIndex];
      if (!equal(item.evidence, issue.evidence)) fail();
      const review = {id: item.id + issueSuffix(issue.kind),
        dayID: day.id, itemID: item.id, kind: issue.kind, originalValue: issue.originalValue,
        evidence: structuredClone(issue.evidence), status: 'unconfirmed'};
      if (bindingKinds.has(issue.kind)) {
        const sourcePeople = working.days[issue.dayIndex].people;
        review.originalPersonIDs = issue.originalPersonIDs.map(id => {
          const index = sourcePeople.findIndex(person => person.id === id);
          if (index < 0 || !day.people[index]) throw new AnalysisError('invalid_evidence', 502);
          return day.people[index].id;
        });
      }
      return review;
    });
    validateRecoveryAnalysis(result, input);
    record({stage: 'recovery', recovered: true, attemptedCorrections: pending.length + dayHeaderCorrections.length,
      clearedDayHeaders: dayHeaderCorrections.map(({dayIndex}) => ({dayIndex})),
      reviewIssues: structuredClone(result.reviewIssues)});
    return result;
  }
}

/** Exactly the original provider input, one generation, no prompt modification. */
export async function executePersonalDispo(input, options = {}) {
  const {maxCorrections = MAX_REVIEW_ISSUES, onPrivateDiagnostic, ...strictOptions} = options;
  if (!Number.isSafeInteger(maxCorrections) || maxCorrections < 1 || maxCorrections > MAX_REVIEW_ISSUES)
    throw new AnalysisError('invalid_configuration', 503);
  let restored;
  const diagnostic = event => {
    if (event.stage === 'restore') restored = structuredClone(event.restored);
    try { onPrivateDiagnostic?.(event); } catch {}
  };
  try { return await executeStrict(input, {...strictOptions, onPrivateDiagnostic: diagnostic}); }
  catch (error) {
    if (!(error instanceof AnalysisError) || error.code !== 'invalid_evidence' ||
        error.validationStage !== 'validation' || !restored) throw error;
    const result = recoverCanonicalPersonalDispo(restored, input, {
      maxCorrections, signal: options.signal, onPrivateDiagnostic
    });
    try { onPrivateDiagnostic?.({stage: 'complete', result}); } catch {}
    return result;
  }
}
