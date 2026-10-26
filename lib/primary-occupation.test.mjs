import test from 'node:test';
import assert from 'node:assert/strict';
import {occupationCatalogue, occupationChoices, primaryOccupationForPositions, occupationReference, filterPrimaryOccupations, occupiedPrimaryRoles, orderPositionsByPrimary, primaryOccupationError} from './primary-occupation.ts';
function option(dept,label){const result=occupationChoices([label]).find(role=>role.departmentId===dept);assert.ok(result,`${dept}: ${label}`);return occupationReference(result);}
const camera=option('kamera','2nd AC (Clapper / Loader)'),grip=option('grip','Key Grip'),light=option('licht','Gaffer (Oberbeleuchter)');
const profiles=[
 {id:'camera',primaryOccupation:camera,positions:['Key Grip','2nd AC (Clapper / Loader)']},
 {id:'grip',primaryOccupation:grip,positions:['2nd AC (Clapper / Loader)','Key Grip']},
 {id:'light',primaryOccupation:light,positions:['Gaffer (Oberbeleuchter)','Key Grip']},
 {id:'legacy',primaryOccupation:null,positions:['Key Grip','2nd AC (Clapper / Loader)']},
];
test('each profile belongs exclusively to the primary occupation department',()=>{
 for(const [department,id] of [['kamera','camera'],['grip','grip'],['licht','light']])assert.deepEqual(filterPrimaryOccupations(profiles,department).map(p=>p.id),[id]);
 assert.equal(filterPrimaryOccupations(profiles,null).length,4);assert.deepEqual(filterPrimaryOccupations(profiles,'does-not-exist'),[]);
});
test('secondary roles never satisfy the occupation filter and category selection intersects other filters',()=>{
 assert.deepEqual(filterPrimaryOccupations(profiles,'kamera',['Key Grip']),[]);
 assert.deepEqual(filterPrimaryOccupations(profiles,null,['Key Grip']).map(p=>p.id),['grip']);
 const berlin=profiles.filter(p=>p.id==='camera');assert.deepEqual(filterPrimaryOccupations(berlin,'grip'),[]);
});
test('no word fragments, biographies, generic profile types or auth roles infer a main department',()=>{
 assert.equal(primaryOccupationForPositions(null,['Kamera']),null);
 assert.equal(primaryOccupationForPositions(null,['Kamerabühne'])?.departmentId,'grip');
 assert.equal(primaryOccupationForPositions(null,['Key Grip','2nd AC (Clapper / Loader)']),null);
 assert.equal(primaryOccupationForPositions({departmentId:'kamera',roleId:grip.roleId},['Key Grip']),null);
 assert.equal(primaryOccupationForPositions(grip,['Gaffer (Oberbeleuchter)']),null);
});
test('a single exact unambiguous legacy title remains usable and explicit references survive reload',()=>{
 assert.equal(primaryOccupationForPositions(null,['Key Grip'])?.departmentId,'grip');
 const serialized=JSON.parse(JSON.stringify(camera));assert.equal(primaryOccupationForPositions(serialized,profiles[0].positions)?.departmentId,'kamera');
 assert.equal(primaryOccupationForPositions(null,['DIT'])?.departmentId,'kamera');
 assert.equal(primaryOccupationForPositions(null,['Best Boy Electric'])?.departmentId,'licht');
});
test('main job changes and rapid category switching never reuse previous results',()=>{
 const changed=profiles.map(p=>p.id==='camera'?{...p,primaryOccupation:grip}:p);
 for(let i=0;i<15;i++){
 assert.equal(filterPrimaryOccupations(changed,'kamera').length,0);
 assert.equal(filterPrimaryOccupations(changed,'grip').length,2);
 assert.equal(filterPrimaryOccupations(changed,'licht').length,1);
 }
 assert.deepEqual([...occupiedPrimaryRoles(changed)].sort(),['Gaffer (Oberbeleuchter)','Key Grip'].sort());
});
test('ordering preserves every stored title and server validation rejects mismatched primary selections',()=>{
 const positions=['Key Grip','2nd AC (Clapper / Loader)'];assert.deepEqual(orderPositionsByPrimary(positions,camera),[positions[1],positions[0]]);
 assert.deepEqual(positions,['Key Grip','2nd AC (Clapper / Loader)']);
 assert.equal(primaryOccupationError({primaryOccupation:camera},positions),null);
 assert.ok(primaryOccupationError({primaryOccupation:light},positions));assert.ok(primaryOccupationError({primaryOccupation:null},positions));
 assert.equal(primaryOccupationError({certificates:['legacy']},positions),null);
});

