import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/auth';
import {db} from '@/lib/db';
import {PLACE_COLUMNS} from '@/lib/places/core';
import {placeWriteFields,placeFieldsForId} from '@/lib/places/catalog';
import {getTranslations} from 'next-intl/server';
import {randomUUID} from 'node:crypto';
import {revalidatePath,revalidateTag} from 'next/cache';
const profileLegacy=['location_city','location_region','location_country'];
const projectKeys=['country','shoot_locations','metadata_location','metadata_country','metadata_shoot_locations'];
const projectSources=(row:Record<string,unknown>)=>({country:row.country??null,shoot_locations:row.shoot_locations??null,metadata_location:row.place_location??null,metadata_country:row.place_country??null,metadata_shoot_locations:row.place_shoot_locations??null});
const tables:Record<string,{key:string;raw:string;optional?:string[]}>={profiles:{key:'user_id',raw:'location',optional:profileLegacy},companies:{key:'id',raw:'city'},listings:{key:'id',raw:'city'},projects:{key:'id',raw:'place_location:metadata->location,place_country:metadata->project_details->country,place_shoot_locations:metadata->project_details->shoot_locations',optional:['country','shoot_locations']},organizations:{key:'id',raw:'city,region'},organization_entries:{key:'id',raw:'city'},community_posts:{key:'id',raw:'city'}};
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const auth=await requireAdmin();if(auth instanceof NextResponse)return auth;
 const table=req.nextUrl.searchParams.get('table')??'profiles',config=Object.hasOwn(tables,table)?tables[table]:null;if(!config)return json({error:'table'},400);
 const page=Math.max(0,Math.min(100000,Number(req.nextUrl.searchParams.get('page'))||0));
 const optional=[];
 for(const column of config.optional??[]){
  const probe=await db.from(table).select(column).limit(0);
  if(probe.error&&['42703','PGRST204'].includes(probe.error.code))continue;
  if(probe.error)return json({error:(await getTranslations('Places'))('unavailable')},503);
  optional.push(column);
 }
 const result=await db.from(table).select([config.key,config.raw,...optional,PLACE_COLUMNS,'place_original'].join(','),{count:'exact'}).eq('place_status','pending').order(config.key).range(page*50,page*50+49);
 if(result.error)return json({error:(await getTranslations('Places'))('unavailable')},503);
 const rows=(result.data??[]) as unknown as Record<string,unknown>[];
 return json({rows:rows.map(row=>table==='projects'?{...row,project_sources:projectSources(row)}:row),count:result.count,page});
}
export async function POST(req:NextRequest){
 const auth=await requireAdmin();if(auth instanceof NextResponse)return auth;
 const body=await req.json().catch(()=>null),config=typeof body?.table==='string'&&Object.hasOwn(tables,body.table)?tables[body.table]:null;
 if(!config||typeof body?.id!=='string'||typeof body?.raw!=='string'||typeof body?.proposed!=='string'||body.proposed.length>320||!body.expected)return json({error:(await getTranslations('Places'))('invalid')},400);
 if(body.table==='profiles'){
  // An older open review must reload its original source snapshot. Reading the
  // current legacy fields here would hide an intervening member edit.
  const legacy=body.expected.profile_legacy;
  if(!legacy||typeof legacy!=='object'||Array.isArray(legacy)||!profileLegacy.every(key=>Object.hasOwn(legacy,key)&&(legacy[key]===null||typeof legacy[key]==='string')))return json({error:(await getTranslations('Places'))('conflict')},409);
 }
 if(body.table==='projects'){
  const sources=body.expected.project_sources;
  if(!sources||typeof sources!=='object'||Array.isArray(sources)||!projectKeys.every(key=>Object.hasOwn(sources,key)))return json({error:(await getTranslations('Places'))('conflict')},409);
 }
 if(body.table==='organizations'){
  const sources=body.expected.organization_sources;
  if(!sources||typeof sources!=='object'||Array.isArray(sources)||!Object.hasOwn(sources,'region')||(sources.region!==null&&typeof sources.region!=='string'))return json({error:(await getTranslations('Places'))('conflict')},409);
 }
 const fields=body.cityId?placeFieldsForId(body.cityId,body.proposed):placeWriteFields(body.proposed);if(!fields||fields.place_status!=='verified'||(body.table!=='projects'&&!fields.place_city_id))return json({error:(await getTranslations('Places'))('manualHelp')},422);
 // An explicit admin selection changes canonical fields only. Preserve all legacy content.
 const result=await db.rpc('apply_place_mapping',{p_table:body.table,p_id:body.id,p_expected_raw:body.raw,p_expected:body.expected,p_fields:{...fields,place_original:body.raw},p_run:randomUUID()});
 if(result.error)return json({error:(await getTranslations('Places'))('unavailable')},503);
 if(result.data!=='applied'&&result.data!=='unchanged')return json({error:(await getTranslations('Places'))('conflict')},409);
 for(const path of ['/creators','/companies','/locations','/locations/suche','/props','/jobs'])revalidatePath(path);
 for(const tag of ['profiles','listings','companies','creator-directory'])revalidateTag(tag,{expire:0});
 return json({ok:true});
}
