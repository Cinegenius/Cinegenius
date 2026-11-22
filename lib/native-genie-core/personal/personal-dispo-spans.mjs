import {AnalysisError,sourceTextBoundaries,sourceBoundaryAtOrBefore} from './core.mjs';
const fail=()=>{throw new AnalysisError('invalid_evidence',502)};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function personalDispoSpans(document){
 const spans=[];
 for(const page of document.pages){const boundaries=sourceTextBoundaries(page.text);let start=0;
  while(start<page.text.length){const end=sourceBoundaryAtOrBefore(boundaries,Math.min(page.text.length,start+2500));if(end<=start)fail();
   const text=page.text.slice(start,end);if(text.trim())spans.push({id:`p${page.number}-${start}-${end}`,page:page.number,text});
   if(end===page.text.length)break;const next=sourceBoundaryAtOrBefore(boundaries,start+1250);if(next<=start)fail();start=next;
  }
 }
 if(spans.length>1000)throw new AnalysisError('source_too_large',413);return spans;
}
export function personalDispoSchemaForSpans(schema,spans){
 const value=structuredClone(schema),ids=spans.map(s=>s.id);if(!ids.length)fail();
 const visit=x=>{if(!object(x))return;for(const [key,v] of Object.entries(x)){if(key==='evidence'&&object(v)&&v.type==='array'){x[key]={type:'array',minItems:1,maxItems:5,items:{type:'object',additionalProperties:false,required:['spanID'],properties:{spanID:{type:'string',enum:ids}}}};}else if(Array.isArray(v))v.forEach(visit);else visit(v);}};
 visit(value);return value;
}
function normalizedMapping(text){
 let value='';const map=[];const segmenter=new Intl.Segmenter('und',{granularity:'grapheme'});
 for(const part of segmenter.segment(text)){const begin=part.index,end=begin+part.segment.length;
  if(/^\s+$/u.test(part.segment)){if(value.endsWith(' ')){map[map.length-1].end=end;}else{value+=' ';map.push({start:begin,end});}}
  else{const normalized=part.segment.normalize('NFC');value+=normalized;for(let i=0;i<normalized.length;i++)map.push({start:begin,end});}
 }
 return {text:value,map};
}
function compactQuote(span,targets,pattern,cache){
 let mapped=cache.get(span.id);if(!mapped){mapped=normalizedMapping(span.text);cache.set(span.id,mapped);}
 const hits=[];let group=0;
 const normalizedTargets=targets.filter(x=>typeof x==='string'&&x.length).map(x=>x.normalize('NFC').split(/\s+/u).filter(Boolean).join(' ')).filter(Boolean);
 for(const target of [...new Set(normalizedTargets)]){let found=0,start=0;for(;;){const index=mapped.text.indexOf(target,start);if(index<0)break;hits.push({start:mapped.map[index].start,end:mapped.map[index+target.length-1].end,group});found++;if(found>=30)break;start=index+Math.max(1,target.length);}if(found)group++;}
 if(pattern){const regex=new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g');let count=0,found=false;for(const m of span.text.matchAll(regex)){hits.push({start:m.index,end:m.index+m[0].length,group});found=true;if(++count>=50)break;}if(found)group++;}
 if(!hits.length)return span.text;
 hits.sort((a,b)=>a.start-b.start||a.end-b.end);let best;
 for(let left=0;left<hits.length;left++){const seen=new Set();let end=0;for(let right=left;right<hits.length;right++){seen.add(hits[right].group);end=Math.max(end,hits[right].end);if(seen.size===group){const candidate={start:hits[left].start,end};if(!best||candidate.end-candidate.start<best.end-best.start)best=candidate;break;}}}
 if(!best)fail();const lineStart=Math.max(span.text.lastIndexOf('\n',best.start-1),span.text.lastIndexOf('\r',best.start-1))+1;
 const nextLF=span.text.indexOf('\n',best.end),nextCR=span.text.indexOf('\r',best.end);let lineEnd=span.text.length;for(const i of [nextLF,nextCR])if(i>=0)lineEnd=Math.min(lineEnd,i);
 return span.text.slice(lineStart,lineEnd);
}
export function restorePersonalDispoSpans(raw,spans,{labelPatterns={}}={}){
 const byID=new Map(spans.map(s=>[s.id,s])),cache=new Map();if(!object(raw)||!Array.isArray(raw.days))fail();const value=structuredClone(raw);
 for(const day of value.days){if(!object(day)||!Array.isArray(day.people))fail();const people=new Map(day.people.map(p=>[p.id,p]));
  const restore=(record,targets,pattern)=>{
   if(!Array.isArray(record.evidence)||!record.evidence.length||record.evidence.length>5)fail();const ids=new Set();
   record.evidence=record.evidence.flatMap(ref=>{if(!object(ref)||Object.keys(ref).length!==1||typeof ref.spanID!=='string')fail();const span=byID.get(ref.spanID);if(!span)fail();if(ids.has(ref.spanID))return [];ids.add(ref.spanID);return [{page:span.page,quote:compactQuote(span,targets,pattern,cache)}];});
   const unique=[];for(const e of record.evidence)if(!unique.some(x=>x.page===e.page&&x.quote===e.quote))unique.push(e);record.evidence=unique;
  };
  restore(day,[day.dateLiteral,day.shootingDay]);
  for(const p of day.people)restore(p,[p.name,p.role,p.department]);
  for(const section of ['times','locations','notes','contacts']){
   if(!Array.isArray(day[section]))fail();
   for(const item of day[section]){if(!object(item)||!object(item.audience))fail();const a=item.audience;
    const personTargets=(a.personIDs??[]).flatMap(id=>{const p=people.get(id);if(!p)fail();return [p.name,p.role,p.department];});
    const targets=section==='times'?[item.literal,...personTargets,...(a.departments??[])]:section==='locations'?[item.label,item.address]:section==='notes'?[item.text]:[item.name,item.role,item.phone,item.email];
    restore(item,targets,section==='times'?labelPatterns[item.kind]:undefined);
    restore(a,[...targets,...(a.departments??[]),...(a.units??[]),...personTargets]);
   }
  }
 }
 return value;
}
export const PERSONAL_DISPO_SPAN_INSTRUCTIONS=`For EVERY evidence array output only objects {spanID: exact source span ID}. NEVER output page/quote and NEVER copy long evidence quotations. Server restores a short exact contiguous original excerpt from selected spans. Source spans overlap: this is duplicate context, NOT additional people/rows/days. Select only spans containing this actual record's literal values and qualifiers. Keep ALL operative facts, but only operative call-sheet content: people with actual day assignments/calls/work-start entries, needed contacts, work/call times, day locations and actionable personal/general instructions. Do NOT extract scene-strip cast mentions, script characters, dialogue, action/synopsis, story-clock times, screen-runtime, repeat credits, invoice recipient addresses or repetitive legal boilerplate as people/times/notes/operative map locations. A repeated name in scene cast strips is not a new operational person. A contact without an operative personal assignment belongs contacts, not people. Do not copy whole pages as notes. Preserve distinct actual operative same-name rows. Keep operational Main/Trick/Second Unit qualifiers explicit and complete, including department AB. Do not calculate missing facts. This is a narrow PERSONAL DISPO extraction, NOT a screenplay/department breakdown.`;