test('profile API persists the primary job and reloads it for the public directory without changing secondary jobs or ownership',async()=>{
 const {readFileSync}=await import('node:fs');const {createRequire}=await import('node:module');const {default:ts}=await import('typescript');
 const {createClient}=await import('@supabase/supabase-js');const require=createRequire(import.meta.url);const {NextRequest,NextResponse}=require('next/server');
 const primary=await import('./primary-occupation.ts');const compat=await import('./profile-db-compat.ts');
 let signedIn=true,saved={user_id:'test-owner',display_name:'Alex',positions:['Key Grip','2nd AC (Clapper / Loader)'],crew:{certificates:['Vorhanden']}};
 const writes=[];const db=createClient('https://fixture.invalid','fixture-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const url=new URL(input);if(init.method==='POST'){const body=JSON.parse(init.body);writes.push(body);saved={...saved,...body};return new Response(JSON.stringify(saved),{headers:{'content-type':'application/json'}});}
  if(init.method==='PATCH'){assert.equal(url.searchParams.get('user_id'),'eq.test-owner');const body=JSON.parse(init.body);writes.push(body);saved={...saved,...body};return new Response(JSON.stringify({user_id:saved.user_id}),{headers:{'content-type':'application/json'}});}
  return new Response(JSON.stringify([saved]),{headers:{'content-type':'application/json'}});
 }}});
 const deps={'@/lib/crew-occupations':await import('./crew-occupations.ts'),'@/lib/db':{db},'@/lib/primary-occupation':primary,'@/lib/profile-db-compat':compat,'@/lib/auth':{requireAuth:async()=>signedIn?{userId:'test-owner'}:NextResponse.json({error:'unauthorized'},{status:401})},'@clerk/nextjs/server':{clerkClient:async()=>({users:{updateUserMetadata:async()=>{}}})},'next/cache':{revalidateTag:()=>{}},'@/lib/profile-types':await import('./profile-types.ts'),'@/lib/profile-display':await import('./profile-display.ts'),'@/lib/profile-cover':{},'@/lib/trust':{getPrivateProfileIds:async()=>new Set()}};
 const load=file=>{const mod={exports:{}};const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(n=>deps[n]??require(n),mod,mod.exports);return mod.exports;};
 const api=load('../app/api/profile/route.ts'),directory=load('../app/api/creators/route.ts');
 const request=crew=>new NextRequest('https://fixture.invalid/api/profile',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({user_id:'someone-else',positions:saved.positions,crew})});
 assert.equal((await api.PATCH(request({primaryOccupation:light}))).status,400);assert.equal(writes.length,0);
 const created=await api.POST(new NextRequest('https://fixture.invalid/api/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({display_name:'Alex Test',location:'München',positions:saved.positions,profile_types:['camera'],crew:{...saved.crew,primaryOccupation:grip}})}));
 assert.equal(created.status,200);
 const firstDirectory=await directory.GET(new NextRequest('https://fixture.invalid/api/creators?page=1'));
 assert.equal(filterPrimaryOccupations((await firstDirectory.json()).creators,'grip').length,1);
 const response=await api.PATCH(request({...saved.crew,primaryOccupation:camera}));assert.equal(response.status,200);
 assert.deepEqual(saved.positions,['Key Grip','2nd AC (Clapper / Loader)']);assert.deepEqual(saved.crew.certificates,['Vorhanden']);assert.equal(saved.user_id,'test-owner');
 const reload=await api.GET();assert.deepEqual((await reload.json()).profile.crew.primaryOccupation,camera);
 const publicResponse=await directory.GET(new NextRequest('https://fixture.invalid/api/creators?page=1'));
 const body=await publicResponse.json();assert.equal(body.creators[0].primaryOccupation.departmentId,'kamera');assert.deepEqual(filterPrimaryOccupations(body.creators,'grip'),[]);
 const {filterCrewOccupations}=await import('./crew-occupations.ts');
 assert.equal(filterCrewOccupations(body.creators,'kamera',['2nd AC (Clapper / Loader)']).length,1);
 assert.equal(filterCrewOccupations(body.creators,'grip',['Key Grip']).length,1);
 const ton=option('ton','Tonassistenz'),lightAssist=option('licht','Lichtassistent*in');
 const update=async(positions,occupations)=>api.PATCH(new NextRequest('https://fixture.invalid/api/profile',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({positions,crew:{...saved.crew,primaryOccupation:occupations[0],occupations}})}));
 assert.equal((await update(['Tonassistenz','Lichtassistent*in'],[ton,lightAssist])).status,200);
 let directoryReload=await directory.GET(new NextRequest('https://fixture.invalid/api/creators?page=1'));let items=(await directoryReload.json()).creators;
 assert.equal(filterCrewOccupations(items,'ton',['Tonassistenz']).length,1);assert.equal(filterCrewOccupations(items,'licht',['Lichtassistent*in']).length,1);
 assert.equal((await update(['Lichtassistent*in'],[lightAssist])).status,200);
 directoryReload=await directory.GET(new NextRequest('https://fixture.invalid/api/creators?page=1'));items=(await directoryReload.json()).creators;
 assert.equal(filterCrewOccupations(items,'ton').length,0);assert.equal(filterCrewOccupations(items,'licht').length,1);
 signedIn=false;assert.equal((await api.PATCH(request({primaryOccupation:grip}))).status,401);assert.equal(writes.length,4);
});

