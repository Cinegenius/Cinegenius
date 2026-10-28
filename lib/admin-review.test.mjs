import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextResponse} from 'next/server.js';
import sharp from 'sharp';
import * as model from './admin-review.ts';
import * as mediaPaths from './protected-media.ts';
import * as responsible from './responsible-person.ts';
const require=createRequire(import.meta.url);
const id='10000000-0000-4000-8000-000000000001';
const key='own-member/'+ 'a'.repeat(32)+'.webp',reference='/api/media/'+key;
function load(file,mocks){const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const m={exports:{}};new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),m,m.exports);return m.exports;}
function fixture({authorized=true,error=false,missing=false,record:custom}={}){
 const calls={read:[],writes:0};
 const listing=custom??{id,user_id:'own-member',type:'location',title:'Own studio',description:'Complete own test description',city:'Test city',category:'studio',moderation_status:'pending',content_revision:1,published:false,image_url:reference,extra_images:[reference+'?v=2','https://test.supabase.co/storage/v1/object/public/images/second.jpg'],metadata:{rooms:['Studio','Dressing room'],onboarding_request_key:'do-not-project'},responsible_person:{firstName:'Alex',lastName:'Beispiel',userId:'own-member',public:false}};
 const db={from(table){let lookup;const q={select(){calls.read.push(table);return q},order(){return q},limit(){return Promise.resolve({data:[],error:null})},eq(_key,value){lookup=value;return q},maybeSingle:async()=>({error:error?{code:'DB_ERROR'}:null,data:missing?null:table==='profiles'?{user_id:lookup,display_name:'Own member',email:'private@example.invalid'}:listing})};return q;}};
 const server=load('./admin-review-server.ts',{'server-only':{},'@/lib/db':{db},'@/lib/auth':{requireAdmin:async()=>authorized?{userId:'own-admin'}:NextResponse.json({error:'Forbidden'},{status:403})},'@/lib/admin-review':model,'@/lib/listing-routes':{listingDetailPath:(_type,id)=>'/locations/'+id},'@/lib/responsible-person':responsible});
 return{...server,calls,listing};
}
test('review source allowlist excludes messages, support files, arbitrary tables and prototype names',()=>{
 for(const name of ['messages','support','attachments','../../profiles','__proto__','constructor'])assert.equal(model.reviewKind(name),null);
 assert.equal(Object.keys(model.REVIEW_SOURCES).length,7);
 assert.equal(model.reportReviewPath('message',id),null);
 assert.equal(model.reportReviewPath('listing',id),'/admin/review/listing/'+id);
});
test('the complete ordered gallery keeps twenty images and changes after reorder; setup identifiers are not projected',()=>{
 const images=Array.from({length:20},(_,i)=>'https://test.invalid/'+i+'.jpg');
 assert.deepEqual(model.reviewImages('listing',{image_url:images[0],extra_images:images.slice(1)}),images);
 assert.deepEqual(model.reviewImages('company',{logo_url:images[0],cover_url:images[1],portfolio_images:images.slice(2)}),images);
 assert.deepEqual(model.reviewImages('project_draft',{draft_data:{poster_url:images[0],images:images.slice(1)}}),images);
 const fields=model.reviewFields('listing',{description:'Long complete description',metadata:{rooms:4,onboarding_request_key:'private-identifier',session_token:'secret'}});
 assert.equal(fields[0].value,'Long complete description');assert.deepEqual(fields[1].value,{rooms:4});
});
test('authorized review loads private drafts without changing them; only a safe DTO reaches the browser',async()=>{
 const f=fixture();const before=JSON.stringify(f.listing);const result=await f.loadAdminReview('listing',id);
 assert.equal(result.dto.published,false);assert.equal(result.dto.canPublish,true);assert.equal(result.dto.provider.userId,'own-member');assert.equal(result.dto.responsible.public,false);assert.equal(result.dto.images.length,3);
 assert.ok(result.dto.images.every(image=>image.src.startsWith('/api/admin/reviews/listing/'+id+'/media?index=')));
 assert.doesNotMatch(JSON.stringify(result.dto),/private@example|do-not-project|own-member\/[a-f0-9]{32}/);
 assert.equal(JSON.stringify(f.listing),before);assert.equal(f.calls.writes,0);
 assert.equal(f.reviewRevision({b:2,a:1}),f.reviewRevision({a:1,b:2}));
 assert.notEqual(f.reviewRevision(result.record),f.reviewRevision({...result.record,description:'Changed without updating timestamp'}));
});
test('unauthorized previews and invalid review sources do not read the database',async()=>{
 const blocked=fixture({authorized:false});await assert.rejects(()=>blocked.loadAdminReview('listing',id),e=>e.status===403);assert.deepEqual(blocked.calls.read,[]);
 const f=fixture();await assert.rejects(()=>f.loadAdminReview('messages',id),e=>e.status===404);await assert.rejects(()=>f.loadAdminReview('listing','not-a-uuid'),e=>e.status===404);assert.deepEqual(f.calls.read,[]);
});
test('technical database failures remain service errors, not false 404s',async()=>{
 await assert.rejects(()=>fixture({error:true}).loadAdminReview('listing',id),e=>e.status===503);
 await assert.rejects(()=>fixture({missing:true}).loadAdminReview('listing',id),e=>e.status===404);
});
test('company providers never fall back to the technical submitting administrator',async()=>{
 const f=fixture({record:{id,company_id:id,user_id:'own-admin',title:'Company offer',type:'prop',published:false}});
 const result=await f.loadAdminReview('listing',id);assert.notEqual(result.dto.provider.userId,'own-admin');assert.equal(result.dto.technicalCreator,'own-admin');assert.ok(result.dto.issues.includes('provider'));
});
function mediaFixture({source='listing',sourceId=id,exists=true,bucketPublic=true}={}){
 const f=fixture(),calls={download:0};let image;
 const db={from(){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{source_type:source,source_id:sourceId,storage_path:key,reference_url:reference},error:null})};return q},storage:{getBucket:async()=>({data:{public:bucketPublic}}),from:()=>({download:async()=>{calls.download++;return{data:exists?new Blob([await image]):null,error:exists?null:{code:'404'}}}})}};
 const media=load('./admin-review-media.ts',{'server-only':{},'@/lib/db':{db},'@/lib/protected-media':mediaPaths,'@/lib/admin-review-server':f});
 return{...media,calls,review:{kind:'listing',id,images:[reference]},prepare:async()=>{image=sharp({create:{width:100,height:200,channels:3,background:'#aabbcc'}}).png().toBuffer();await image}};
}
test('admin media serves only the current canonical parent and preserves portrait proportions',async()=>{
 const f=mediaFixture();await f.prepare();const bytes=await f.readReviewImage(f.review,0,50);const meta=await sharp(bytes).metadata();assert.equal(meta.width,25);assert.equal(meta.height,50);assert.equal(meta.format,'webp');assert.equal(f.calls.download,1);
});
test('a protected image mirrored from another source is denied even inside an admin review',async()=>{
 for(const source of ['profile','project_draft','support','messages']){const f=mediaFixture({source});await assert.rejects(()=>f.readReviewImage(f.review,0),e=>e.code==='sourceMismatch');assert.equal(f.calls.download,0);}
 const f=mediaFixture({sourceId:'another-parent'});await assert.rejects(()=>f.readReviewImage(f.review,0),e=>e.status===403);assert.equal(f.calls.download,0);
});
test('missing originals remain visible errors and private/signed legacy URLs are not an arbitrary proxy',async()=>{
 const missing=mediaFixture({exists:false});await assert.rejects(()=>missing.readReviewImage(missing.review,0),e=>e.code==='mediaError');
 const f=mediaFixture();for(const url of ['https://example.invalid/photo.jpg','https://img.clerk.com.evil.invalid/picture','https://test.supabase.co/storage/v1/object/sign/private/file?token=secret','file:///private/photo'])await assert.rejects(()=>f.readReviewImage({...f.review,images:[url]},0),e=>e.status===403);
 assert.equal(f.calls.download,0);
});
function releaseFixture({changed=false,sql='saved',mediaFails=false}={}){
 const f=fixture();const calls={rpc:[],media:0};const reviewPromise=f.loadAdminReview('listing',id);
 const api=load('./admin-review-release.ts',{'server-only':{},'next-intl/server':{getTranslations:async()=>key=>key},'next/cache':{revalidatePath(){},revalidateTag(){}},'@/lib/db':{db:{rpc:async(name,params)=>{calls.rpc.push({name,params});return{data:sql,error:null}}}},'@/lib/admin-review-server':{...f,loadAdminReview:async()=>{const r=await reviewPromise;return {...r,dto:{...r.dto,revision:changed?'b'.repeat(64):r.dto.revision}}}},'@/lib/admin-audit':{validateAdminReason:r=>typeof r==='string'&&r.trim().length>=5?r:null},'@/lib/listing-provider':{getListingProvider:async()=>({kind:'person',contactUserId:'own-member'})},'@/lib/responsible-person-server':{responsibleForCompany:async()=>null},'@/lib/listing-publication':{validateListingPublication:()=>null},'@/lib/admin-review-media':{readReviewImage:async()=>{calls.media++;if(mediaFails)throw Error('missing');return new Uint8Array([1])}}});
 return{...api,calls,body:async()=>({revision:(await reviewPromise).dto.revision,published:true,reason:'Own reviewed test'})};
}
test('release requires a reviewed revision; stale content and missing media cannot be published',async()=>{
 const missing=releaseFixture();assert.equal((await missing.releaseReviewedListing(id,{published:true,reason:'Reason'})).status,400);assert.equal(missing.calls.rpc.length,0);
 const stale=releaseFixture({changed:true});assert.equal((await stale.releaseReviewedListing(id,await stale.body())).status,409);assert.equal(stale.calls.rpc.length,0);
 const media=releaseFixture({mediaFails:true});assert.equal((await media.releaseReviewedListing(id,await media.body())).status,422);assert.equal(media.calls.rpc.length,0);
});
test('release verifies photos then delegates exact server records and actor to the atomic transaction',async()=>{
 const f=releaseFixture();const response=await f.releaseReviewedListing(id,await f.body());assert.equal(response.status,200);assert.equal(f.calls.rpc.length,1);assert.equal(f.calls.media,3);assert.equal(f.calls.rpc[0].params.p_actor,'own-admin');assert.equal(f.calls.rpc[0].params.p_expected.published,false);assert.match(response.headers.get('cache-control'),/no-store/);
 const stale=releaseFixture({sql:'stale'});assert.equal((await stale.releaseReviewedListing(id,await stale.body())).status,409);
});
test('permission-aware admin media cannot enter the shared image optimizer',()=>{
 for(const path of ['/api/admin/reviews/listing/'+id+'/media?index=0','/api/media/'+key])assert.equal(mediaPaths.isProtectedMediaOptimizerSource(path,'https://fixture.invalid'),true);
});
test('media routes recheck authentication and reject outdated photo identities before reading any file',async()=>{
 const f=fixture();const current={kind:'listing',id,images:[reference],record:{}};let reads=0;
 const route=load('../app/api/admin/reviews/[kind]/[id]/media/route.ts',{'@/lib/admin-review-server':{...f,loadReviewSource:async()=>current},'@/lib/admin-review-media':{readReviewImage:async()=>{reads++;return new Uint8Array([1,2])}}});
 const context={params:Promise.resolve({kind:'listing',id})};
 let response=await route.GET({nextUrl:new URL('https://fixture.invalid/media?index=0&ref=stale')},context);assert.equal(response.status,409);assert.equal(reads,0);
 response=await route.GET({nextUrl:new URL('https://fixture.invalid/media?index=0&ref='+f.reviewRevision(reference))},context);assert.equal(response.status,200);assert.equal(reads,1);for(const header of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert.match(response.headers.get(header),/no-store/);assert.match(response.headers.get('x-robots-tag'),/noindex/);
 const denied=load('../app/api/admin/reviews/[kind]/[id]/media/route.ts',{'@/lib/admin-review-server':{...f,loadReviewSource:async()=>{throw new f.ReviewError('forbidden',403)}},'@/lib/admin-review-media':{readReviewImage:async()=>{reads++;return new Uint8Array([1])}}});
 assert.equal((await denied.GET({nextUrl:new URL('https://fixture.invalid/media?index=0')},context)).status,403);assert.equal(reads,1);
});
test('rendered review thumbnails bypass shared optimization and retain the checked photo identity',()=>{
 const component=load('../components/MediaImage.tsx',{'next/image':{default:()=>null},'@/lib/protected-media':mediaPaths}).default;
 const source='/api/admin/reviews/listing/'+id+'/media?index=2&ref='+'a'.repeat(64);
 const rendered=component({src:source,alt:'Own photo',fill:true,mediaSize:'thumbnail'});
 const url=new URL(rendered.props.src,'https://fixture.invalid');assert.equal(url.searchParams.get('index'),'2');assert.equal(url.searchParams.get('ref'),'a'.repeat(64));assert.equal(url.searchParams.get('size'),'thumbnail');assert.equal(rendered.props.unoptimized,true);assert.equal('mediaSize' in rendered.props,false);
 const original=component({src:reference,alt:'Own photo',width:1600,height:1200});assert.match(original.props.src,/size=detail$/);assert.equal(original.props.unoptimized,true);
});
