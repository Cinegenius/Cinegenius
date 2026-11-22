import {createHash} from 'node:crypto';
import {AnalysisError} from './core.mjs';
const bad=(reason='proposal_validation',fieldID)=>{const error=new AnalysisError('invalid_work_result',502);error.safeDiagnostic={stage:'proposal',reason,...fieldID?{fieldID}:{}};throw error;};
const text=(x,max)=>typeof x==='string'&&x.length<=max&&!x.includes('\0');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>{if(!object(x)||keys.some(k=>!Object.hasOwn(x,k))||Object.keys(x).some(k=>!keys.includes(k)))bad();};
const escaped=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const hash=x=>createHash('sha256').update(x).digest('hex');
const canonical=x=>JSON.stringify(Object.fromEntries(Object.entries(x).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>[k,k==='documentID'?v.toLowerCase():v]).sort(([a],[b])=>a.localeCompare(b))));
const sourcesFor=(ids,facts)=>{const refs=new Map();for(const id of ids)for(const ref of facts.get(id).sources)refs.set(canonical(ref),ref);return [...refs.values()];};
const STATEMENTS=['sourceExplicit','inferred','planningAssumption','open','userEntered'];
export const CALL_SHEET_FIELDS=['projectName','company','version','status','shootDate','shootDay','unit','generalCall','generalCallLocation','shootingStart','lunch','plannedWrap','sourceVersion','changeNotes','notes','screenplayVersion','shootingScheduleVersion','weatherForecast','sunrise','sunset','weatherCover','emergencyContact','emergencyPhone','hospital','medicalPoint','safetyNotes','nextDayPrelim'];
export const CALL_SHEET_TABLES=Object.freeze({schedule:['phase','start','end','scene','storyTime','location','unit','notes'],crew:['department','person','crewCall','personalWorkStart','personalWorkEnd','location','phone','wrap','notes'],cast:['role','person','personalWorkStart','personalWorkEnd','pickup','arrival','makeupCall','costumeCall','travel','onSet','soundReady','rehearsal','wrap','notes'],locations:['locationType','location','address','contact','phone','access','notes'],needs:['department','item','quantity','unitOfMeasure','bookingStatus','notes'],contacts:['contactRole','person','phone','location','notes'],changeLog:['groupAffected','change','checkState','sourceVersion','notes'],attachments:['type','version','shootDay','unit','documentStatus','source','notes']});
const obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)}),str={type:'string'};
const cellSchema=obj({fieldID:str,value:str,statement:{type:'string',enum:STATEMENTS},factIDs:{type:'array',items:str}});
export const TEMPLATE_PROPOSAL_SCHEMA={anyOf:[{type:'null'},obj({kind:{type:'string',enum:['callSheet']},formFields:{type:'array',items:cellSchema},tableRows:{type:'array',items:obj({tableID:{type:'string',enum:Object.keys(CALL_SHEET_TABLES)},id:str,personOccurrenceID:{type:['string','null']},cells:{type:'array',items:cellSchema}})}})]};
const labels={
 personalCall:['personal call','call personnel','call','crew call','persönlicher call','persoonlijke call','osobní call','személyes call','personlig call'],
 personalWorkStart:['persönlicher arbeitsbeginn','arbeitsbeginn','personal work start','work start','inicio de trabajo','inizio lavoro','začátek práce','munkakezdés','persoonlijke werkstart','werkbegin','arbetsstart'],
 personalWorkEnd:['persönliches arbeitsende','arbeitsende','personal work end','work end','fin de trabajo','fine lavoro','konec práce','munka vége','persoonlijk werkeinde','werkeinde','arbetsslut'],
 pickup:['abholung','pickup','pick-up','recogida','ritiro','vyzvednutí','felvétel','ophalen','hämtning'],
 arrival:['ankunft','arrival','llegada','arrivo','příjezd','érkezés','aankomst','ankomst'],
 makeup:['maske','hmu','makeup','make-up','maquillaje','trucco','maskérna','smink','grime','sminkning'],
 costume:['kostüm','costume','vestuario','kostým','jelmez','kostuum','kostym'],
 onSet:['am set','on set','on-set','en set','sul set','na place','forgatási helyen','op de set','på inspelningsplats'],
 rehearsal:['probe','rehearsal','ensayo','prova','zkouška','próba','repetitie','repetition']
};
export const EXTRACTED_CALL_SCHEMA={type:'array',items:obj({documentID:str,page:{type:'integer'},quote:str,personName:str,timeKind:{type:'string',enum:Object.keys(labels)},literalValue:str})};
export const PROPOSAL_INSTRUCTIONS=`For callSheet you MUST return a partial editable templateProposal even when planning constraints are missing; copy the known typed fields and leave unknown fields empty/open. Use using ONLY these existing form IDs: ${CALL_SHEET_FIELDS.join(', ')}; table columns: ${JSON.stringify(CALL_SHEET_TABLES)}. It is an editable proposal, not a released document. Each field/cell carries value, statement and known factIDs; unknown values are empty/open. No status except draft. Person/time columns require explicit typed time facts with the same known personOccurrenceID as that row. GeneralCall may ONLY use generalCall facts; individual crewCall may ONLY use personalCall; personalWorkStart and personalWorkEnd have their own separate columns. row.wrap remains plannedWrap, never personalWorkEnd. Never use GeneralCall for any personal field. StoryTime never becomes an operational time. Confirmed forecasts/safety/booking states require direct matching source fields, not narrative weather or a need. No new personOccurrenceIDs in templateProposal. Return null for other tasks. Do not fill version/sourceVersion/project/company metadata fields unless a cited fact literally contains that value; source references already preserve document versions.
For callSheet or personalBrief, extractedCalls may propose conservative direct source associations ONLY from a COMPLETE single trimmed original page line containing exactly one person's name, an explicit personal time label, and exactly one HH:MM time. Example FICTIONAL syntax: 'LIA | Call: 08:00'. Quote the entire source line exactly. No table header interpretation, column reconstruction, broad paragraphs, multiple people/times, general/team calls, story time, name aliases or inferred identity. The server verifies the exact name-label-time relation and creates pending occurrence IDs. If ambiguous, leave extractedCalls empty and ask for confirmation in unknowns. These associations are new pending source occurrences, not a profile/account link or assignment. Do not reference their not-yet-created IDs in other output fields.`;

