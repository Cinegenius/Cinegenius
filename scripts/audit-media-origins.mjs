/** Read-only inventory. Never prints image URLs, member identifiers or keys. */
import {createClient} from '@supabase/supabase-js';
import {writeFileSync} from 'node:fs';
import {reviewedPrivateSource,cutoverPrivateMedia} from './lib/private-media-cutover.mjs';
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!origin||!secret)throw Error('Server-side database configuration required');
const db=createClient(origin,secret,{auth:{persistSession:false}});
async function rows(table,columns){const result=[];for(let from=0;;from+=500){const q=await db.from(table).select(columns).range(from,from+499);if(q.error)throw Error(`Inventory unavailable: ${table} (${q.error.code})`);result.push(...q.data);if(q.data.length<500)return result;}}
const [profiles,settings,companies,listings,projects,drafts,posts,equipment]=await Promise.all([
 rows('profiles','user_id,avatar_url,cover_image_url,profile_images,portfolio_images'),rows('user_settings','user_id,profile_visibility'),
 rows('companies','id,owner_user_id,published,logo_url,cover_url,portfolio_images'),
 rows('listings','id,user_id,company_id,published,image_url,extra_images,images,floor_plan_url,metadata'),
 rows('projects','id,created_by,poster_url,images,metadata'),rows('project_drafts','id,user_id,draft_data,published_project_id'),
 rows('community_posts','id,author_id,expires_at'),rows('company_equipment','id,company_id,images,published')]);
const privatePeople=new Set(settings.filter(s=>s.profile_visibility==='private').map(s=>s.user_id));
const companyMap=new Map(companies.map(c=>[c.id,c]));const assets=new Map();
function add(kind,id,owner,privateSource,values){
 for(const value of values.flat(Infinity)){const ref=typeof value==='string'?value:value?.url;if(typeof ref!=='string')continue;
 let url;try{url=new URL(ref);if(url.origin!==new URL(origin).origin||url.searchParams.has('token'))continue;}catch{continue;}
 const match=url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);if(!match)continue;
 const key=match[1]+'/'+decodeURIComponent(match[2]);const entry=assets.get(key)??{bucket:match[1],path:decodeURIComponent(match[2]),sources:[]};
 if(!entry.sources.some(s=>s.kind===kind&&s.id===id&&s.reference===ref))entry.sources.push({kind,id,owner,private:privateSource||value?.visibility==='private'||value?.public===false,reference:ref});assets.set(key,entry);
 }
}
for(const p of profiles)add('profile',p.user_id,p.user_id,privatePeople.has(p.user_id),[p.avatar_url,p.cover_image_url,p.profile_images??[],p.portfolio_images??[]]);
for(const c of companies)add('company',c.id,c.owner_user_id,!c.published,[c.logo_url,c.cover_url,c.portfolio_images??[]]);
for(const l of listings)add('listing',l.id,l.user_id||companyMap.get(l.company_id)?.owner_user_id,!l.published,[l.image_url,l.extra_images??[],l.images??[],l.floor_plan_url,...(l.metadata?.production_credits??[]).flatMap(c=>(c.image_urls??[]).map(url=>({url,visibility:c.visibility}))) ]);
for(const p of projects)add('project',p.id,p.created_by,false,[p.poster_url,p.images??[]]);
for(const d of drafts)if(!d.published_project_id)add('project_draft',d.id,d.user_id,true,[d.draft_data?.poster_url,d.draft_data?.images??[]]);
for(const b of posts)add('community_post',b.id,b.author_id,!!b.expires_at&&new Date(b.expires_at)<new Date(),[b.images??[]]);
for(const e of equipment)add('company_equipment',e.id,companyMap.get(e.company_id)?.owner_user_id,!e.published||!companyMap.get(e.company_id)?.published,[e.images??[]]);
const all=[...assets.values()];const privateAssets=all.filter(a=>a.sources.some(s=>s.private));
const summary={mode:process.argv.includes('--apply-private-cutover')?'pending-reviewed-private-cutover':'read-only',public_storage_objects_referenced:all.length,objects_with_private_source:privateAssets.length,private_objects_shared_with_public_source:privateAssets.filter(a=>a.sources.some(s=>!s.private)).length,private_objects_with_multiple_parents:privateAssets.filter(a=>new Set(a.sources.map(s=>s.kind+':'+s.id)).size>1).length,private_objects_without_controller:privateAssets.filter(a=>a.sources.some(s=>!s.owner)).length};
console.log(JSON.stringify(summary,null,2));
const planArg=process.argv.find(a=>a.startsWith('--private-plan='));if(planArg){const path=planArg.slice(15);if(!path.startsWith('/private/tmp/'))throw Error('Private plan must be stored under /private/tmp');writeFileSync(path,JSON.stringify({project:new URL(origin).hostname,created_at:new Date().toISOString(),summary,assets:privateAssets},null,2),{mode:0o600,flag:'wx'});console.log('Private review plan saved with owner-only filesystem permissions. No storage or database writes performed.');}

if(process.argv.includes('--apply-private-cutover')) {
 const project='wfxnoysluvnwarwuyfhn.supabase.co';
 const confirm=process.argv.find(value=>value.startsWith('--confirm-project='))?.slice(18);
 const expected=Number(process.argv.find(value=>value.startsWith('--expected-files='))?.slice(17));
 if(new URL(origin).hostname!==project||confirm!==project||!Number.isInteger(expected)||expected<1||expected>10)throw Error('Reviewed project and exact file count required; no writes performed');
 const journal=await db.from('media_assets').select('legacy_bucket,legacy_path,legacy_reference,source_type,source_id,owner_user_id,legacy_retired_at').not('legacy_bucket','is',null);
 if(journal.error)throw Error('Migration must be applied and verified before cutover');
 const reviewed=new Map(privateAssets.map(asset=>[asset.bucket+'/'+asset.path,asset]));
 for(const row of journal.data??[])if(!reviewed.has(row.legacy_bucket+'/'+row.legacy_path))reviewed.set(row.legacy_bucket+'/'+row.legacy_path,{bucket:row.legacy_bucket,path:row.legacy_path,sources:[{kind:row.source_type,id:row.source_id,owner:row.owner_user_id,private:true,reference:row.legacy_reference}]});
 if(reviewed.size!==expected)throw Error('Inventory changed; review the new count before applying');
 for(const asset of reviewed.values())reviewedPrivateSource(asset);
 let completed=0;
 for(const asset of reviewed.values()){await cutoverPrivateMedia(db,asset);completed++;console.log(`Verified private file ${completed}/${expected}; no member text changed.`);}
 console.log('Private cutover completed. Purge application data caches, verify original public addresses deny access, and verify owner views. Previously downloaded or CDN-cached public copies cannot be recalled.');
}