test('private wizard drafts can pause before the main job is chosen, but publishing requires it',async()=>{
 const {START_QUICK_START_DRAFT,createQuickStartIntentData,validateQuickStartDraft,normalizeQuickStartDraft}=await import('./quick-start-flow.ts');
 const draft={...structuredClone(START_QUICK_START_DRAFT),step:'review',name:'Alex',personCity:'München',intents:['crew'],sections:{crew:{...createQuickStartIntentData(),departmentIds:['kamera','grip'],roles:[{departmentId:'kamera',role:'2nd AC (Clapper / Loader)'},{departmentId:'grip',role:'Key Grip'}]}}};
 assert.equal(validateQuickStartDraft(draft,{requirePrimary:false}),null);assert.equal(validateQuickStartDraft(draft)?.field,'primaryOccupation');
 draft.primaryOccupation=camera;const reloaded=normalizeQuickStartDraft(JSON.parse(JSON.stringify(draft)));assert.deepEqual(reloaded.primaryOccupation,camera);assert.equal(validateQuickStartDraft(reloaded),null);
});


test('every catalogue occupation has a unique reference and belongs to exactly its declared department',()=>{
 const ids=new Set();
 for(const occupation of occupationCatalogue){
  assert.ok(!ids.has(occupation.roleId));ids.add(occupation.roleId);
  const reference=occupationReference(occupation);
  assert.equal(primaryOccupationForPositions(reference,[occupation.label])?.departmentId,occupation.departmentId);
  const record={primaryOccupation:reference};
  assert.equal(filterPrimaryOccupations([record],occupation.departmentId).length,1);
  assert.equal(filterPrimaryOccupations([record],occupation.departmentId==='kamera'?'grip':'kamera').length,0);
 }
});

test('declared lighting synonyms resolve exactly to one canonical role and keep older IDs valid',()=>{
 for(const title of ['Gaffer','Oberbeleuchter','Gaffer / Oberbeleuchter','Oberbeleuchter / Gaffer','Licht / Gaffer','Gaffer (Oberbeleuchter)']) {
  const choices=occupationChoices([title]);assert.equal(choices.length,1,title);assert.equal(choices[0].roleId,light.roleId);
  assert.equal(primaryOccupationForPositions(null,[title])?.departmentId,'licht');
 }
 for(const title of ['Best Boy Electric','Beleuchter','Beleuchter (Electrician)'])assert.equal(primaryOccupationForPositions(null,[title])?.departmentId,'licht');
 assert.equal(primaryOccupationForPositions(null,['Licht']),null);
 assert.equal(primaryOccupationForPositions(null,['Gaffer','Ungeklärte weitere Tätigkeit']),null);
 const old={departmentId:'licht',roleId:'licht/'+encodeURIComponent('Oberbeleuchter / Gaffer')};
 assert.equal(primaryOccupationForPositions(old,['Gaffer'])?.roleId,light.roleId);
 assert.equal(primaryOccupationForPositions(null,['Gaffer','Oberbeleuchter'])?.roleId,light.roleId);
});
test('an explicit stored legacy main role takes priority over secondary roles without guessing from list order',()=>{
 const positions=['Best Boy Electric','Gaffer (Oberbeleuchter)','Rigging Gaffer'];
 assert.equal(primaryOccupationForPositions(null,positions,'Gaffer (Oberbeleuchter)')?.roleId,light.roleId);
 assert.equal(primaryOccupationForPositions(null,positions),null);
 assert.equal(primaryOccupationForPositions(null,positions,'Licht'),null);
 assert.equal(primaryOccupationForPositions(null,positions,'Key Grip'),null);
 assert.equal(primaryOccupationForPositions(camera,['2nd AC (Clapper / Loader)','Gaffer'], 'Gaffer')?.roleId,camera.roleId);
});
test('offer categories never create a crew profile and mixed personal/offer accounts remain discoverable',async()=>{
 const {isCrewDirectoryProfile}=await import('./primary-occupation.ts');
 for(const type of ['location','equipment','vehicle','studio','props','company'])assert.equal(isCrewDirectoryProfile({profile_types:[type]}),false);
 assert.equal(isCrewDirectoryProfile({profile_types:['location','lighting'],positions:['Gaffer']}),true);
 assert.equal(isCrewDirectoryProfile({positions:[],role:''}),false);
 assert.equal(isCrewDirectoryProfile({positions:['Gaffer']}),true);
});
test('every selectable occupation works as a stable-ID filter, in catalogue order, across departments',async()=>{
 const {departments}=await import('./departments.ts');
 assert.deepEqual(occupationCatalogue.map(o=>o.departmentId),departments.flatMap(d=>[...new Set(d.roles)].map(()=>d.id)));
 for(const o of occupationCatalogue){
  assert.equal(filterPrimaryOccupations([{primaryOccupation:occupationReference(o)}],o.departmentId,[o.roleId]).length,1);
 }
 for(const [title,dept] of [['Key Grip','grip'],['Dolly Grip','grip'],['Kameraassistenz','kamera'],['DIT','kamera'],['Boom Operator','ton'],['Catering-Leitung','catering-setverpflegung'],['Regisseur/in','regie']])assert.equal(primaryOccupationForPositions(null,[title])?.departmentId,dept,title);
});


