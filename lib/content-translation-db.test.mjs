import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let pg;
const source='10000000-0000-4000-8000-000000000001',hash='a'.repeat(64),principal='b'.repeat(64);
before(async()=>{pg=new PGlite();await pg.exec('create role anon;create role authenticated;create role service_role;');await pg.exec(readFileSync('supabase/migrations/20261119192145_content_translation_cache.sql','utf8'))});
after(()=>pg?.close());
const rows=async(sql,args=[])=>(await pg.query(sql,args)).rows;
const tx=fn=>async()=>{await pg.exec('begin');try{await fn()}finally{await pg.exec('rollback')}};
const claim=async(overrides={})=>{const p={kind:'listing',id:source,locale:'en',hash,characters:100,principal,...overrides};return (await rows('select public.claim_content_translation($1,$2,$3,$4,$5,$6) value',[p.kind,p.id,p.locale,p.hash,p.characters,p.principal]))[0].value};
const finish=async(lease,fields={title:'Light'},revision=hash)=>(await rows('select public.finish_content_translation($1,$2,$3,$4,$5,$6) value',['listing',source,'en',revision,lease,fields]))[0].value;
const read=async(revision=hash)=>(await rows('select public.read_content_translation($1,$2,$3,$4) value',['listing',source,'en',revision]))[0].value;

test('private schema, tables and RPCs cannot be used by browser roles',tx(async()=>{
 for(const role of ['anon','authenticated']){
  assert.equal((await rows("select has_schema_privilege($1,'content_translation_private','usage') allowed",[role]))[0].allowed,false);
  for(const name of ['limits','cache','usage'])assert.equal((await rows('select has_table_privilege($1,$2,\'select\') allowed',[role,'content_translation_private.'+name]))[0].allowed,false);
  for(const fn of ['read_content_translation(text,text,text,text)','claim_content_translation(text,text,text,text,integer,text)','finish_content_translation(text,text,text,text,uuid,jsonb)'])assert.equal((await rows("select has_function_privilege($1,$2,'execute') allowed",[role,fn]))[0].allowed,false);
 }
 assert.equal((await rows("select has_schema_privilege('service_role','content_translation_private','usage') allowed"))[0].allowed,false);
 assert.equal((await rows("select has_function_privilege('service_role','public.read_content_translation(text,text,text,text)','execute') allowed"))[0].allowed,true);
 const tables=await rows("select relrowsecurity from pg_class where relnamespace='content_translation_private'::regnamespace and relkind='r'");assert.equal(tables.length,3);assert.ok(tables.every(r=>r.relrowsecurity));
}));
test('one lease and one budget charge for the same translation; completed text can be reused',tx(async()=>{
 assert.equal(await read(),null);const first=await claim();assert.equal(first.status,'claimed');assert.equal((await claim()).status,'pending');
 assert.equal(await finish(first.lease),true);assert.equal((await claim()).status,'ready');assert.deepEqual(await read(),{state:'ready',fields:{title:'Light'}});
 const usage=await rows('select calls,characters from content_translation_private.usage');assert.ok(usage.every(r=>r.calls===1&&Number(r.characters)===100));
}));
test('changed source invalidates old cache and an older worker cannot overwrite the new lease',tx(async()=>{
 const first=await claim();const revision='c'.repeat(64);const second=await claim({hash:revision});assert.equal(second.status,'claimed');assert.notEqual(second.lease,first.lease);
 assert.equal(await finish(first.lease),false);assert.equal(await read(),null);assert.equal(await finish(second.lease,{title:'Changed'},revision),true);assert.equal((await read(revision)).fields.title,'Changed');
}));
test('failed provider calls count toward budgets and have a bounded cooldown',tx(async()=>{
 const first=await claim();assert.equal(await finish(first.lease,null),true);assert.equal((await claim()).status,'unavailable');
 await pg.exec("update content_translation_private.cache set retry_after=now()-interval '1 second'");assert.equal((await claim()).status,'claimed');
 assert.ok((await rows('select calls from content_translation_private.usage')).every(r=>r.calls===2));
}));
test('expired lease is replaceable but cannot publish stale text',tx(async()=>{
 const first=await claim();await pg.exec("update content_translation_private.cache set lease_until=now()-interval '1 second'");assert.equal(await finish(first.lease),false);
 const second=await claim();assert.equal(second.status,'claimed');assert.notEqual(second.lease,first.lease);
}));
for(const [name,sql,changes] of [
 ['global calls','calls_per_day=0',{}],['character budget','characters_per_day=50',{}],['personal calls','calls_per_principal=0',{}],['disabled','enabled=false',{}],
])test('no paid reservation beyond '+name,tx(async()=>{await pg.exec('update content_translation_private.limits set '+sql);assert.equal((await claim(changes)).status,'unavailable');assert.equal((await rows('select count(*)::int n from content_translation_private.cache'))[0].n,0)}));
test('concurrent capacity counts pending work and resumes after completion',tx(async()=>{
 await pg.exec('update content_translation_private.limits set concurrent_calls=1');const one=await claim();assert.equal((await claim({id:source.slice(0,-1)+'2'})).status,'pending');await finish(one.lease);assert.equal((await claim({id:source.slice(0,-1)+'2'})).status,'claimed');
}));
test('wrong lease, oversized fields and non-object outputs cannot finish a reservation',tx(async()=>{
 const first=await claim();assert.equal(await finish('10000000-0000-4000-8000-000000000009'),false);assert.equal(await finish(first.lease,['bad']),false);assert.equal(await finish(first.lease,{title:'x'.repeat(400001)}),false);assert.equal(await finish(first.lease),true);
}));
for(const [name,change] of Object.entries({nullKind:{kind:null},nullLocale:{locale:null},unknownKind:{kind:'message'},unknownLocale:{locale:'xx'},badHash:{hash:'x'},badPrincipal:{principal:'private-email@example.test'},tooLong:{characters:24001},negative:{characters:-1}}))test('reject invalid reservation '+name,tx(async()=>assert.equal((await claim(change)).status,'unavailable')));
test('expired translations and old budget records are removed by later valid claims',tx(async()=>{
 const first=await claim();await finish(first.lease);await pg.exec("update content_translation_private.cache set expires_at=now()-interval '1 day'; update content_translation_private.usage set day=current_date-4");
 assert.equal(await read(),null);await claim({id:source.slice(0,-1)+'2'});assert.equal((await rows('select count(*)::int n from content_translation_private.cache'))[0].n,1);assert.equal((await rows('select count(*)::int n from content_translation_private.usage where day<current_date-2'))[0].n,0);
}));
