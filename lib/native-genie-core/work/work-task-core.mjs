import {AnalysisError,LOCALES} from './core.mjs';
import {TASK_SECTIONS,workTaskInstructions} from './work-task-prompts.mjs';
import {TEMPLATE_PROPOSAL_SCHEMA,EXTRACTED_CALL_SCHEMA,extractDirectCalls,validateTemplateProposal,groundedCallSheetProposal,mergeGroundedProposal} from './work-task-proposals.mjs';
import {includeGroundedLiterals} from './work-task-literals.mjs';

export const WORK_LIMITS=Object.freeze({bodyBytes:4*1024*1024,facts:35000,documents:100,contextFacts:4000,contextUTF16:450000,resultBytes:4*1024*1024,items:4000});
export const WORK_KINDS=Object.freeze(Object.keys(TASK_SECTIONS));
const STATEMENTS=['sourceExplicit','inferred','planningAssumption','open','userEntered'];
const REVIEWS=['pending','accepted','rejected'],RELEASES=['draft','reviewed','released','withdrawn'];
const FACT_KINDS=['observation','person','role','location','scene','assignment','time','requirement','continuity','openQuestion'];
const TIME_KINDS=['generalCall','personalCall','personalWorkStart','personalWorkEnd','shootingStart','lunch','plannedWrap','pickup','arrival','makeup','costume','onSet','rehearsal','travel','storyTime','other'];
const SOURCE_KEYS=['documentID','sourceSHA256','documentRevision','sourceVersion','sceneID','entryID','page','line','quote','tableID','rowID','fieldID','dayID'];
const fail=(code='invalid_request',status=400)=>{throw new AnalysisError(code,status)};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=(x,max,min=0)=>typeof x==='string'&&x.length>=min&&x.length<=max&&!x.includes('\0');
const uuid=x=>typeof x==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(x);
const sha=x=>typeof x==='string'&&x.length===64&&/^[a-f0-9]{64}$/.test(x);
const int=(x,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const key=x=>x.toLowerCase();
function shape(x,required,optional=[],code='invalid_request',status=400){if(!object(x)||required.some(k=>!Object.hasOwn(x,k))||Object.keys(x).some(k=>![...required,...optional].includes(k))){const error=new AnalysisError(code,status);if(code==='invalid_work_result')error.safeDiagnostic={stage:'result',reason:'object_keys'};throw error;}}
function list(x,max,each){if(!Array.isArray(x)||x.length>max||each&&!x.every(each))fail();return x;}
const unique=x=>new Set(x).size===x.length;
const ids=x=>list(x,WORK_LIMITS.facts,v=>text(v,200,1));
export function validDate(value){if(!text(value,10,10)||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===value;}
function validZone(value){if(!text(value,200,1))return false;try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}}
const optional=(x,name,check)=>x[name]===undefined||x[name]===null||check(x[name]);
function sourceRef(ref,docs){
 shape(ref,['documentID','sourceSHA256','documentRevision','sourceVersion'],SOURCE_KEYS.slice(4));
 const doc=uuid(ref.documentID)&&docs.get(key(ref.documentID));
 if(!doc||ref.sourceSHA256!==doc.sourceSHA256||ref.documentRevision!==doc.documentRevision||ref.sourceVersion!==doc.sourceVersion)fail('source_mismatch');
 for(const field of ['sceneID','entryID','tableID','rowID','fieldID','dayID'])if(!optional(ref,field,v=>text(v,200,1)))fail('source_mismatch');
 if(!optional(ref,'page',v=>int(v,1,500))||!optional(ref,'line',v=>int(v,1))||!optional(ref,'quote',v=>text(v,1200,1)))fail('source_mismatch');
 if(doc.pages&&ref.quote&&!ref.page)fail('source_mismatch');
 if(doc.pages&&ref.page&&(!doc.pages[ref.page-1]||ref.quote&&!doc.pages[ref.page-1].text.includes(ref.quote)))fail('source_mismatch');
}
export function validateWorkRequest(input){
 shape(input,['schemaVersion','requestID','kind','locale','documents','facts','parameters'],['projectID']);
 if(input.schemaVersion!==1||!uuid(input.requestID)||!WORK_KINDS.includes(input.kind)||!LOCALES.includes(input.locale)||!optional(input,'projectID',uuid))fail();
 list(input.documents,WORK_LIMITS.documents);list(input.facts,WORK_LIMITS.facts);
 const docs=new Map();let pageCharacters=0;
 for(const doc of input.documents){
  shape(doc,['documentID','sourceSHA256','documentRevision','sourceVersion','documentType','title','contentFingerprint'],['pages']);
  if(!uuid(doc.documentID)||docs.has(key(doc.documentID))||!sha(doc.sourceSHA256)||!sha(doc.contentFingerprint)||!int(doc.documentRevision)||!text(doc.sourceVersion,4000)||!text(doc.title,4000)||!text(doc.documentType,100))fail();
  if(doc.pages!==undefined&&doc.pages!==null){list(doc.pages,500);for(const [i,page]of doc.pages.entries()){shape(page,['number','text']);if(page.number!==i+1||!text(page.text,1500000))fail();pageCharacters+=page.text.length;if(pageCharacters>1500000)fail('too_large',413);}}
  docs.set(key(doc.documentID),doc);
 }
 const factIDs=new Set();
 for(const fact of input.facts){
  shape(fact,['id','kind','text','personOccurrenceIDs','sceneIDs','statement','review','release','sources'],['departmentID','dateISO','time']);
  if(!text(fact.id,200,1)||factIDs.has(fact.id)||!FACT_KINDS.includes(fact.kind)||!text(fact.text,8000)||!STATEMENTS.includes(fact.statement)||!REVIEWS.includes(fact.review)||!RELEASES.includes(fact.release)||!optional(fact,'departmentID',v=>text(v,200,1))||!optional(fact,'dateISO',validDate))fail();
  ids(fact.personOccurrenceIDs);ids(fact.sceneIDs);if(!unique(fact.personOccurrenceIDs)||!unique(fact.sceneIDs))fail();
  list(fact.sources,1000);if(!fact.sources.length)fail('source_mismatch');for(const ref of fact.sources)sourceRef(ref,docs);
  if(fact.time!==undefined&&fact.time!==null){const t=fact.time;shape(t,['kind','scope','literalValue'],['dateISO','timeZoneID']);if(!TIME_KINDS.includes(t.kind)||!['source','planned','live','story'].includes(t.scope)||!text(t.literalValue,200)||!optional(t,'dateISO',validDate)||!optional(t,'timeZoneID',validZone))fail();}
  factIDs.add(fact.id);
 }
 const p=input.parameters;
 shape(p,['prompt','selectedFactIDs','selectedSceneIDs','selectedPersonOccurrenceIDs','departmentIDs','sourcePins','constraints','includeUnreviewed'],['dateISO','timeZoneID']);
 if(!text(p.prompt,8000)||typeof p.includeUnreviewed!=='boolean'||!optional(p,'dateISO',validDate)||!optional(p,'timeZoneID',validZone))fail();
 for(const field of ['selectedFactIDs','selectedSceneIDs','selectedPersonOccurrenceIDs','departmentIDs']){ids(p[field]);if(!unique(p[field]))fail();}
 if(p.selectedFactIDs.some(id=>!factIDs.has(id)))fail('unsupported_reference');
 const scenes=new Set(input.facts.flatMap(f=>[...f.sceneIDs,...f.sources.map(r=>r.sceneID).filter(Boolean)]));
 const people=new Set(input.facts.flatMap(f=>f.personOccurrenceIDs));
 if(p.selectedSceneIDs.some(id=>!scenes.has(id))||p.selectedPersonOccurrenceIDs.some(id=>!people.has(id)))fail('unsupported_reference');
 list(p.sourcePins,100);const pinned=new Set();for(const pin of p.sourcePins){shape(pin,['documentID','sourceSHA256','documentRevision']);const doc=uuid(pin.documentID)&&docs.get(key(pin.documentID));if(!doc||pinned.has(key(pin.documentID))||doc.sourceSHA256!==pin.sourceSHA256||doc.documentRevision!==pin.documentRevision)fail('source_mismatch');pinned.add(key(pin.documentID));}
 list(p.constraints,500);const constraints=new Set();for(const c of p.constraints){shape(c,['id','kind','strength','value','factIDs']);if(!text(c.id,200,1)||constraints.has(c.id)||!text(c.kind,100,1)||!['hard','soft'].includes(c.strength)||!text(c.value,4000))fail();ids(c.factIDs);if(!unique(c.factIDs)||c.factIDs.some(id=>!factIDs.has(id)))fail('unsupported_reference');constraints.add(c.id);}
 return input;
}

const REQUIRED=Object.freeze({shootingPlan:['shootWindow','locationAvailability','castAvailability','workRules','shootDuration','unitCapacity'],callSheet:['date','timeZone','locationConfirmed','generalCall','shootingStart','plannedWrap','workRules']});
export function prepareWorkContext(request){
 validateWorkRequest(request);
 const p=request.parameters,selected=new Set(p.selectedFactIDs),pins=new Set(p.sourcePins.map(p=>key(p.documentID)));
 let facts=request.facts.filter(f=>f.review!=='rejected'&&f.release!=='withdrawn'&&(p.includeUnreviewed||f.review==='accepted'||f.statement==='userEntered')&&(selected.has(f.id)||!selected.size&&request.kind!=='search')&&(!pins.size||f.sources.every(r=>pins.has(key(r.documentID)))));
 const any=(values,wanted)=>wanted.length===0||values.some(v=>wanted.includes(v));
 const datedPersonSources=facts.filter(f=>p.dateISO&&f.time?.dateISO===p.dateISO&&f.time.scope!=='story'&&f.personOccurrenceIDs.some(id=>p.selectedPersonOccurrenceIDs.includes(id)));
 const identityContext=f=>request.kind==='personalBrief'&&f.kind==='person'&&!f.dateISO&&datedPersonSources.some(t=>t.personOccurrenceIDs.some(id=>f.personOccurrenceIDs.includes(id))&&t.sources.some(a=>f.sources.some(b=>key(a.documentID)===key(b.documentID))));
 facts=facts.filter(f=>any([...f.sceneIDs,...f.sources.map(r=>r.sceneID).filter(Boolean)],p.selectedSceneIDs)&&(!p.departmentIDs.length||p.departmentIDs.includes(f.departmentID))&&(!p.dateISO||f.dateISO===p.dateISO||f.time?.dateISO===p.dateISO||identityContext(f)));
 if(p.selectedPersonOccurrenceIDs.length){
  const directlyRelevant=facts.filter(f=>any(f.personOccurrenceIDs,p.selectedPersonOccurrenceIDs));
  const relatedScenes=new Set(directlyRelevant.flatMap(f=>f.sceneIDs));
  facts=facts.filter(f=>any(f.personOccurrenceIDs,p.selectedPersonOccurrenceIDs)||(request.kind==='personalBrief'&&f.sceneIDs.some(id=>relatedScenes.has(id))&&f.kind!=='person'&&f.kind!=='assignment'&&f.time?.kind!=='personalCall'));
 }
 const knownIDs=new Set(facts.map(f=>f.id));
 const constraints=p.constraints.filter(c=>c.factIDs.every(id=>knownIDs.has(id)));
 const available=new Set(constraints.filter(c=>c.value.trim()).map(c=>c.kind));
 if(p.dateISO)available.add('date');if(p.timeZoneID)available.add('timeZone');
 for(const f of facts){if(f.time&&f.time.scope!=='story'&&['generalCall','shootingStart','plannedWrap'].includes(f.time.kind))available.add(f.time.kind);if(f.dateISO||f.time?.dateISO&&f.time.scope!=='story')available.add('date');}
 const missingRequiredConstraints=(REQUIRED[request.kind]??[]).filter(k=>!available.has(k));
 const docIDs=new Set(facts.flatMap(f=>f.sources.map(r=>key(r.documentID))));
 const documents=request.documents.filter(d=>docIDs.has(key(d.documentID))||!facts.length&&(!pins.size||pins.has(key(d.documentID))));
 const omittedFactIDs=request.facts.filter(f=>!knownIDs.has(f.id)).map(f=>f.id);
 const context={kind:request.kind,locale:request.locale,documents,facts,parameters:{...p,constraints},missingRequiredConstraints};
 if(facts.length>WORK_LIMITS.contextFacts||JSON.stringify(context).length>WORK_LIMITS.contextUTF16)fail('context_too_large',413);
 return {...context,omittedFactIDs};
}

const schemaObject=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const string={type:'string'},strings={type:'array',items:string},nullableString={type:['string','null']};
const itemBranch=statements=>schemaObject({id:{type:'string',minLength:1},title:string,text:string,statement:{type:'string',enum:statements},factIDs:{type:'array',...statements.includes('open')?{}:{minItems:1},items:string}});
const itemSchema={anyOf:[itemBranch(['sourceExplicit','inferred','userEntered']),itemBranch(['open','planningAssumption'])]};
const rowSchema=schemaObject({id:string,sceneIDs:strings,dayKey:nullableString,dateISO:nullableString,unit:nullableString,order:{type:['integer','null']},start:nullableString,end:nullableString,durationMinutes:{type:['integer','null']},statement:{type:'string',enum:STATEMENTS},factIDs:strings});
export function workProviderSchema(kind,context){
 if(!WORK_KINDS.includes(kind))fail();
 const schema=structuredClone(schemaObject({status:{type:'string',enum:['ready','insufficientInformation']},sections:{type:'array',minItems:TASK_SECTIONS[kind].length,maxItems:TASK_SECTIONS[kind].length,items:schemaObject({id:{type:'string',enum:TASK_SECTIONS[kind]},title:string,items:{type:'array',items:itemSchema}})},planRows:{type:'array',items:rowSchema,...kind!=='shootingPlan'?{maxItems:0}:{}},unknowns:{type:'array',items:itemSchema},limitations:strings,templateProposal:kind==='callSheet'?TEMPLATE_PROPOSAL_SCHEMA.anyOf[1]:{type:'null'},extractedCalls:EXTRACTED_CALL_SCHEMA}));
 if(context){
  const facts=context.facts.map(f=>f.id),scenes=[...new Set(context.facts.flatMap(f=>[...f.sceneIDs,...f.sources.map(r=>r.sceneID).filter(Boolean)]))],people=[...new Set(context.facts.flatMap(f=>f.personOccurrenceIDs))];
  const documents=context.documents.filter(d=>d.documentType==='callSheet'&&d.pages?.length).map(d=>d.documentID);
  // Keep the total repeated enum budget below the provider's schema limit.
  // Larger contexts retain unchanged strict post-validation, without slicing.
  if(facts.length<=80&&scenes.length<=80&&people.length<=80&&documents.length<=80){
   function bind(value){if(!object(value))return;for(const [name,child] of Object.entries(value.properties??{})){
    if(name==='factIDs'||name==='sceneIDs'){const values=name==='factIDs'?facts:scenes;if(values.length)child.items.enum=values;else child.maxItems=0;}
    if(name==='personOccurrenceID')child.enum=[...people,null];
    if(name==='documentID'&&documents.length)child.enum=documents;
   }for(const child of Object.values(value)){if(Array.isArray(child))child.forEach(bind);else if(object(child))bind(child);}}
   bind(schema);
  }
  if(!['callSheet','personalBrief'].includes(kind)||!documents.length)schema.properties.extractedCalls.maxItems=0;
 }
 return schema;
}
const canonical=x=>JSON.stringify(Object.fromEntries(Object.entries(x).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>[k,k==='documentID'?v.toLowerCase():v]).sort(([a],[b])=>a.localeCompare(b))));
export function restoreWorkSources(factIDs,facts){const refs=new Map();for(const id of factIDs)for(const ref of facts.get(id).sources)refs.set(canonical(ref),ref);return [...refs.values()];}
const OUTPUT_ERROR='invalid_work_result';
const bad=(reason)=>{const error=new AnalysisError(OUTPUT_ERROR,502);if(reason)error.safeDiagnostic={stage:'report',reason};throw error;};
function numbers(value){return new Set((value.match(/\d+(?:[.,:]\d+)*/g)??[]).map(s=>s.split(/([.,:])/).map(p=>/^\d+$/.test(p)?String(Number(p)):p).join('')));}
function citedText(facts,ids){return ids.flatMap(id=>{const f=facts.get(id);return [f.text,...f.sources.flatMap(r=>[r.quote??'',r.sourceVersion]),f.time?.literalValue??'',f.dateISO??''];}).join('\n');}
function validateItem(item,facts,seen){
 try{shape(item,['id','title','text','statement','factIDs'],[],OUTPUT_ERROR,502);}catch{bad();}
 if(!text(item.id,200,1)||seen.has(item.id))bad('item_identity');
 if(!text(item.title,500)||!text(item.text,8000)||!STATEMENTS.includes(item.statement)||!Array.isArray(item.factIDs)||!unique(item.factIDs))bad('item_shape');
 if(item.factIDs.some(id=>!facts.has(id)))bad('item_unknown_fact');
 if(!['open','planningAssumption'].includes(item.statement)&&!item.factIDs.length)bad('item_missing_fact');
 seen.add(item.id);
 const cited=item.factIDs.map(id=>facts.get(id));
 if(item.statement==='sourceExplicit'&&(cited.some(f=>f.statement!=='sourceExplicit')||!cited.some(f=>f.text.includes(item.text)||f.sources.some(r=>r.quote?.includes(item.text)))))bad('explicit_not_literal_or_promoted');
 if(item.statement==='userEntered'&&(cited.some(f=>f.statement!=='userEntered')||!cited.some(f=>f.text.includes(item.text))))bad('user_value_not_literal');
 if(/https?:\/\//i.test(item.text+' '+item.title))bad();
 const supported=numbers(citedText(facts,item.factIDs));
 if([...numbers(item.text+' '+item.title)].some(n=>!supported.has(n))){const error=new AnalysisError('unsupported_quantity',502);error.details={itemID:item.id};throw error;}
 return {...item,review:'pending',release:'draft',sources:restoreWorkSources(item.factIDs,facts)};
}
const missingText={
 de:['Planungsgrundlagen offen','Für belastbare Zeiten und Zusagen fehlen bestätigte Planungsgrundlagen. Die Ausgabe bleibt ein zu prüfender Vorschlag.'],
 en:['Planning inputs missing','Confirmed planning inputs are missing for reliable times and commitments. This remains a proposal for review.'],
 es:['Faltan datos de planificación','Faltan datos confirmados para horarios y compromisos fiables. El resultado sigue siendo una propuesta por revisar.'],
 it:['Dati di pianificazione mancanti','Mancano dati confermati per orari e impegni affidabili. Il risultato resta una proposta da verificare.'],
 cs:['Chybí podklady pro plánování','Pro spolehlivé časy a závazky chybí potvrzené podklady. Výstup zůstává návrhem ke kontrole.'],
 hu:['Hiányzó tervezési adatok','A megbízható időpontokhoz és vállalásokhoz megerősített adatok hiányoznak. Az eredmény ellenőrizendő javaslat.'],
 nl:['Planningsgegevens ontbreken','Bevestigde gegevens voor betrouwbare tijden en afspraken ontbreken. Dit blijft een voorstel ter controle.'],
 'nl-BE':['Planningsgegevens ontbreken','Bevestigde gegevens voor betrouwbare uren en afspraken ontbreken. Dit blijft een voorstel ter controle.'],
 sv:['Planeringsunderlag saknas','Bekräftat underlag för tillförlitliga tider och åtaganden saknas. Resultatet är ett förslag som måste granskas.']
};
function supportedRowField(field,value,row,cited,context){
 if(value===undefined||value===null)return;
 const constraints=context.parameters.constraints.filter(c=>c.factIDs.every(id=>row.factIDs.includes(id)));
 const constraintKinds={dateISO:['date','shootDate'],unit:['unit'],start:['slotStart','shootingStart'],end:['slotEnd','plannedWrap'],durationMinutes:['shootDuration','durationMinutes']};
 if(field==='dayKey')return; // A deliberately labelled proposal group, not a source identifier.
 if(constraints.some(c=>(constraintKinds[field]??[]).includes(c.kind)&&c.value===String(value)))return;
 if(field==='dateISO'&&cited.some(f=>f.dateISO===value||f.time?.scope!=='story'&&f.time?.dateISO===value))return;
 if(field==='dateISO'&&context.parameters.dateISO===value)return;
 if(field==='unit'&&cited.some(f=>f.text===value||f.sources.some(r=>r.quote===value)))return;
 const kinds=field==='start'?['shootingStart']:field==='end'?['plannedWrap']:[];
 if(cited.some(f=>f.time&&f.time.scope!=='story'&&kinds.includes(f.time.kind)&&f.time.literalValue===value))return;
 bad('unsupported_production_slot');
}
export function validateWorkProviderResult(value,request,context=prepareWorkContext(request)){
 shape(value,['status','sections','planRows','unknowns','limitations','templateProposal','extractedCalls'],[],OUTPUT_ERROR,502);
 if(!['ready','insufficientInformation'].includes(value.status)||!Array.isArray(value.sections)||!Array.isArray(value.planRows)||value.planRows.length>2000||!Array.isArray(value.unknowns)||value.unknowns.length>2000||!Array.isArray(value.limitations)||value.limitations.length>100||value.limitations.some(v=>!text(v,4000)))bad('result_collections');
 const wanted=TASK_SECTIONS[request.kind];
 if(value.sections.length!==wanted.length||new Set(value.sections.map(s=>s?.id)).size!==wanted.length||value.sections.some(s=>!wanted.includes(s?.id)))bad('section_set');
 let extractedFacts;try{extractedFacts=extractDirectCalls(value.extractedCalls,context);}catch(error){if(error instanceof AnalysisError)error.safeDiagnostic={stage:'direct_calls',reason:'unsupported_exact_relation'};throw error;}
 const facts=new Map([...context.facts,...extractedFacts].map(f=>[f.id,f])),seen=new Set();let count=value.unknowns.length;
 const sections=wanted.map(id=>value.sections.find(s=>s.id===id)).map(section=>{shape(section,['id','title','items'],[],OUTPUT_ERROR,502);if(!text(section.title,500)||!Array.isArray(section.items))bad('section_shape');count+=section.items.length;if(count>WORK_LIMITS.items)bad('item_limit');return {...section,items:section.items.map(i=>validateItem(i,facts,seen))};});
 const unknowns=value.unknowns.map(i=>validateItem(i,facts,seen));
 const sceneIDs=new Set(context.facts.flatMap(f=>[...f.sceneIDs,...f.sources.map(r=>r.sceneID).filter(Boolean)]));
 if(request.kind!=='shootingPlan'&&value.planRows.length)bad('plan_rows_for_wrong_task');
 const planRows=value.planRows.map(row=>{
  shape(row,['id','sceneIDs','dayKey','dateISO','unit','order','start','end','durationMinutes','statement','factIDs'],[],OUTPUT_ERROR,502);
  if(!text(row.id,200,1)||seen.has(row.id)||!Array.isArray(row.sceneIDs)||!unique(row.sceneIDs)||row.sceneIDs.some(id=>!sceneIDs.has(id))||!STATEMENTS.includes(row.statement)||!Array.isArray(row.factIDs)||!unique(row.factIDs)||row.factIDs.some(id=>!facts.has(id))||!['open','planningAssumption'].includes(row.statement)&&!row.factIDs.length||!optional(row,'dateISO',validDate)||!optional(row,'order',v=>int(v,0,10000))||!optional(row,'durationMinutes',v=>int(v,1,10080))||!['dayKey','unit','start','end'].every(k=>optional(row,k,v=>text(v,200))))bad('plan_row_shape_or_reference');
  seen.add(row.id);const cited=row.factIDs.map(id=>facts.get(id));
  const citedScenes=new Set(cited.flatMap(f=>[...f.sceneIDs,...f.sources.map(r=>r.sceneID).filter(Boolean)]));
  if(row.sceneIDs.some(id=>!citedScenes.has(id)))bad('plan_row_scene_binding');
  for(const sceneID of row.sceneIDs){
   const owners=new Set(cited.flatMap(f=>f.sources.filter(r=>r.sceneID===sceneID||f.sceneIDs.includes(sceneID)).map(r=>key(r.documentID))));
   if(owners.size!==1)bad('plan_row_cross_document');
  }
  if(row.statement==='sourceExplicit'&&cited.some(f=>f.statement!=='sourceExplicit'))bad('plan_row_statement_upgrade');
  for(const field of ['dayKey','dateISO','unit','start','end','durationMinutes'])supportedRowField(field,row[field],row,cited,context);
  if(row.dayKey!==null&&row.statement==='sourceExplicit')bad('plan_row_false_source_group'); // Grouping is a working proposal.
  return {...Object.fromEntries(Object.entries(row).filter(([,v])=>v!==null)),review:'pending',release:'draft',sources:restoreWorkSources(row.factIDs,facts)};
 });
 const templateProposal=validateTemplateProposal(value.templateProposal,{...context,facts:[...facts.values()]});
 const limitations=[...value.limitations];
 if(context.missingRequiredConstraints.length){const [title,message]=missingText[request.locale];let id='server:planning-inputs';while(seen.has(id))id+=':';unknowns.push({id,title,text:message,statement:'open',review:'pending',release:'draft',factIDs:[],sources:[]});limitations.push(message);}
 // Coverage states what was supplied to the model, never an unsupported claim
 // that every source fact was semantically represented in the resulting report.
 const result={schemaVersion:1,requestID:request.requestID,kind:request.kind,projectID:request.projectID??null,status:context.missingRequiredConstraints.length||!context.facts.length?'insufficientInformation':value.status,review:'pending',release:'draft',sections,planRows,unknowns,coverage:{consideredFactIDs:context.facts.map(f=>f.id),omittedFactIDs:context.omittedFactIDs,limitations:[...new Set(limitations)]},...(templateProposal?{templateProposal}:{}),...(extractedFacts.length?{extractedFacts}:{})};
 if(Buffer.byteLength(JSON.stringify(result))>WORK_LIMITS.resultBytes)fail('too_large',413);
 return result;
}
export async function executeWorkTask(request,{provider,signal=new AbortController().signal,beforeProvider=async()=>{}}={}){
 const context=prepareWorkContext(request);signal.throwIfAborted();
 if(typeof provider!=='function')fail('unavailable',503);
 if(!context.facts.length&&(!['callSheet','personalBrief'].includes(request.kind)||!context.documents.some(d=>d.pages?.length))){
  const [title,message]=missingText[request.locale];
  return validateWorkProviderResult({status:'insufficientInformation',sections:TASK_SECTIONS[request.kind].map(id=>({id,title,items:[]})),planRows:[],unknowns:[{id:'no-selected-facts',title,text:message,statement:'open',factIDs:[]}],limitations:[],templateProposal:null,extractedCalls:[]},request,context);
 }
 await beforeProvider();signal.throwIfAborted();
 const value=await provider({context,instructions:workTaskInstructions(request.kind,request.locale),schema:workProviderSchema(request.kind,context),signal});
 signal.throwIfAborted();const normalized=normalizeWorkCandidate(value,request,context);return validateWorkResultWithQuarantine(normalized,request,context);
}

export function normalizeWorkCandidate(value,request,context){
 const copy=includeGroundedLiterals(value,request,context);
 if(!object(copy))return copy;
 const citations=item=>{if(Array.isArray(item?.factIDs)&&item.factIDs.every(v=>typeof v==='string'))item.factIDs=[...new Set(item.factIDs)];};
 for(const section of Array.isArray(copy.sections)?copy.sections:[])for(const [i,item]of (Array.isArray(section?.items)?section.items:[]).entries()){
  if(object(item)&&text(item.id,200,1)&&TASK_SECTIONS[request.kind].includes(section.id))item.id=`report:${request.requestID}:${section.id}:${i}`;citations(item);
 }
 for(const [i,item]of (Array.isArray(copy.unknowns)?copy.unknowns:[]).entries()){if(object(item)&&text(item.id,200,1))item.id=`report:${request.requestID}:unknown:${i}`;citations(item);}
 for(const [i,row]of (Array.isArray(copy.planRows)?copy.planRows:[]).entries()){if(object(row)&&text(row.id,200,1))row.id=`plan:${request.requestID}:${i}`;citations(row);}
 if(Object.hasOwn(copy,'templateProposal'))copy.templateProposal=mergeGroundedProposal(copy.templateProposal,groundedCallSheetProposal(context));
 if(object(copy.templateProposal)){
  for(const cell of Array.isArray(copy.templateProposal.formFields)?copy.templateProposal.formFields:[])citations(cell);
  for(const [i,row]of (Array.isArray(copy.templateProposal.tableRows)?copy.templateProposal.tableRows:[]).entries()){
   if(object(row)&&text(row.id,200,1))row.id=`template:${request.requestID}:${i}`;
   for(const cell of Array.isArray(row?.cells)?row.cells:[])citations(cell);
  }
 }
 return copy;
}

const QUARANTINE_COPY={
 de:['Quellenprüfung offen','Ein Berichtsvorschlag enthielt eine nicht belegte Zahl. An seiner Stelle bleibt der Quellenbeleg ungeprüft; daraus wurde keine Mengen- oder Zeitvorgabe übernommen.'],
 en:['Source review needed','A report suggestion contained an unsupported number. Its source remains pending review; no quantity or timing requirement was adopted from it.'],
 es:['Revisión de fuente pendiente','Una propuesta contenía una cifra sin respaldo. La fuente queda pendiente de revisión; no se ha adoptado ninguna cantidad ni horario de ella.'],
 it:['Fonte da verificare','Una proposta conteneva un numero non documentato. La fonte resta da verificare; non ne è stata adottata alcuna quantità o indicazione oraria.'],
 cs:['Nutná kontrola zdroje','Návrh obsahoval nedoložené číslo. Zdroj zůstává ke kontrole; nebylo z něj převzato žádné množství ani časový požadavek.'],
 hu:['Forrásellenőrzés szükséges','Egy javaslat nem alátámasztott számot tartalmazott. A forrás ellenőrzésre vár; mennyiségi vagy időbeli előírást nem vettünk át belőle.'],
 nl:['Broncontrole nodig','Een voorstel bevatte een niet onderbouwd getal. De bron blijft ter controle staan; er is geen hoeveelheid of tijdvoorschrift uit overgenomen.'],
 'nl-BE':['Broncontrole nodig','Een voorstel bevatte een niet onderbouwd getal. De bron blijft ter controle staan; er is geen hoeveelheid of tijdsvoorschrift uit overgenomen.'],
 sv:['Källgranskning behövs','Ett förslag innehöll ett tal utan stöd. Källan väntar på granskning; inget mängd- eller tidskrav har hämtats från det.']
};
export function validateWorkResultWithQuarantine(value,request,context=prepareWorkContext(request)){
 const copy=structuredClone(value),quarantined=new Set();
 for(let attempt=0;attempt<=128;attempt++){
  try{
   const result=validateWorkProviderResult(copy,request,context);
   if(quarantined.size){if(result.coverage.limitations.length>=100)bad();result.coverage.limitations.push(QUARANTINE_COPY[request.locale][1]);result.status='insufficientInformation';}
   return result;
  }catch(error){
   const id=error?.details?.itemID;
   if(!(error instanceof AnalysisError)||error.code!=='unsupported_quantity'||typeof id!=='string'||quarantined.has(id)||attempt===128)throw error;
   let item;
   for(const section of copy.sections??[]){const i=section.items?.findIndex(v=>v.id===id);if(i>=0){item=section.items.splice(i,1)[0];break;}}
   if(!item){const i=copy.unknowns?.findIndex(v=>v.id===id);if(i>=0)item=copy.unknowns.splice(i,1)[0];}
   if(!item)throw error;
   const facts=new Map(context.facts.map(f=>[f.id,f])),first=item.factIDs.map(id=>facts.get(id)).find(Boolean);
   const quote=first?.sources.find(s=>s.quote)?.quote??first?.text;
   const [title,message]=QUARANTINE_COPY[request.locale];
   copy.unknowns.push({id:item.id,title,text:quote??message,statement:quote?'inferred':'open',factIDs:quote?item.factIDs:[]});
   quarantined.add(id);
   // Next iteration validates ALL remaining proposals and the replacement.
   // An invalid source, forged relation or schema can never be laundered.
  }
 }
 bad();
}
