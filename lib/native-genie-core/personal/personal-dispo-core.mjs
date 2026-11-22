// Private preview candidate. Strict canonicalization and provider contract remain separate.
export * from './personal-dispo-strict-core.mjs';
import {AnalysisError} from './core.mjs';
import {executePersonalDispo as strictExecute,validatePersonalDispoRequest} from './personal-dispo-strict-core.mjs';
import {recoverCanonicalPersonalDispo,validateRecoveryAnalysis,MAX_REVIEW_ISSUES} from './personal-dispo-recovery.mjs';
import {uniqueOriginalNoteText} from './personal-dispo-note-restore.mjs';
import {clearUnsupportedOrdinalISOs} from './personal-dispo-unknown-ordinal-date.mjs';
export {validateRecoveryAnalysis};

export function canonicalizeCombined(restored,input,options={}){
 validatePersonalDispoRequest(input);
 const working=structuredClone(restored);let exactNoteRestores=0;
 const unknownOrdinalDates=clearUnsupportedOrdinalISOs(working,input);
 for(const day of working.days??[])for(const note of day.notes??[]){
  const original=uniqueOriginalNoteText(note,input);
  if(original!==undefined){note.text=original;exactNoteRestores++;}
 }
 const result=recoverCanonicalPersonalDispo(working,input,options);
 try{options.onPrivateDiagnostic?.({stage:'unknown_ordinal_date',clearedDateISOCount:unknownOrdinalDates});}catch{}
 try{options.onPrivateDiagnostic?.({stage:'exact_note_restore',restoredCount:exactNoteRestores});}catch{}
 return result;
}

export async function executePersonalDispo(input,options={}){
 const {maxCorrections,onPrivateDiagnostic,...strictOptions}=options;let restored;
 if(maxCorrections!==undefined&&(!Number.isSafeInteger(maxCorrections)||maxCorrections<1||maxCorrections>MAX_REVIEW_ISSUES))throw new AnalysisError('invalid_configuration',503);
 const observe=event=>{if(event.stage==='restore')restored=structuredClone(event.restored);try{onPrivateDiagnostic?.(event);}catch{}};
 try{return await strictExecute(input,{...strictOptions,onPrivateDiagnostic:observe});}
 catch(error){
  if(!(error instanceof AnalysisError)||error.code!=='invalid_evidence'||error.validationStage!=='validation'||!restored)throw error;
  const result=canonicalizeCombined(restored,input,{...(maxCorrections===undefined?{}:{maxCorrections}),
   signal:options.signal,onPrivateDiagnostic});
  try{onPrivateDiagnostic?.({stage:'complete',result});}catch{}
  return result;
 }
}