export function extractDirectCalls(candidates,context){
 if(!Array.isArray(candidates)||candidates.length>100||!['callSheet','personalBrief'].includes(context.kind)&&candidates.length)bad();
 const documents=new Map(context.documents.map(d=>[d.documentID.toLowerCase(),d])),facts=[],seen=new Set();
 for(const c of candidates){
  exact(c,['documentID','page','quote','personName','timeKind','literalValue']);
  if(!text(c.documentID,36)||!Number.isInteger(c.page)||c.page<1||!text(c.quote,400)||!text(c.personName,100)||!c.personName.trim()||/[\n\r|,;/&=<>]/.test(c.personName)||!labels[c.timeKind]||!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.literalValue))bad();
  const doc=documents.get(c.documentID.toLowerCase()),page=doc?.pages?.find(p=>p.number===c.page);
  if(!page||doc.documentType!=='callSheet'||/[\n\r]/.test(c.quote)||c.quote!==c.quote.trim()||[...(c.quote.matchAll(/\d{1,2}:\d{2}/g))].length!==1||/\b(?:general|allgemein\w*|team|tous|alle|todos|tutti|mindenki|všichni|alla)\b/iu.test(c.personName))bad();
  const sourceLines=page.text.replace(/\r\n?/g,'\n').split('\n'),line=sourceLines.findIndex(l=>l.trim()===c.quote);
  if(line<0)bad();
  const name=escaped(c.personName),label='(?:'+labels[c.timeKind].map(escaped).join('|')+')',clock=escaped(c.literalValue);
  const personFirst=new RegExp('^'+name+'\\s*(?:[|,:–—-]\\s*)?'+label+'\\s*[:=|]?\\s*'+clock+'\\.?$','iu');
  const labelFirst=new RegExp('^'+label+'(?:\\s+|\\s*[:|]\\s*)(?:(?:für|for|per|para|pro|voor)\\s+)?'+name+'\\s*[:=|]?\\s*'+clock+'\\.?$','iu');
  if(!personFirst.test(c.quote)&&!labelFirst.test(c.quote))bad();
  const identity=hash(JSON.stringify([doc.documentID.toLowerCase(),doc.sourceSHA256,doc.documentRevision,c.page,line+1,c.personName,c.timeKind,c.literalValue]));
  if(seen.has(identity))continue;seen.add(identity);
  const occurrence='source-person:'+identity,base='source-call:'+identity;
  const source={documentID:doc.documentID,sourceSHA256:doc.sourceSHA256,documentRevision:doc.documentRevision,sourceVersion:doc.sourceVersion,page:c.page,line:line+1,quote:c.quote,fieldID:'sourceCall.'+c.timeKind};
  const common={personOccurrenceIDs:[occurrence],sceneIDs:[],statement:'sourceExplicit',review:'pending',release:'draft',sources:[source]};
  facts.push({id:base+':person',kind:'person',text:c.personName,...common},{id:base+':time',kind:'time',text:c.literalValue,...common,time:{kind:c.timeKind,scope:'planned',literalValue:c.literalValue}});
 }
 return facts;
}

