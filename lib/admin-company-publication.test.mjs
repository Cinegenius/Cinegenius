import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {NextResponse} from 'next/server.js';
import * as reviewModel from './admin-review.ts';
const require=createRequire(import.meta.url),id='10000000-0000-4000-8000-000000000001';
function load(file,mocks){const c=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',c)(n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),m,m.exports);return m.exports;}
class ReviewError extends Error{constructor(code,status){super(code);this.code=code;this.status=status}}
function fixture({authorized=true,sql='saved',rpcError=false,foreignContact=false,mediaError=null,cacheError=false,ownerExists=true}={}){
 const calls={rpc:[],account:0,media:0};const review={admin:{userId:'own-admin'},kind:'company',id,record:{id,owner_user_id:'own-member',slug:'own-firm',published:false,responsible_person:foreignContact?{userId:'former-member'}:null},providerProfile:null,images:['own-reference'],dto:{revision:'a'.repeat(64),canPublish:true,issues:[],provider:{userId:'own-member'},publicHref:'/companies/own-firm'}};
 const mocks={'server-only':{},'next-intl/server':{getTranslations:async()=>key=>key},'next/cache':{revalidatePath(){if(cacheError)throw Error('cache')},revalidateTag(){}},'@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async()=>{calls.account++;if(!ownerExists)throw Error('not found');return{id:'own-member'}}}})},'@/lib/db':{db:{rpc:async(name,params)=>{calls.rpc.push({name,params});return{data:sql,error:rpcError?{code:'missing-function'}:null}}}},'@/lib/admin-review':reviewModel,'@/lib/admin-review-server':{loadAdminReview:async()=>{if(!authorized)throw new ReviewError('forbidden',403);return review},REVIEW_HEADERS:{'Cache-Control':'private, no-store'},ReviewError},'@/lib/admin-review-media':{readReviewImage:async()=>{calls.media++;if(mediaError)throw new ReviewError(mediaError,mediaError==='mediaError'?404:403);return new Uint8Array([1])}},'@/lib/responsible-person-server':{responsibleForCompany:async()=>null}};
 return{...load('./admin-company-publication.ts',mocks),calls,review,body:{action:'approve',revision:'a'.repeat(64)}};
}
test('company approval requires admin and the exact reviewed version before owner/media/transaction work',async()=>{
 const denied=fixture({authorized:false});assert.equal((await denied.publishReviewedCompany(id,denied.body)).status,403);assert.equal(denied.calls.account,0);assert.equal(denied.calls.rpc.length,0);
 for(const body of [{action:'hide',revision:'a'.repeat(64)},{action:'approve'}, {action:'approve',revision:'b'.repeat(64)}]){const f=fixture();assert.ok([400,409].includes((await f.publishReviewedCompany(id,body)).status));assert.equal(f.calls.account,0);assert.equal(f.calls.rpc.length,0)}
});
test('company publication preserves owner identity, checks canonical media and uses the server actor and default audit reason',async()=>{
 const f=fixture();const response=await f.publishReviewedCompany(id,f.body);assert.equal(response.status,200);assert.equal(f.calls.account,1);assert.equal(f.calls.media,1);assert.equal(f.calls.rpc[0].name,'admin_review_company_publication');assert.equal(f.calls.rpc[0].params.p_actor,'own-admin');assert.equal(f.calls.rpc[0].params.p_expected.owner_user_id,'own-member');assert.equal(f.calls.rpc[0].params.p_reason,'approvalReasonDefault');assert.match(response.headers.get('cache-control'),/no-store/);
 for(const options of [{foreignContact:true},{mediaError:'sourceMismatch'},{ownerExists:false},{rpcError:true}]){const f=fixture(options);assert.notEqual((await f.publishReviewedCompany(id,f.body)).status,200);if(!options.rpcError)assert.equal(f.calls.rpc.length,0)}
 const advisory=fixture({mediaError:'mediaError',cacheError:true});const result=await (await advisory.publishReviewedCompany(id,advisory.body)).json();assert.equal(result.success,true);assert.equal(result.cacheRefreshed,false);assert.deepEqual(result.warnings,['mediaUnavailable']);
 const stale=fixture({sql:'stale'});assert.equal((await stale.publishReviewedCompany(id,stale.body)).status,409);
});
test('company review route delegates only explicit authorized company approvals, never ordinary members',async()=>{
 for(const allowed of [true,false]){let calls=0;const route=load('../app/api/admin/reviews/[kind]/[id]/route.ts',{'@/lib/auth':{requireAdmin:async()=>allowed?{userId:'own-admin'}:NextResponse.json({error:'Forbidden'},{status:403})},'@/lib/admin-review-server':{},'@/lib/admin-review-release':{},'@/lib/admin-company-publication':{publishReviewedCompany:async()=>{calls++;return NextResponse.json({success:true})}},'next-intl/server':{getTranslations:async()=>key=>key}});const response=await route.POST({json:async()=>({action:'approve'})},{params:Promise.resolve({kind:'company',id})});assert.equal(response.status,allowed?200:403);assert.equal(calls,allowed?1:0)}
});
test('company review transaction is service-only, checks the whole row and owner snapshot, audits atomically and never bulk-publishes',async()=>{
 const pg=new PGlite();try{
 await pg.exec(`create role anon;create role authenticated;create role service_role;create table companies(id uuid primary key,owner_user_id text,name text,slug text,published boolean default false,updated_at timestamptz);create table profiles(user_id text primary key,display_name text);create table admin_audit_log(actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);insert into companies values('${id}','own-member','Own test company','own-firm',false,now()),('10000000-0000-4000-8000-000000000002','another-member','Other private company','other',false,now());`);
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261031150000_admin_company_review_publication.sql',import.meta.url),'utf8'));
 const initial=(await pg.query('select to_jsonb(c) as record from companies c where id=$1',[id])).rows[0].record;
 const run=expected=>pg.query('select admin_review_company_publication($1,$2::jsonb,$3::jsonb,$4,$5) result',[id,JSON.stringify(expected),null,'own-admin','Reviewed own company']);
 for(const role of ['anon','authenticated']){await pg.exec('set role '+role);await assert.rejects(run(initial),e=>e.code==='42501');await pg.exec('reset role')}
 assert.equal((await run({...initial,name:'changed'})).rows[0].result,'stale');assert.equal((await pg.query('select count(*)::int n from admin_audit_log')).rows[0].n,0);
 await pg.exec(`insert into profiles values('own-member','Own person')`);assert.equal((await run(initial)).rows[0].result,'stale');await pg.exec('delete from profiles');
 assert.equal((await run(initial)).rows[0].result,'saved');assert.equal((await pg.query('select count(*)::int n from companies where published')).rows[0].n,1);assert.equal((await pg.query('select count(*)::int n from admin_audit_log')).rows[0].n,1);
 const current=(await pg.query('select to_jsonb(c) as record from companies c where id=$1',[id])).rows[0].record;assert.equal((await run(current)).rows[0].result,'unchanged');assert.equal((await pg.query('select count(*)::int n from admin_audit_log')).rows[0].n,1);
 await pg.exec(`update companies set published=false where id='${id}';alter table admin_audit_log add constraint audit_failure check(reason='never') not valid`);const before=(await pg.query('select to_jsonb(c) as record from companies c where id=$1',[id])).rows[0].record;await assert.rejects(run(before));assert.equal((await pg.query('select published from companies where id=$1',[id])).rows[0].published,false);
 }finally{await pg.close()}
});