test('legacy authored personal profiles remain in All areas without inventing a main job or admitting empty accounts',async()=>{
 const {isCrewDirectoryProfile}=await import('./primary-occupation.ts');
 const legacy={display_name:'Legacy Testperson',bio:'Öffentliche Vorstellung',positions:[],profile_types:[]};
 assert.equal(isCrewDirectoryProfile(legacy),true);
 assert.equal(primaryOccupationForPositions(null,legacy.positions),null);
 assert.equal(filterPrimaryOccupations([{primaryOccupation:null}],'kamera').length,0);
 assert.equal(isCrewDirectoryProfile({display_name:'Leeres Konto',profile_types:[],positions:[]}),false);
 assert.equal(isCrewDirectoryProfile({...legacy,profile_types:['location']}),false);
 assert.equal(isCrewDirectoryProfile({...legacy,bio:'',portfolio_images:['https://fixture.invalid/public-photo.jpg']}),true);
});

test('older profiles with exclusively same-department jobs appear in that department, without an invented main job',async()=>{
 const {crewDepartmentForPositions}=await import('./primary-occupation.ts');
 for(const [titles,dept] of [
  [['Beleuchter (Electrician)','Lighting Programmer (DMX)','Lichtpult Assistent*in','Lichtpult Operator'],'licht'],
  [['2nd AC (Clapper / Loader)','Videooperator'],'kamera'],
  [['Key Grip','Dolly Grip'],'grip'],
  [['Boom Operator','Tonassistenz'],'ton'],
 ]){
  assert.equal(primaryOccupationForPositions(null,titles),null);
  const crewDepartmentId=crewDepartmentForPositions(null,titles);
  assert.equal(crewDepartmentId,dept);
  const profile={primaryOccupation:null,crewDepartmentId};
  assert.equal(filterPrimaryOccupations([profile],dept).length,1);
  assert.equal(filterPrimaryOccupations([profile],dept,[titles[0]]).length,0);
  assert.equal(filterPrimaryOccupations([profile],dept==='kamera'?'grip':'kamera').length,0);
 }
});
test('mixed, unknown and invalid legacy departments remain unassigned; an explicit main job still takes priority',async()=>{
 const {crewDepartmentForPositions}=await import('./primary-occupation.ts');
 assert.equal(crewDepartmentForPositions(null,['Beleuchter','Key Grip']),null);
 assert.equal(crewDepartmentForPositions(null,['Licht']),null);
 assert.equal(crewDepartmentForPositions(null,['Kamera']),null);
 assert.equal(crewDepartmentForPositions(null,['Gaffer','Ungeklärte Tätigkeit']),null);
 assert.equal(crewDepartmentForPositions({departmentId:'licht',roleId:'invalid'},['Gaffer']),null);
 assert.equal(crewDepartmentForPositions(camera,['Key Grip','2nd AC (Clapper / Loader)']),'kamera');
 assert.equal(crewDepartmentForPositions(null,['Best Boy Electric','Gaffer'],'Gaffer'),'licht');
});
