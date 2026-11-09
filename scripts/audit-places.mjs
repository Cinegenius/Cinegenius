// Run with node --experimental-strip-types --import ./scripts/register-test-aliases.mjs
// --env-file=<approved local config> scripts/audit-places.mjs [--apply] [--output=<path>]
import {createClient} from '@supabase/supabase-js';
import {writeFile,rename,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {placeWriteFields} from '../lib/places/catalog.ts';
import {countryCode,placeKey} from '../lib/places/core.ts';
const apply=process.argv.includes('--apply'),run=randomUUID();
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),{auth:{persistSession:false,autoRefreshToken:false}});
const report={run,apply,createdAt:new Date().toISOString(),tables:{},errors:[],cleanup:null};
const snapshotKeys=['place_country_code','place_region_id','place_city_id','place_city_name','place_region_name','place_status','place_original'];
const profileLegacy=['location_city','location_region','location_country'];
const text=value=>typeof value==='string'&&value.trim()?value:'';
const present=value=>value!==null&&value!==undefined&&(typeof value!=='string'||value.trim()!=='')&&(!Array.isArray(value)||value.length>0);
const projectSources=row=>({country:row.country??null,shoot_locations:row.shoot_locations??null,metadata_location:row.place_location??null,metadata_country:row.place_country??null,metadata_shoot_locations:row.place_shoot_locations??null});
function projectMapping(sources){
 const raw=text(sources.metadata_location)||text(sources.country)||text(sources.metadata_country),issues=[];
 for(const key of ['metadata_location','country','metadata_country'])if(present(sources[key])&&!text(sources[key]))issues.push(`${key}_type`);
 const countries=[text(sources.country),text(sources.metadata_country)].filter(Boolean).map(value=>countryCode(value)||placeKey(value));
 if(new Set(countries).size>1)issues.push('production_country_conflict');
 const shoots=[sources.shoot_locations,sources.metadata_shoot_locations].filter(present);
 if(!raw&&shoots.length)issues.push('shoot_locations_without_primary');
 if(shoots.some(value=>!Array.isArray(value)||value.some(item=>typeof item!=='string')))issues.push('shoot_locations_type');
 if(shoots.length===2&&JSON.stringify(shoots[0])!==JSON.stringify(shoots[1]))issues.push('shoot_locations_conflict');
 let fields=placeWriteFields(raw);
 // Production countries are never interpreted as cities, and shoot locations
 // remain independent sources even when they are in different countries.
 if(!text(sources.metadata_location))fields={...fields,place_city_id:null,place_region_id:null,place_city_name:'',place_region_name:'',place_status:raw?(countryCode(raw)?'verified':'pending'):'empty'};
 if(issues.length)fields={...fields,place_status:'pending',place_city_id:null,place_region_id:null};
 return {raw,fields,issues};
}
for(const [table,key,baseColumns] of [['profiles','user_id','location'],['companies','id','city'],['listings','id','city,type'],['projects','id','place_location:metadata->location,place_country:metadata->project_details->country,place_shoot_locations:metadata->project_details->shoot_locations'],['organizations','id','city,region'],['organization_entries','id','city'],['community_posts','id','city']]){
 const summary={records:0,verified:0,pending:0,empty:0,applied:0,conflicts:0,schema:"canonical",absentOptionalColumns:[],sourceIssues:{},mappings:{},supplementary:{}};report.tables[table]=summary;
 const optional=table==='profiles'?profileLegacy:table==='projects'?['country','shoot_locations']:[],available=[];let probeFailed=false;
 for(const column of optional){
  // Zero-row projections verify optional schema without exporting any rows.
  const probe=await client.from(table).select(column).limit(0);
  if(probe.error&&['42703','PGRST204'].includes(probe.error.code)){summary.absentOptionalColumns.push(column);continue;}
  if(probe.error){report.errors.push({table,code:probe.error.code??'schema_probe_error'});probeFailed=true;break;}
  available.push(column);
 }
 if(probeFailed)continue;
 const columns=[baseColumns,...available].join(',');
 let lastKey=null,legacyMode=false;
 for(;;){
  let query=client.from(table).select([key,columns,...(legacyMode?[]:snapshotKeys)].join(',')).order(key).limit(500);
  if(lastKey!==null)query=query.gt(key,lastKey);
  const {data,error}=await query;
  if(error&&!apply&&!legacyMode&&['42703','PGRST204'].includes(error.code)){legacyMode=true;summary.schema='legacy';continue;}
  if(error){report.errors.push({table,code:error.code??'database_error'});break;}
  for(const row of data){
   const sources=table==='projects'?projectSources(row):null,project=sources?projectMapping(sources):null;
   const raw=table==='profiles'?row.location??'':project?project.raw:row.city??'';
   const alreadyMapped=typeof row.place_original==='string';
   const legacyStructured=table==='profiles'&&[row.location_city,row.location_region,row.location_country].some(value=>typeof value==='string'&&value.trim());
   const fields=alreadyMapped?Object.fromEntries(snapshotKeys.map(k=>[k,row[k]??null])):legacyStructured?{...placeWriteFields(raw),place_status:'pending',place_city_id:null,place_region_id:null}:project?project.fields:placeWriteFields(raw),status=fields.place_status;
   for(const issue of project?.issues??[])summary.sourceIssues[issue]=(summary.sourceIssues[issue]??0)+1;
   summary.records++;summary[status]++;
   const supplementary=table==='profiles'?{location_city:row.location_city,location_region:row.location_region,location_country:row.location_country}:table==='organizations'?{organization_region:row.region}:sources??{};
   for(const [path,value] of Object.entries(supplementary)){if(value==null||value==='')continue;const key=JSON.stringify({path,value,action:'preserved_for_review'});summary.supplementary[key]=(summary.supplementary[key]??0)+1;}
   const signature=JSON.stringify({original:raw,...fields});summary.mappings[signature]=(summary.mappings[signature]??0)+1;
   if(apply&&!alreadyMapped){const expected={...Object.fromEntries(snapshotKeys.map(k=>[k,row[k]??null])),...(table==='profiles'?{profile_legacy:Object.fromEntries(profileLegacy.map(k=>[k,row[k]??null]))}:sources?{project_sources:sources}:table==='organizations'?{organization_sources:{region:row.region??null}}:{})};const r=await client.rpc('apply_place_mapping',{p_table:table,p_id:String(row[key]),p_expected_raw:raw,p_expected:expected,p_fields:fields,p_run:run});
    if(r.error)report.errors.push({table,code:r.error.code??'write_error'});else if(r.data==='applied')summary.applied++;else if(r.data!=='unchanged')summary.conflicts++;
   }
  }
  if(data.length<500)break;
  lastKey=data.at(-1)[key];
 }
}
if(apply&&!report.errors.length){
 const result=await client.rpc('purge_place_change_journal');
 if(result.error)report.errors.push({table:'place_change_journal',code:result.error.code??'cleanup_error'});
 else if(typeof result.data!=='number'||!Number.isInteger(result.data)||result.data<0)report.errors.push({table:'place_change_journal',code:'invalid_cleanup_result'});
 else report.cleanup={removed:result.data};
}
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
if(output){
 // Replacing a pre-existing, broadly readable report must not retain its old
 // permissions. Write privately and replace atomically, without following a
 // destination symlink or ever exposing the new report through the old file.
 const temporary=`${output}.${run}.tmp`;
 try{await writeFile(temporary,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temporary,output);}
 finally{await rm(temporary,{force:true});}
}
console.log(JSON.stringify({...report,tables:Object.fromEntries(Object.entries(report.tables).map(([k,v])=>[k,{...v,mappings:Object.keys(v.mappings).length,supplementary:Object.keys(v.supplementary).length}]))},null,2));
if(report.errors.length)process.exitCode=1;
