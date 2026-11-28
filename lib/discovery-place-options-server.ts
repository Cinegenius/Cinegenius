import 'server-only';
import {db} from '@/lib/db';
import {PLACE_COLUMNS,countryCode,countryName} from '@/lib/places/core';
import {placeReadFields} from '@/lib/places/catalog';
import {projectProfilePrivacy} from '@/lib/profile-privacy';
import {publicListingIds} from '@/lib/profile-privacy-server';
import {createNativeDiscoveryProfileAccess} from '@/lib/native-discovery-profile-access';
import {isPeopleDirectoryProfile} from '@/lib/profile-provider-filters';
import {DISCOVERY_PLACE_AREAS,DISCOVERY_PLACE_SURFACES,type DiscoveryPlaceArea,type DiscoveryPlaceSurface,type DiscoveryCountryOption} from './discovery-place-options';

type Row=Record<string,unknown>;
type Page={data:unknown[]|null;error:unknown};
const PAGE_SIZE=200,MAX_PAGES=500;
/** Read through an empty keyset page. No short-page or partial-list success. */
async function eachPage(read:(after:string|null)=>PromiseLike<Page>,idKey:string,consume:(rows:Row[])=>Promise<void>,signal:AbortSignal){
 let after:string|null=null;const seen=new Set<string>();
 for(let n=0;n<MAX_PAGES;n++){
  signal.throwIfAborted();const result=await read(after);signal.throwIfAborted();
  if(result.error||!Array.isArray(result.data)||result.data.length>PAGE_SIZE)throw Error('place_inventory_unavailable');
  if(!result.data.length)return;
  const rows=result.data as Row[];let last:string|null=after;
  // Keep the database's ordering/cursor unchanged: its collation need not match
  // JavaScript codepoints. Replays/cycles are bounded by this source-local set.
  for(const row of rows){const id=row?.[idKey];if(typeof id!=='string'||!id||seen.has(id))throw Error('place_inventory_unavailable');seen.add(id);last=id;}
  if(last===after)throw Error('place_inventory_unavailable');
  await consume(rows);after=last;
 }
 throw Error('place_inventory_incomplete');
}
function directoryPerson(row:Row){
 return isPeopleDirectoryProfile({display_name:typeof row.display_name==='string'?row.display_name:null,role:typeof row.role==='string'?row.role:null,positions:Array.isArray(row.positions)?row.positions.filter((v):v is string=>typeof v==='string'):null,profile_types:Array.isArray(row.profile_types)?row.profile_types.filter((v):v is string=>typeof v==='string'):null,profile_type:typeof row.profile_type==='string'?row.profile_type:null,bio:typeof row.bio==='string'?row.bio:null,portfolio_images:Array.isArray(row.portfolio_images)?row.portfolio_images.filter((v):v is string=>typeof v==='string'):null});
}
/** Complete eligible country union for the exact caller-selected surface. */
export async function discoveryInventoryCountries(areas:readonly DiscoveryPlaceArea[],locale:string,viewerId:string|null,requestSignal:AbortSignal,surface:DiscoveryPlaceSurface):Promise<DiscoveryCountryOption[]>{
 if(!DISCOVERY_PLACE_SURFACES.includes(surface)||areas.some(area=>!DISCOVERY_PLACE_AREAS.includes(area)))throw Error('place_inventory_invalid');
 const selected=new Set(areas),countries=new Set<string>(),directoryOwners=new Set<string>();
 const signal=AbortSignal.any([requestSignal,AbortSignal.timeout(8000)]),access=createNativeDiscoveryProfileAccess(viewerId,signal);
 const rowCountry=(row:Row,legacy:string)=>countryCode(String(placeReadFields(legacy,row,locale).place_country_code??''));
 const add=(row:Row,legacy:string)=>{const code=rowCountry(row,legacy);if(code)countries.add(code);};
 if(selected.has('crew')){
  if(surface==='directory'){
   // SSR suppresses legacy fallback for its initial96 raw named profiles even
   // before the people predicate. Later profile pages suppress only returned
   // people-qualified profiles. Preserve that exact settled-directory union.
   const initial=await db.from('profiles').select('user_id').not('display_name','is',null).neq('display_name','').order('display_name').order('user_id').limit(96).abortSignal(signal);
   signal.throwIfAborted();if(initial.error||!Array.isArray(initial.data)||initial.data.length>96||initial.data.some(row=>typeof row.user_id!=='string'||!row.user_id))throw Error('place_inventory_unavailable');
   for(const row of initial.data)directoryOwners.add(String(row.user_id));
  }
  const qualifications=surface==='directory'?',role,positions,profile_type,profile_types,bio,portfolio_images':'';
  await eachPage(after=>{let q=db.from('profiles').select(`${PLACE_COLUMNS},user_id,display_name,location${qualifications}`).not('display_name','is',null).neq('display_name','').order('user_id').range(0,PAGE_SIZE-1);if(after)q=q.gt('user_id',after);return q.abortSignal(signal);},'user_id',async rows=>{
   const privacy=await access(rows.map(row=>String(row.user_id)));
   for(const raw of rows){const person=surface==='directory'&&directoryPerson(raw);if(person)directoryOwners.add(String(raw.user_id));const allowed=privacy.get(String(raw.user_id));if(!allowed?.profile||!allowed.location)continue;const row=projectProfilePrivacy(raw,allowed);if(surface==='smart'||person)add(row,String(row.location??''));}
  },signal);
 }
 // All non-creator offers retain the canonical privacy/publication view.
 const types=[...(selected.has('marketplace')?['prop','vehicle']:[]),...(selected.has('locations')?['location']:[]),...(selected.has('jobs')?['job']:[])];
 if(types.length){
  await eachPage(after=>{let q=db.from('privacy_visible_listings').select(`${PLACE_COLUMNS},id,type,city`).eq('published',true).in('type',types).order('id').range(0,PAGE_SIZE-1);if(after)q=q.gt('id',after);return q.abortSignal(signal);},'id',async rows=>{for(const row of rows)add(row,String(row.city??''));},signal);
 }
 if(selected.has('crew')&&surface==='directory'){
  // Match the existing directory's candidate set exactly: newest300 published
  // creator rows, then current privacy-view IDs, then owner-aware permissions.
  // This does not broaden the result query or bypass Ghost for the uploader.
  const result=await db.from('listings').select(`${PLACE_COLUMNS},id,user_id,city,created_at`).eq('published',true).eq('type','creator').order('created_at',{ascending:false}).limit(300).abortSignal(signal);
  signal.throwIfAborted();if(result.error||!Array.isArray(result.data)||result.data.length>300)throw Error('place_inventory_unavailable');
  const candidates=result.data as Row[];
  if(candidates.some(row=>typeof row.id!=='string'||!row.id))throw Error('place_inventory_unavailable');
  const visible=await publicListingIds(candidates.map(row=>String(row.id))),rows=candidates.filter(row=>visible.has(String(row.id)));
  const privacy=await access(rows.map(row=>String(row.user_id??''))),seenOwners=new Set<string>();
  for(const raw of rows){const owner=typeof raw.user_id==='string'?raw.user_id:'',allowed=privacy.get(owner);
   if(!owner||!allowed?.profile||directoryOwners.has(owner)||seenOwners.has(owner))continue;
   seenOwners.add(owner);if(!allowed.location)continue;const row=projectProfilePrivacy(raw,allowed);add(row,String(row.city??''));
  }
 }
 if(selected.has('companies')){
  await eachPage(after=>{let q=db.from('companies').select(`${PLACE_COLUMNS},id,city`).eq('published',true).order('id').range(0,PAGE_SIZE-1);if(after)q=q.gt('id',after);return q.abortSignal(signal);},'id',async rows=>{for(const row of rows)add(row,String(row.city??''));},signal);
 }
 signal.throwIfAborted();const collator=new Intl.Collator(locale,{sensitivity:'base'});
 return[...countries].map(id=>({id,name:countryName(id,locale)})).sort((a,b)=>collator.compare(a.name,b.name)||a.id.localeCompare(b.id));
}
