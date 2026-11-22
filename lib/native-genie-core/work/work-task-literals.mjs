import {WORK_COPY} from './work-task-copy.mjs';
const TIME_LABELS={personalCall:'wpPersonalTimePersonalCall',personalWorkStart:'wpTemplateFieldPersonalWorkStart',personalWorkEnd:'wpTemplateFieldPersonalWorkEnd',generalCall:'wpTemplateFieldGeneralCall',shootingStart:'wpTemplateFieldShootingStart',lunch:'wpTemplateFieldLunch',plannedWrap:'wpTemplateFieldPlannedWrap',arrival:'wpTemplateFieldArrival',onSet:'wpTemplateFieldOnSet',pickup:'wpTemplateFieldPickup',makeup:'wpTemplateFieldMakeupCall',costume:'wpTemplateFieldCostumeCall',rehearsal:'wpTemplateFieldRehearsal',travel:'wpTemplateFieldTravel',storyTime:'wpTemplateFieldStoryTime'};
const fieldKey=id=>'wpTemplateField'+id.slice(0,1).toUpperCase()+id.slice(1);
function title(fact,locale,kind){const labels=WORK_COPY[locale];if(kind!=='personalBrief'&&fact.time?.kind.startsWith('personal'))return labels.wpTemplateFieldSource;const field=fact.sources.find(s=>s.fieldID)?.fieldID?.split('.').at(-1);return labels[TIME_LABELS[fact.time?.kind]]??labels[fieldKey(field??'')]??labels[fact.kind==='person'?'wpTemplateFieldPerson':'wpTemplateFieldSource'];}
function literal(fact,locale,id,kind){return {id,title:title(fact,locale,kind),text:fact.text,statement:fact.statement,factIDs:[fact.id]};}
const safe=f=>['sourceExplicit','userEntered'].includes(f.statement);
const plain=i=>i&&typeof i==='object'&&!Array.isArray(i)&&Object.keys(i).length===5&&Object.keys(i).every(k=>['id','title','text','statement','factIDs'].includes(k))&&typeof i.id==='string'&&i.id.length>0&&i.id.length<=200&&typeof i.title==='string'&&i.title.length<=500&&typeof i.text==='string'&&i.text.length<=8000&&![i.id,i.title,i.text].some(v=>v.includes('\0'))&&Array.isArray(i.factIDs)&&i.factIDs.every(id=>typeof id==='string');

// Show known data even when a generated explanation is withheld. These are
// copies of supplied values, not new facts, assignments or production times.
export function includeGroundedLiterals(candidate,request,context){
 const facts=new Map(context.facts.map(f=>[f.id,f])),copy=structuredClone(candidate);
 if(!Array.isArray(copy?.sections))return copy;
 for(const section of copy.sections){
  if(!Array.isArray(section.items))continue;
  const items=[],literalIDs=new Set();
  for(const item of section.items){
   const cited=Array.isArray(item?.factIDs)?item.factIDs.map(id=>facts.get(id)):[];
   const type=item?.statement;
   const sameClass=plain(item)&&['sourceExplicit','userEntered'].includes(type)&&cited.length&&cited.every(f=>f&&f.statement===type);
   const verbatim=cited.some(f=>f&&(f.text.includes(item.text)||f.sources.some(s=>s.quote?.includes(item.text))));
   const searchHit=request.kind==='search'&&section.id==='overview'&&plain(item)&&cited.length&&cited.every(Boolean);
   if(searchHit||sameClass&&!verbatim){
    for(const fact of cited)if(!literalIDs.has(fact.id)){items.push(literal(fact,request.locale,item.id+':'+items.length,request.kind));literalIDs.add(fact.id);}
   }else{items.push(item);if(sameClass&&cited.length===1&&item.text===cited[0].text)literalIDs.add(cited[0].id);}
  }
  section.items=items;
 }
 function prefill(sectionID,selected,max=Infinity){
  const section=copy.sections.find(s=>s.id===sectionID);if(!section||!Array.isArray(section.items))return;
  const chosen=selected.filter(safe).slice(0,max),ids=new Set(chosen.map(f=>f.id));
  const remaining=section.items.filter(i=>!(plain(i)&&i.factIDs?.length===1&&ids.has(i.factIDs[0])&&i.text===facts.get(i.factIDs[0])?.text));
  section.items=[...chosen.map((f,i)=>literal(f,request.locale,`literal:${sectionID}:${i}`,request.kind)),...remaining];
 }
 if(request.kind==='personalBrief'){
  const people=new Set(request.parameters.selectedPersonOccurrenceIDs);
  const personal=context.facts.filter(f=>f.personOccurrenceIDs.some(id=>people.has(id)));
  const priority=['personalCall','personalWorkStart','personalWorkEnd','plannedWrap'];
  const times=personal.filter(f=>f.time&&f.time.scope!=='story').sort((a,b)=>(priority.indexOf(a.time.kind)<0?99:priority.indexOf(a.time.kind))-(priority.indexOf(b.time.kind)<0?99:priority.indexOf(b.time.kind)));
  prefill('overview',[...times,...personal.filter(f=>f.kind==='person')],3);
  prefill('schedule',times);
  const overview=copy.sections.find(s=>s.id==='overview'),preparation=copy.sections.find(s=>s.id==='preparation');
  if(Array.isArray(overview?.items)&&Array.isArray(preparation?.items)&&overview.items.length>3)preparation.items.unshift(...overview.items.splice(3));
 }else if(request.kind==='callSheet'){
  const global=context.facts.filter(f=>!f.personOccurrenceIDs.length&&(f.time||f.sources.some(s=>s.fieldID==='shootDate'||s.fieldID==='callSheet.date')));
  prefill('overview',global);
 }
 return copy;
}
