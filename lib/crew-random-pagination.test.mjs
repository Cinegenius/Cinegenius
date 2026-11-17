import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';import {createHash} from 'node:crypto';
const seed='0123456789abcdef0123456789abcdef';
function fixture(data=[]){
 const calls=[],checks=[];const builder={select(){return this},not(){return this},neq(){return this},order(...args){calls.push(['order',...args]);return this},range(...args){calls.push(['range',...args]);return Promise.resolve({data,error:null})}};
 const db={from:table=>{calls.push(['from',table]);return builder},rpc:(name,args)=>{calls.push(['rpc',name,args]);return builder}};
 const dependencies={
  '@/lib/discovery-order-server':{validDiscoverySeed:v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v)?v:null,discoveryOrder:(s,id)=>createHash('md5').update(`${s}:${id}`).digest('hex')},
  '@/lib/occupation-form':{occupationFormFromCrew:()=> 'standard'},'@clerk/nextjs/server':{auth:async()=>({userId:'viewer'})},
  '@/lib/profile-privacy-server':{profileAccessFor:async(ids,viewer)=>{checks.push({ids,viewer});return new Map(ids.map(id=>[id,{profile:id!=='private'}]))}},
  '@/lib/profile-privacy':{projectProfilePrivacy:p=>p},'@/lib/places/public-map-point':{publicMapPoint:()=>({})},
  'next-intl/server':{getTranslations:async()=>()=> 'Request failed',getLocale:async()=> 'de'},'@/lib/places/catalog':{placeReadFields:()=>({})},
  '@/lib/profile-provider-filters':{isPeopleDirectoryProfile:()=>true},'@/lib/crew-occupations':{crewOccupationIds:()=>[]},
  '@/lib/primary-occupation':{primaryOccupationForPositions:()=>null,occupationReference:()=>null},'@/lib/db':{db},
  'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},'@/lib/profile-types':{PROFILE_CATEGORY_MAP:{},PROFILE_TYPE_LABELS:{}},
  '@/lib/profile-display':{getProfileDisplayPositions:()=>[],normalizeProfileTypes:()=>[]},'@/lib/trust':{},
 };
 const code=ts.transpileModule(readFileSync(new URL('../app/api/creators/route.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(dependencies,name),name);return dependencies[name]},mod,mod.exports);
 return {calls,checks,get:q=>mod.exports.GET({nextUrl:new URL('https://fixture.test/api/creators?'+q)})};
}
test('a seeded Crew page uses its database offset exactly once and still excludes private profiles before serialization',async()=>{
 const f=fixture([{user_id:'public',display_name:'Public'},{user_id:'private',display_name:'Private canary'}]);const response=await f.get('page=2&seed='+seed),body=await response.json();
 assert.deepEqual(f.calls[0],['rpc','random_crew_profiles',{p_seed:seed,p_offset:144,p_limit:48}]);assert.deepEqual(f.calls.at(-1),['range',0,47]);
 assert.deepEqual(f.checks,[{ids:['public','private'],viewer:'viewer'}]);assert.deepEqual(body.creators.map(p=>p.id),['public']);assert.equal(body.hasMore,false);
 assert.equal(body.creators[0].discoveryOrder,createHash('md5').update(seed+':public').digest('hex'));assert.match(response.headers.get('cache-control'),/no-store/);
});
test('installed clients without a seed retain their alphabetical offset contract',async()=>{
 const f=fixture();await f.get('page=2');assert.deepEqual(f.calls,[['from','profiles'],['order','display_name',{ascending:true}],['order','user_id',{ascending:true}],['range',144,191]]);
});
test('malformed Crew responses fail instead of reporting a confirmed zero',async()=>{
 const f=fixture({unexpected:true}),r=await f.get('seed='+seed);assert.equal(r.status,500);assert.equal(f.checks.length,0);
});
