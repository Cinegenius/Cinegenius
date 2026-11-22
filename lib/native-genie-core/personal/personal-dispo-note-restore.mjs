import {AnalysisError} from './core.mjs';
import {canonicalizePersonalDispo,executePersonalDispo as strictExecute} from './personal-dispo-strict-core.mjs';

const normalized=s=>s.normalize('NFC').split(/\s+/u).filter(Boolean).join(' ');
const alreadySupported=note=>note.evidence.some(e=>normalized(e.quote).includes(normalized(note.text)));
const asciiFold=s=>s.replace(/[A-Z]/g,c=>String.fromCharCode(c.charCodeAt(0)+32));
const validText=(s,max)=>typeof s==='string'&&s.length>0&&s.length<=max&&s.trim().length>0&&!s.includes('\0');

/** Unique unchanged substring, differing only by ASCII letter case. */
export function uniqueOriginalNoteText(note,input){
 if(!note||!validText(note.text,2000)||!Array.isArray(note.evidence)||note.evidence.length<1||note.evidence.length>5||new Set(note.evidence.map(e=>JSON.stringify(e))).size!==note.evidence.length)return undefined;
 for(const e of note.evidence)if(!e||Object.keys(e).length!==2||!Number.isSafeInteger(e.page)||e.page<1||e.page>input.document.pages.length||!validText(e.quote,4000)||!input.document.pages[e.page-1].text.includes(e.quote))return undefined;
 // This is only the unchanged strict validator's do-nothing guard for already
 // valid legacy values. NFC/whitespace NEVER locate or construct a repair.
 if(alreadySupported(note))return undefined;
 const target=asciiFold(note.text);let original;
 for(const {quote} of note.evidence){
  // ASCII-only folding preserves every UTF16 position and all punctuation,
  // whitespace and non-ASCII code units. No per-character sliding window.
  const folded=asciiFold(quote),start=folded.indexOf(target);
  if(start<0)continue;
  if(original!==undefined||folded.indexOf(target,start+1)>=0)return undefined;
  original=quote.slice(start,start+note.text.length);
 }
 return original;
}

export function canonicalizeWithExactNoteRestore(restored,input,{onPrivateDiagnostic}={}){
 const working=structuredClone(restored);let restoredCount=0;
 for(;;){
  try{const result=canonicalizePersonalDispo(working,input);try{onPrivateDiagnostic?.({stage:'exact_note_restore',restoredCount});}catch{}return result;}
  catch(error){
   if(!(error instanceof AnalysisError)||error.code!=='invalid_evidence')throw error;
   const m=error.validationPath?.match(/^days\[(\d+)\]\.notes\[(\d+)\]$/u);if(!m)throw error;
   const note=working.days?.[Number(m[1])]?.notes?.[Number(m[2])],original=uniqueOriginalNoteText(note,input);
   if(original===undefined)throw error;
   note.text=original;restoredCount++;
   // Complete original strict validation follows. All other fields unchanged.
  }
 }
}

export async function executeWithExactNoteRestore(input,options={}){
 const {onPrivateDiagnostic,...rest}=options;let restored;
 const observe=event=>{if(event.stage==='restore')restored=structuredClone(event.restored);try{onPrivateDiagnostic?.(event);}catch{}};
 try{return await strictExecute(input,{...rest,onPrivateDiagnostic:observe});}
 catch(error){
  if(!(error instanceof AnalysisError)||error.code!=='invalid_evidence'||error.validationStage!=='validation'||!restored)throw error;
  return canonicalizeWithExactNoteRestore(restored,input,{onPrivateDiagnostic});
 }
}
