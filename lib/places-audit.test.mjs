import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdtemp,writeFile,stat,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {placeWriteFields} from './places/catalog.ts';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import * as placeCatalog from './places/catalog.ts';
import * as placeCore from './places/core.ts';
const keys=['place_country_code','place_region_id','place_city_id','place_city_name','place_region_name','place_status','place_original'];
const empty=()=>Object.fromEntries(keys.map(key=>[key,key==='place_status'?'pending':null]));
test('actual audit program preserves raw/parallel values and skips completed mappings on a second run',async()=>{
 const rows={profiles:[{user_id:'one',location:'Cologne, DE',location_city:null,location_region:null,location_country:null,...empty()},{user_id:'two',location:'Frankfurt',location_city:'Frankfurt',location_region:null,location_country:'DE',...empty()}],projects:[{id:'project',place_location:'',place_country:'Germany',place_shoot_locations:['Frankfurt','Japan'],...empty()}],listings:[],companies:[],organizations:[],organization_entries:[],community_posts:[]};
 const writes=[];let purges=0;
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url.startsWith('/rest/v1/rpc/purge_place_change_journal')){purges++;res.end('2');return;}
  if(req.url.startsWith('/rest/v1/rpc/apply_place_mapping')){
   let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);writes.push(input);const row=rows[input.p_table].find(row=>(row.user_id??row.id)===input.p_id);Object.assign(row,input.p_fields);res.end(JSON.stringify('applied'));return;
  }
  const table=new URL(req.url,'http://fixture.invalid').pathname.split('/').at(-1);res.end(JSON.stringify(rows[table]??[]));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const directory=await mkdtemp(join(tmpdir(),'cg-place-audit-')),outputFile=join(directory,'report.json');
 const exec=(apply=true,reportPath='')=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--experimental-strip-types','--import',fileURLToPath(new URL('../scripts/register-test-aliases.mjs',import.meta.url)),fileURLToPath(new URL('../scripts/audit-places.mjs',import.meta.url)),...(apply?['--apply']:[]),...(reportPath?[`--output=${reportPath}`]:[])],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${server.address().port}`,SUPABASE_SERVICE_ROLE_KEY:'own-fixture-key'}});
  let output='',errors='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>errors+=v);child.on('exit',code=>code===0?resolve(JSON.parse(output)):reject(Error(errors+'\n'+output)));
 });
 try{
  const first=await exec();assert.equal(first.tables.profiles.applied,2);assert.equal(first.tables.projects.applied,1);
  assert.equal(rows.profiles[0].location,'Cologne, DE');assert.equal(rows.profiles[0].place_city_id,'geonames:2886242');
  assert.equal(rows.profiles[1].place_status,'pending');assert.equal(rows.profiles[1].location_country,'DE');assert.equal(rows.profiles[1].place_city_id,null);
  assert.deepEqual(rows.projects[0].place_shoot_locations,['Frankfurt','Japan']);assert.equal(rows.projects[0].place_country_code,'DE');
  assert.equal(writes[0].p_expected.place_original,null);assert.deepEqual(writes[0].p_fields,placeWriteFields('Cologne, DE'));
  assert.deepEqual(writes[0].p_expected.profile_legacy,{location_city:null,location_region:null,location_country:null});
  assert.deepEqual(writes[1].p_expected.profile_legacy,{location_city:'Frankfurt',location_region:null,location_country:'DE'});
  assert.deepEqual(writes[2].p_expected.project_sources,{country:null,shoot_locations:null,metadata_location:'',metadata_country:'Germany',metadata_shoot_locations:['Frankfurt','Japan']});
  assert.deepEqual(first.cleanup,{removed:2});assert.equal(purges,1);
  const second=await exec();assert.equal(second.tables.profiles.applied,0);assert.equal(writes.length,3);assert.equal(rows.profiles[0].place_city_id,'geonames:2886242');
  await writeFile(outputFile,'old report',{mode:0o644});
  assert.equal(purges,2);const dry=await exec(false,outputFile);assert.equal(dry.cleanup,null);assert.equal(purges,2);
  if(process.platform!=='win32')assert.equal((await stat(outputFile)).mode&0o777,0o600);
  assert.equal(JSON.parse(await readFile(outputFile,'utf8')).tables.profiles.records,2);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});