const timeKinds={generalCall:['generalCall'],shootingStart:['shootingStart'],lunch:['lunch'],plannedWrap:['plannedWrap'],crewCall:['personalCall'],personalWorkStart:['personalWorkStart'],personalWorkEnd:['personalWorkEnd'],pickup:['pickup'],arrival:['arrival'],makeupCall:['makeup'],costumeCall:['costume'],travel:['travel'],onSet:['onSet'],rehearsal:['rehearsal'],wrap:['plannedWrap'],start:['shootingStart'],end:['plannedWrap']};
const personalFields=new Set(['crewCall','personalWorkStart','personalWorkEnd','pickup','arrival','makeupCall','costumeCall','travel','onSet','rehearsal','wrap']);
export function validateTemplateProposal(proposal,context,restoreSources=sourcesFor){
 if(proposal===null||proposal===undefined)return undefined;
 if(context.kind!=='callSheet')bad();exact(proposal,['kind','formFields','tableRows']);
 if(proposal.kind!=='callSheet'||!Array.isArray(proposal.formFields)||!Array.isArray(proposal.tableRows)||proposal.tableRows.length>500||proposal.formFields.length>CALL_SHEET_FIELDS.length)bad();
 const facts=new Map(context.facts.map(f=>[f.id,f])),seenFields=new Set(),seenRows=new Set();
 function cell(c,allowed,personID){
  exact(c,['fieldID','value','statement','factIDs']);if(!allowed.includes(c.fieldID)||!text(c.value,4000)||!STATEMENTS.includes(c.statement)||!Array.isArray(c.factIDs)||new Set(c.factIDs).size!==c.factIDs.length||c.factIDs.some(id=>!facts.has(id))||c.value&&!['open','planningAssumption'].includes(c.statement)&&!c.factIDs.length)bad();
  const cited=c.factIDs.map(id=>facts.get(id));
  if(c.value){
   if(c.fieldID==='status'){
    if(c.value!=='draft')bad('advanced_document_status',c.fieldID);
    if(['sourceExplicit','userEntered'].includes(c.statement)&&(!cited.some(f=>f.text===c.value)||cited.some(f=>f.statement!==c.statement)))bad('unsupported_literal_or_statement',c.fieldID);
    return {...c,sources:restoreSources(c.factIDs,facts)};
   }
   if(['quantity','phone','address','shootDate','shootDay','unit','sourceVersion','screenplayVersion','shootingScheduleVersion','emergencyPhone','emergencyContact','hospital','medicalPoint'].includes(c.fieldID)&&(!['sourceExplicit','userEntered'].includes(c.statement)||!cited.some(f=>f.text.includes(c.value)||f.sources.some(s=>s.quote?.includes(c.value)))))bad('unsupported_literal_field',c.fieldID);
   if(['sourceExplicit','userEntered'].includes(c.statement)&&(!cited.some(f=>f.text.includes(c.value)||f.sources.some(s=>s.quote?.includes(c.value)))||cited.some(f=>f.statement!==c.statement)))bad('unsupported_literal_or_statement',c.fieldID);
   if(timeKinds[c.fieldID]){
    if(!['sourceExplicit','userEntered'].includes(c.statement)||!cited.some(f=>f.time&&f.time.scope!=='story'&&timeKinds[c.fieldID].includes(f.time.kind)&&f.time.literalValue===c.value&&(!personalFields.has(c.fieldID)||personID&&f.personOccurrenceIDs.includes(personID))))bad('unsupported_typed_time',c.fieldID);
   }
   if(c.fieldID==='person'&&(!personID||!cited.some(f=>f.kind==='person'&&f.personOccurrenceIDs.includes(personID)&&f.text===c.value)))bad('unbound_person',c.fieldID);
   if(['weatherForecast','sunrise','sunset','bookingStatus','documentStatus','checkState'].includes(c.fieldID)&&!cited.some(f=>f.sources.some(s=>s.fieldID===c.fieldID||s.fieldID?.endsWith('.'+c.fieldID))))bad('unsupported_status_or_forecast',c.fieldID);
  }
  return {...c,sources:restoreSources(c.factIDs,facts)};
 }
 const formFields=proposal.formFields.map(c=>{if(seenFields.has(c.fieldID))bad();seenFields.add(c.fieldID);return cell(c,CALL_SHEET_FIELDS,null);});
 const tableRows=proposal.tableRows.map(row=>{
  exact(row,['tableID','id','personOccurrenceID','cells']);
  if(!CALL_SHEET_TABLES[row.tableID]||!text(row.id,200)||!row.id||seenRows.has(row.id)||!Array.isArray(row.cells)||row.cells.length>CALL_SHEET_TABLES[row.tableID].length)bad();seenRows.add(row.id);
  if(row.personOccurrenceID!==null&&!context.facts.some(f=>f.personOccurrenceIDs.includes(row.personOccurrenceID)))bad();
  const ids=new Set();const cells=row.cells.map(c=>{if(ids.has(c.fieldID))bad();ids.add(c.fieldID);return cell(c,CALL_SHEET_TABLES[row.tableID],row.personOccurrenceID);});
  if(cells.some(c=>personalFields.has(c.fieldID)&&c.value)&&!cells.some(c=>c.fieldID==='person'&&c.value))bad('missing_person_cell');
  return {tableID:row.tableID,id:row.id,...row.personOccurrenceID!==null?{personOccurrenceID:row.personOccurrenceID}:{},cells};
 });
 return {kind:'callSheet',formFields,tableRows};
}

