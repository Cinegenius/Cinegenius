import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import {PGlite} from '@electric-sql/pglite';
import * as policy from './editorial-agent-policy.ts';
import * as placeCore from './places/core.ts';
import * as placeCatalog from './places/catalog.ts';
import {organizationTestBootstrap} from './test-fixtures/organization-database.mjs';
const require=createRequire(import.meta.url), token='cge_'+'b'.repeat(64), digest=createHash('sha256').update(token).digest('hex');
let pg,admin=false,rateAllowed=true;
function load(file,mocks){const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);return mod.exports;}
class Query{
 constructor(table){assert.match(table,/^[a-z_]+$/);this.table=table;this.fields='*';this.values=[];this.filters=[];}
 select(fields){this.fields=fields;return this;}eq(key,value){assert.match(key,/^[a-z_]+$/);this.values.push(value);this.filters.push(`${key}=$${this.values.length}`);return this;}
 maybeSingle(){this.single=true;return this;}order(){return this;}limit(){return this;}range(){return this;}
 then(resolve,reject){return this.run().then(resolve,reject);}
 async run(){try{assert.match(this.fields,/^[a-z_,*]+$/);const rows=(await pg.query(`select ${this.fields} from ${this.table}${this.filters.length?' where '+this.filters.join(' and '):''}`,this.values)).rows;return{data:this.single?rows[0]??null:rows,error:null};}catch(error){return{data:null,error};}}
}
const db={from:table=>new Query(table),rpc:async(name,args)=>{assert.match(name,/^[a-z_]+$/);try{const keys=Object.keys(args);await pg.exec('savepoint rpc_call');const result=await pg.query(`select * from ${name}(${keys.map((key,i)=>`${key}=>$${i+1}`).join(',')})`,Object.values(args).map(value=>value&&typeof value==='object'?JSON.stringify(value):value));await pg.exec('release savepoint rpc_call');return{data:result.rows[0],error:null};}catch(error){await pg.exec('rollback to savepoint rpc_call');return{data:null,error};}}};
const mocks={'@/lib/places/core':placeCore,'server-only':{},'next/server':{NextResponse},'@/lib/db':{db},'@/lib/editorial-agent-policy':policy,'@/lib/rateLimit':{rateLimit:async()=>({allowed:rateAllowed})},'@/lib/auth':{requireAdmin:async()=>admin?{userId:'admin'}:NextResponse.json({error:'forbidden'},{status:403})}};
mocks['@/lib/editorial-agent-server']=load('./editorial-agent-server.ts',mocks);
mocks['@/lib/organization-taxonomy']=load('./organization-taxonomy.ts',mocks);
mocks['@/lib/organization-media']={validateOrganizationMediaReference:async value=>value?{error:'media'}:{url:null}};
mocks['@/lib/places/catalog']=placeCatalog;
const entries=load('../app/api/editorial/entries/route.ts',mocks),moderation=load('../app/api/editorial/entries/moderation/route.ts',mocks),grants=load('../app/api/admin/organizations/editorial-grants/route.ts',mocks);
before(async()=>{process.env.CINEGENIUS_EDITORIAL_ENABLED='true';process.env.CINEGENIUS_EDITORIAL_TOKEN_SHA256=digest;pg=new PGlite();await pg.exec(organizationTestBootstrap);await pg.exec('alter table listings add column published boolean, add column type text');for(const file of ['20261103170000_organizations_and_news.sql','20261109170000_canonical_places.sql','20261120152314_delegated_editorial_publication.sql'])await pg.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));});
after(async()=>{delete process.env.CINEGENIUS_EDITORIAL_ENABLED;delete process.env.CINEGENIUS_EDITORIAL_TOKEN_SHA256;await pg?.close();});
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');admin=false;rateAllowed=true;}}
const req=(path,body,key=token,origin)=>new NextRequest('https://cinegenius.test'+path,{method:'POST',headers:{'content-type':'application/json',...(key?{authorization:'Bearer '+key}:{}),...(origin?{origin}:{})},body:JSON.stringify(body)});
async function org(){return(await pg.query("insert into organizations(owner_user_id,last_actor_user_id,responsible_user_id,slug,name,moderation_status) values('support','admin','support','test-room','Own test room','approved') returning *")).rows[0];}
async function grant(o){admin=true;const response=await grants.POST(req('/api/admin/organizations/editorial-grants',{organizationId:o.id,enabled:true,expectedUpdatedAt:null,reason:'Explicit newsroom approval'},null,'https://cinegenius.test'));assert.equal(response.status,200);admin=false;}
const doc=(o)=>({id:'11111111-1111-4111-8111-111111111111',organizationId:o.id,expectedUpdatedAt:null,submit:false,entryType:'news',title:'New checked editorial news',summary:'Own summary',description:'Own description',topic:'industry',format:'online',externalUrl:'https://example.org/source',imageUrl:'',city:''});
test('a Support cookie cannot replace the machine credential and a key cannot grant itself rights',()=>tx(async()=>{
 const o=await org();let response=await entries.POST(req('/api/editorial/entries',doc(o),null));assert.equal(response.status,401);
 response=await grants.POST(req('/api/admin/organizations/editorial-grants',{organizationId:o.id,enabled:true,expectedUpdatedAt:null,reason:'Attempted self grant'}));assert.equal(response.status,403);
 response=await entries.POST(req('/api/editorial/entries',doc(o)));assert.equal(response.status,403);
}));
test('the real routes save privately, read back, submit, publish and hide with the service identity',()=>tx(async()=>{
 const o=await org();await grant(o);let payload=doc(o);let response=await entries.POST(req('/api/editorial/entries',payload));assert.equal(response.status,200);let item=(await response.json()).entry;assert.equal(item.moderation_status,'draft');assert.equal(item.author_user_id,'cinegenius-editorial');
 response=await entries.GET(new NextRequest(`https://cinegenius.test/api/editorial/entries?organizationId=${o.id}&id=${item.id}`,{headers:{authorization:'Bearer '+token}}));assert.equal(response.status,200);assert.equal((await response.json()).entries[0].title,payload.title);
 response=await entries.POST(req('/api/editorial/entries',{...payload,expectedUpdatedAt:item.updated_at,submit:true}));assert.equal(response.status,200);item=(await response.json()).entry;
 const review={id:item.id,expectedUpdatedAt:item.updated_at,action:'publish',sourceUrl:item.external_url,checkedAt:new Date().toISOString(),verified:true,reason:'Source, rights, dates and duplicates checked'};
 response=await moderation.POST(req('/api/editorial/entries/moderation',{...review,actor:'admin'}));assert.equal(response.status,200);item=(await response.json()).entry;assert.equal(item.publication_authority,'editorial');
 response=await moderation.POST(req('/api/editorial/entries/moderation',{...review,expectedUpdatedAt:item.updated_at,action:'hide',reason:'Event ended 2026-11-19; checked 2026-11-20'}));assert.equal(response.status,200);assert.equal((await response.json()).entry.moderation_status,'hidden');
 assert.equal((await pg.query("select count(*)::int n from organization_editorial_events where actor_user_id='admin' and action='publish'")).rows[0].n,0);
}));
test('invalid timestamps, an unverified image, and unpublished first-write shortcuts are rejected',()=>tx(async()=>{
 const o=await org();await grant(o);const payload=doc(o);
 for(const patch of [{startsAt:'2026-12-01'},{imageUrl:'https://example.org/photo.jpg'},{submit:true}])assert.ok((await entries.POST(req('/api/editorial/entries',{...payload,...patch}))).status>=400);
 assert.equal((await pg.query('select count(*)::int n from organization_entries')).rows[0].n,0);
}));
test('global pause and an unavailable rate limiter both fail closed',()=>tx(async()=>{
 const o=await org();await grant(o);process.env.CINEGENIUS_EDITORIAL_ENABLED='false';assert.equal((await entries.POST(req('/api/editorial/entries',doc(o)))).status,401);process.env.CINEGENIUS_EDITORIAL_ENABLED='true';rateAllowed=false;assert.equal((await entries.POST(req('/api/editorial/entries',doc(o)))).status,429);
}));

test('country-only editorial news is discoverable in Mexico without inventing a city or pin',()=>tx(async()=>{
 const o=await org();await grant(o);let response=await entries.POST(req('/api/editorial/entries',{...doc(o),countryCode:'MX',city:''}));assert.equal(response.status,200);const row=(await response.json()).entry;assert.equal(row.place_country_code,'MX');assert.equal(row.place_city_id,null);assert.equal(row.city,'');
 for(const countryCode of ['NOT_A_COUNTRY',42,{}]){response=await entries.POST(req('/api/editorial/entries',{...doc(o),countryCode}));assert.equal(response.status,400);}
}));