test('production schema without profile legacy columns audits top-level and metadata project sources separately',async()=>{
 const project=(id,values)=>({id,country:null,shoot_locations:null,place_location:null,place_country:null,place_shoot_locations:null,...empty(),...values});
 const rows={profiles:[{user_id:'own-profile',location:'Cologne, DE',...empty()}],companies:[],listings:[],organizations:[{id:'own-org',city:'Cologne',region:'Deutschland · bundesweit',...empty()}],organization_entries:[],community_posts:[],projects:[
  project('production-only',{country:'Germany',shoot_locations:['Tokyo, JP'],place_country:'Deutschland',place_shoot_locations:['Tokyo, JP']}),
  project('different-roles',{country:'JP',shoot_locations:['Cologne, DE'],place_location:'Cologne, DE',place_country:'Japan'}),
  project('country-conflict',{country:'Germany',place_country:'France'}),
  project('shoot-only',{shoot_locations:['Tokyo, JP']}),
  project('structured-location',{country:'Germany',place_location:{unexpected:'preserved'}}),
  project('shoot-conflict',{country:'Germany',shoot_locations:['Tokyo, JP'],place_shoot_locations:['Wien, AT']}),
 ]};
 const writes=[],probes=[];let purges=0;
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');const url=new URL(req.url,'http://fixture.invalid');
  if(url.pathname.endsWith('/purge_place_change_journal')){purges++;res.end('0');return;}
  if(url.pathname.endsWith('/apply_place_mapping')){
   let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);writes.push(input);
   Object.assign(rows[input.p_table].find(row=>(row.user_id??row.id)===input.p_id),input.p_fields);res.end(JSON.stringify('applied'));return;
  }
  const table=url.pathname.split('/').at(-1),selected=url.searchParams.get('select')??'';
  if(table==='profiles'&&['location_city','location_region','location_country'].some(column=>selected.split(',').includes(column))){probes.push(selected);res.statusCode=400;res.end(JSON.stringify({code:'42703',message:'Optional column does not exist'}));return;}
  if(url.searchParams.get('limit')==='0'){res.end('[]');return;}
  res.end(JSON.stringify(rows[table]??[]));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const report=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['--experimental-strip-types','--import',fileURLToPath(new URL('../scripts/register-test-aliases.mjs',import.meta.url)),fileURLToPath(new URL('../scripts/audit-places.mjs',import.meta.url)),'--apply'],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${server.address().port}`,SUPABASE_SERVICE_ROLE_KEY:'own-fixture-key'}});
   let output='',errors='';child.stdout.on('data',value=>output+=value);child.stderr.on('data',value=>errors+=value);child.on('exit',code=>code===0?resolve(JSON.parse(output)):reject(Error(errors+'\n'+output)));
  });
  assert.deepEqual(report.errors,[]);assert.equal(report.tables.profiles.applied,1);assert.deepEqual(report.tables.profiles.absentOptionalColumns,['location_city','location_region','location_country']);assert.equal(probes.length,3);
  assert.deepEqual(writes[0].p_expected.profile_legacy,{location_city:null,location_region:null,location_country:null});
  assert.equal(rows.projects[0].place_country_code,'DE');assert.equal(rows.projects[0].place_city_id,null);assert.equal(rows.projects[0].place_status,'verified');assert.deepEqual(rows.projects[0].shoot_locations,['Tokyo, JP']);
  assert.equal(rows.projects[1].country,'JP');assert.equal(rows.projects[1].place_country_code,'DE');assert.equal(rows.projects[1].place_status,'verified');
  for(const row of rows.projects.slice(2))assert.equal(row.place_status,'pending',row.id);
  assert.deepEqual(report.tables.projects.sourceIssues,{production_country_conflict:1,shoot_locations_without_primary:1,metadata_location_type:1,shoot_locations_conflict:1});
  assert.deepEqual(writes.find(input=>input.p_id==='production-only').p_expected.project_sources,{country:'Germany',shoot_locations:['Tokyo, JP'],metadata_location:null,metadata_country:'Deutschland',metadata_shoot_locations:['Tokyo, JP']});
  const orgWrite=writes.find(input=>input.p_id==='own-org');assert.equal(orgWrite.p_expected_raw,'Cologne');assert.deepEqual(orgWrite.p_expected.organization_sources,{region:'Deutschland · bundesweit'});assert.equal(orgWrite.p_fields.place_country_code,null);assert.equal(rows.organizations[0].region,'Deutschland · bundesweit');
  assert.equal(purges,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('admin review tolerates optional profile schema and carries unchanged project and organization source snapshots',async()=>{
 const require=createRequire(import.meta.url),{NextRequest,NextResponse}=require('next/server');
 const profile={user_id:'own-profile',location:'Cologne, DE',...empty()},project={id:'own-project',country:'Germany',shoot_locations:['Tokyo, JP'],place_location:'Cologne, DE',place_country:'Deutschland',place_shoot_locations:['Tokyo, JP'],...empty()},organization={id:'own-organization',city:'Berlin',region:'Deutschland · bundesweit',...empty()};
 const calls=[],writes=[];let admin=true;
 const db=createClient('https://fixture.invalid','fixture-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);calls.push(url);
  if(url.pathname.includes('/rpc/')){writes.push(JSON.parse(init.body));return Response.json('applied');}
  const table=url.pathname.split('/').at(-1),selected=url.searchParams.get('select')??'';
  if(table==='profiles'&&['location_city','location_region','location_country'].some(column=>selected.split(',').includes(column)))return Response.json({code:'42703',message:'Optional column does not exist'},{status:400});
  if(url.searchParams.get('limit')==='0')return Response.json([]);
  return Response.json([table==='profiles'?profile:table==='projects'?project:organization],{headers:{'Content-Range':'0-0/1'}});
 }}});
 const source=ts.transpileModule(readFileSync(new URL('../app/api/admin/places/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}},deps={'@/lib/db':{db},'@/lib/auth':{requireAdmin:async()=>admin?{userId:'own-admin'}:NextResponse.json({error:'forbidden'},{status:403})},'next-intl/server':{getTranslations:async()=>key=>key},'next/cache':{revalidatePath(){},revalidateTag(){}},'@/lib/places/core':placeCore,'@/lib/places/catalog':placeCatalog};
 new Function('require','module','exports',source)(name=>deps[name]??require(name),mod,mod.exports);const route=mod.exports;
 const request=table=>new NextRequest(`https://fixture.invalid/api/admin/places?table=${table}`),expected=row=>Object.fromEntries(keys.map(key=>[key,row[key]??null]));
 const post=body=>route.POST(new NextRequest('https://fixture.invalid/api/admin/places',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
 admin=false;assert.equal((await route.GET(request('profiles'))).status,403);assert.equal(calls.length,0);admin=true;
 const profiles=await route.GET(request('profiles'));assert.equal(profiles.status,200);assert.match(profiles.headers.get('Cache-Control'),/no-store/);assert.equal((await profiles.json()).rows[0].location,profile.location);
 assert.equal(calls.filter(url=>url.searchParams.get('limit')==='0').length,3);
 const projects=await route.GET(request('projects')),projectRow=(await projects.json()).rows[0];
 assert.deepEqual(projectRow.project_sources,{country:'Germany',shoot_locations:['Tokyo, JP'],metadata_location:'Cologne, DE',metadata_country:'Deutschland',metadata_shoot_locations:['Tokyo, JP']});
 const body={table:'projects',id:project.id,raw:'Cologne, DE',proposed:'Cologne, DE',expected:expected(project)};
 assert.equal((await post(body)).status,409);assert.equal(writes.length,0);
 body.expected.project_sources=projectRow.project_sources;assert.equal((await post(body)).status,200);assert.deepEqual(writes[0].p_expected.project_sources,projectRow.project_sources);
 const orgBody={table:'organizations',id:organization.id,raw:'Berlin',proposed:'Cologne, DE',expected:expected(organization)};
 assert.equal((await post(orgBody)).status,409);orgBody.expected.organization_sources={region:organization.region};assert.equal((await post(orgBody)).status,200);assert.equal(writes[1].p_expected_raw,'Berlin');assert.deepEqual(writes[1].p_expected.organization_sources,{region:'Deutschland · bundesweit'});
});