// Mechanical copies from typed fields are not AI assumptions. Conflicting
// values remain empty; names are never merged and rows require source identity.
export function groundedCallSheetProposal(context){
 if(context.kind!=='callSheet')return null;
 const facts=context.facts.filter(f=>['sourceExplicit','userEntered'].includes(f.statement));
 const fields=[],rows=[];
 const matchField=(f,id)=>f.sources.some(s=>s.fieldID===id||s.fieldID?.endsWith('.'+id));
 function choose(id,candidates,value=f=>f.text){
  if(!candidates.length||new Set(candidates.map(value)).size!==1)return null;
  const first=candidates[0],same=candidates.filter(f=>f.statement===first.statement);
  return {fieldID:id,value:value(first),statement:first.statement,factIDs:same.map(f=>f.id)};
 }
 for(const fieldID of CALL_SHEET_FIELDS.filter(id=>id!=='status')){
  const kinds=timeKinds[fieldID];
  const candidates=facts.filter(f=>!f.personOccurrenceIDs.length&&(kinds?f.time&&f.time.scope!=='story'&&kinds.includes(f.time.kind):matchField(f,fieldID)));
  const field=choose(fieldID,candidates,kinds?f=>f.time.literalValue:f=>f.text);if(field)fields.push(field);
 }
 const seen=new Set();
 for(const person of facts.filter(f=>f.kind==='person'&&f.personOccurrenceIDs.length===1)){
  const personID=person.personOccurrenceIDs[0];
  const source=person.sources.find(s=>['crew','cast'].includes(s.tableID)&&s.rowID&&s.fieldID==='person');
  if(!source)continue;
  const identity=canonical({documentID:source.documentID,rowID:source.rowID,tableID:source.tableID,personID});if(seen.has(identity))continue;seen.add(identity);
  const sameRow=facts.filter(f=>f.personOccurrenceIDs.includes(personID)&&f.sources.some(s=>s.documentID.toLowerCase()===source.documentID.toLowerCase()&&s.rowID===source.rowID&&s.tableID===source.tableID));
  const cells=[];
  for(const fieldID of CALL_SHEET_TABLES[source.tableID]){
   const candidates=sameRow.filter(f=>matchField(f,fieldID));const kinds=timeKinds[fieldID];
   const eligible=kinds?candidates.filter(f=>f.time&&f.time.scope!=='story'&&kinds.includes(f.time.kind)):candidates;
   const cell=choose(fieldID,eligible,kinds?f=>f.time.literalValue:f=>f.text);if(cell)cells.push(cell);
  }
  if(cells.some(c=>c.fieldID==='person'))rows.push({tableID:source.tableID,id:'source-row:'+hash(identity),personOccurrenceID:personID,cells});
 }
 return {kind:'callSheet',formFields:fields,tableRows:rows};
}

export function mergeGroundedProposal(proposal,grounded){
 if(!grounded)return proposal;
 if(proposal===null||proposal===undefined)return grounded;
 if(!object(proposal)||!Array.isArray(proposal.formFields)||!Array.isArray(proposal.tableRows))return proposal;
 const copy=structuredClone(proposal);
 for(const field of grounded.formFields)if(!copy.formFields.some(c=>c.fieldID===field.fieldID))copy.formFields.push(field);
 for(const row of grounded.tableRows){
  const existing=copy.tableRows.find(r=>r.tableID===row.tableID&&r.personOccurrenceID===row.personOccurrenceID);
  if(!existing){copy.tableRows.push(row);continue;}
  if(!Array.isArray(existing.cells))continue;
  for(const cell of row.cells)if(!existing.cells.some(c=>c.fieldID===cell.fieldID))existing.cells.push(cell);
 }
 return copy;
}
