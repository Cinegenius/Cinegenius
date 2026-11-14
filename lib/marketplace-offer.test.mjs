import { listingBrowseDependencies } from './test-fixtures/listing-browse.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import * as catalog from './marketplaceCategories.ts';
import * as model from './marketplace-offer.ts';
import * as pricing from './listing-price.ts';
import * as gallery from './listing-image-gallery.ts';
import * as responsible from './responsible-person.ts';
import * as moderation from './offer-moderation.ts';
const require=createRequire(import.meta.url);
const samples=['licht-quellen','licht-signal','kostuem-staender','maske-stuehle','grip-dolly','ton-mikrofone','catering-kuechen','fahrzeuge-bild'];
const makeDraft=category=>{const draft=model.marketplaceDraft(category);draft.values={...draft.values,mode:'both',rent_price:'125.5',sale_price:'1200',rent_mode:'fixed',sale_mode:'negotiable',unit:'week',quantity:'2',included:'Own complete kit',condition:'Own test condition'};return draft;};
const dictionaries=Object.fromEntries(['de','en','es','it','cs','hu','nl','nl-BE','sv'].map(locale=>[locale,JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'))]));
const translate=(locale,namespace)=>key=>key.split('.').reduce((value,part)=>value?.[part],dictionaries[locale][namespace])??key;
test('14 departments share unique stable subcategories; every choice resolves once and all nine translations exist',()=>{
 assert.equal(catalog.DEPARTMENTS.length,14);const ids=catalog.DEPARTMENTS.flatMap(d=>d.groups.map(g=>g.id));assert.equal(ids.length,new Set(ids).size);
 for(const d of catalog.DEPARTMENTS)for(const g of d.groups){assert.deepEqual(catalog.marketplaceCategory(g.id),{department:d.id,subcategory:g.id});assert.ok(catalog.deptValues(d).includes(g.id));assert.ok(catalog.groupValues(g).includes(g.id));for(const locale of Object.keys(dictionaries)){assert.ok(dictionaries[locale].MarketplaceCatalog.categories[d.id]);assert.ok(dictionaries[locale].MarketplaceCatalog.subcategories[g.id]);}}
});
test('exact legacy aliases preserve meaning without title guesses; ambiguous legacy values remain unclassified',()=>{
 assert.equal(catalog.marketplaceCategory('Lichttechnik').department,'licht');assert.equal(catalog.marketplaceCategory('generator').department,'strom');assert.equal(catalog.marketplaceCategory('wireless-video').department,'video');
 assert.equal(catalog.marketplaceCategory('virtual-production').department,'studio');assert.equal(catalog.marketplaceCategory('Unclear legacy offering'),null);assert.equal(catalog.marketplaceCategory('fahrzeuge-bild','prop'),null);
 assert.equal(catalog.marketplaceMatches('generator','licht'),false);assert.equal(catalog.marketplaceMatches('generator','strom','strom-generatoren','prop'),true);
});
test('search synonyms resolve to the same subcategories, including German and English category terms',()=>{
 for(const [query,category]of [['DMX','licht-signal'],['Lichtpult','licht-steuerung'],['Garderobenständer','kostuem-staender'],['Maskenstuhl','maske-stuehle']])assert.ok(catalog.marketplaceSearchCategories(query).includes(category),query);
 assert.ok(catalog.marketplaceSearchCategories('lighting',translate('en','MarketplaceCatalog')).includes('licht-quellen'));
});
for(const category of samples)test(`${category}: draft and complete data survive JSON persistence, with only relevant optional specifications`,()=>{
 const draft=makeDraft(category),field=model.marketplaceSpecFields(category)[0];if(field)draft.specsByCategory[category]={[field]:'Own technical value'};
 const envelope=model.serializeMarketplaceDraft(draft);assert.equal(model.validateMarketplaceOffer(category,category.startsWith('fahrzeuge-')?'vehicle':'prop',envelope),null);
 const metadata=model.marketplaceMetadataPatch(draft),persisted=JSON.parse(JSON.stringify(metadata));const reloaded=model.marketplaceDraft(category,model.marketplaceBasePrice(draft),persisted);
 assert.deepEqual(model.serializeMarketplaceDraft(reloaded),envelope);assert.match(pricing.listingPriceLabel(125.5,persisted),/125,5 €\/Woche/);assert.match(pricing.listingPriceLabel(125.5,persisted),/1\.200 € VB/);
 const changed={...draft,category:'maske-stuehle'};assert.ok(Object.keys(model.serializeMarketplaceDraft(changed).specs).every(key=>model.marketplaceSpecFields('maske-stuehle').includes(key)));assert.deepEqual(changed.specsByCategory[category],draft.specsByCategory[category]);
});
test('sale, rental and both, every unit, amount-free VB and locale numbers stay distinct',()=>{
 for(const mode of ['rent','sale','both'])for(const unit of ['hour','day','week','month','project']){const draft=makeDraft('licht-quellen');Object.assign(draft.values,{mode,unit});assert.equal(model.validateMarketplaceOffer(draft.category,'prop',model.serializeMarketplaceDraft(draft)),null);const label=pricing.listingPriceLabel(1,model.marketplaceMetadataPatch(draft),'/Tag','en',translate('en','MarketplaceOffer'));assert.doesNotMatch(label,/(^|\s)0 €/);if(mode==='both')assert.match(label,/Rental:.*Sale:/);}
 const vb=makeDraft('licht-quellen');Object.assign(vb.values,{mode:'rent',rent_mode:'negotiable',rent_price:''});assert.equal(pricing.listingPriceLabel(0,model.marketplaceMetadataPatch(vb)),'VB');
 vb.values.rent_mode='request';assert.equal(pricing.listingPriceLabel(125,model.marketplaceMetadataPatch(vb)),'Preis auf Anfrage');
});
test('invalid category/type, price, unsafe details and incompatible specifications are rejected',()=>{
 const offer=model.serializeMarketplaceDraft(makeDraft('licht-signal'));
 for(const value of [{...offer,rent_price:-5},{...offer,rent_price:null},{...offer,mode:'admin'},{...offer,unit:'unknown'},{...offer,specs:{unrelated:'leak'}},{...offer,quantity:'-1'},{...offer,deposit:'NaN'},{...offer,fulfilment:['pickup','pickup']},{...offer,public:true}])assert.ok(model.validateMarketplaceOffer('licht-signal','prop',value));
 assert.ok(model.validateMarketplaceOffer('licht','prop',offer));assert.ok(model.validateMarketplaceOffer('licht-signal','vehicle',offer));assert.equal(model.validateMarketplaceOffer('Unclear old data','prop',undefined),null);
});
function fixture({locale='de'}={}){
 let user='own-provider',profile=true,restricted=false;const rows=new Map(),writes=[];
 const split=text=>{let depth=0,quoted=false,out=[],start=0;for(let i=0;i<text.length;i++){if(text[i]==='"')quoted=!quoted;if(!quoted){if(text[i]==='(')depth++;if(text[i]===')')depth--;if(text[i]===','&&depth===0){out.push(text.slice(start,i));start=i+1;}}}return [...out,text.slice(start)];};
 const match=(row,expression)=>{if(expression.startsWith('and('))return split(expression.slice(4,-1)).every(value=>match(row,value));const m=expression.match(/^(.*?)\.(eq|is|in|ilike)\.(.*)$/);if(!m)throw Error('Unexpected filter '+expression);const [,key,op,value]=m;const actual=key.startsWith('metadata->>')?row.metadata?.[key.slice(11)]:row[key];if(op==='eq')return String(actual)===value;if(op==='is')return actual==null;if(op==='in')return split(value.slice(1,-1)).map(x=>x.replace(/^"|"$/g,'')).includes(String(actual));return String(actual??'').toLowerCase().includes(value.replaceAll('%','').toLowerCase());};
 const db={from(){let predicates=[],orders=[],range=null,pending=null,count=false;const q={select(_cols,options){count=options?.count==='exact';return q;},eq(key,value){predicates.push(row=>row[key]===value);return q;},in(key,values){predicates.push(row=>values.includes(row[key]));return q;},contains(key,value){predicates.push(row=>Object.entries(value).every(([k,v])=>row[key]?.[k]===v));return q;},or(expression){predicates.push(row=>split(expression).some(value=>match(row,value)));return q;},order(key,options={ascending:true}){orders.push([key,options.ascending]);return q;},range(from,to){range=[from,to];return q;},limit(n){range=[0,n-1];return q;},insert(data){pending=['insert',data];return q;},update(data){pending=['update',data];return q;},maybeSingle(){return Promise.resolve(run(true));},single(){return Promise.resolve(run(true));},then(resolve,reject){return Promise.resolve().then(()=>run(false)).then(resolve,reject);}};
 function run(single){let data=[...rows.values()].filter(row=>predicates.every(predicate=>predicate(row)));if(pending){const [action,changes]=pending;if(action==='insert')data=[{id:`own-${rows.size+1}`,created_at:new Date().toISOString(),...changes}];else data=data.map(row=>({...row,...changes}));for(const row of data){rows.set(row.id,row);writes.push(row);}}for(const [key,ascending]of orders.toReversed())data.sort((a,b)=>(a[key]>b[key]?1:a[key]<b[key]?-1:0)*(ascending?1:-1));const total=data.length;if(range)data=data.slice(range[0],range[1]+1);return {data:single?data[0]??null:data,error:null,...(count?{count:total}:{})};}return q;}};
 const mocks={...listingBrowseDependencies,'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>user?{userId:user}:NextResponse.json({error:'unauthorized'},{status:401})},'@/lib/listing-access':{canEditListing:async(id,row)=>row.user_id===id,editableCompanyIdsForUser:async()=>[]},'@/lib/responsible-person':responsible,'@/lib/responsible-person-server':{validateMarketplaceResponsiblePerson:async()=>({person:{userId:user,firstName:'Own',lastName:'Provider'}}),validateResponsiblePerson:async()=>({person:{userId:user}}),accountResponsiblePerson:async()=>({firstName:'Own',lastName:'Provider'})},'@/lib/marketplace-offer':model,'@/lib/marketplaceCategories':catalog,'@/lib/listing-price':pricing,'@/lib/listing-image-gallery':gallery,'@/lib/offer-moderation':moderation,'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},'next/cache':{revalidatePath(){},revalidateTag(){}},'next-intl/server':{getLocale:async()=> locale,getTranslations:async ns=>translate(locale,ns)},'@/lib/marketplace-publication-server':{publishMarketplaceOffer:async row=>{if(restricted)return {outcome:'restricted',row,error:'restricted'};if(!profile)return {outcome:'profile_required',row,error:'profile_required'};const saved={...row,published:true,moderation_status:'owner_published'};rows.set(row.id,saved);return {outcome:'published',row:saved};}}};
 function load(file){const output=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('require','module','exports',output)(name=>mocks[name]??require(name),mod,mod.exports);return mod.exports;}
 const create=load('../app/api/listings/route.ts'),edit=load('../app/api/listings/[id]/route.ts');
 const request=(path,method='GET',body)=>new NextRequest('https://own-test.invalid'+path,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
 return {rows,writes,setUser:value=>user=value,setProfile:value=>profile=value,setRestricted:value=>restricted=value,
 create:body=>create.POST(request('/api/listings','POST',body)),read:query=>create.GET(request('/api/listings?'+query)),edit:(id,body)=>edit.PATCH(request('/api/listings/'+id,'PATCH',body),{params:Promise.resolve({id})})};
}
for(const category of samples)test(`${category}: actual create/read/edit routes preserve provider, gallery and pricing; guest and foreign edits fail`,async()=>{
 const f=fixture(),draft=makeDraft(category),images=Array.from({length:10},(_,i)=>`https://own-files.invalid/${i}.jpg`),type=category.startsWith('fahrzeuge-')?'vehicle':'prop';
 const created=await f.create({type,category,title:'Own test article',city:'Own test city',metadata:model.marketplaceMetadataPatch(draft),price:999999,draft:true,image_url:images[0],extra_images:images.slice(1)});assert.equal(created.status,200);const id=(await created.json()).data.id;
 assert.equal(f.rows.get(id).published,false);assert.equal(f.rows.get(id).price,125.5);assert.equal(f.rows.get(id).user_id,'own-provider');
 assert.equal((await f.read('marketplace=1')).status,200);assert.equal((await (await f.read('marketplace=1')).json()).data.length,0);
 f.setUser(null);assert.equal((await f.edit(id,{title:'foreign'})).status,401);f.setUser('foreign');assert.equal((await f.edit(id,{title:'foreign'})).status,404);f.setUser('own-provider');
 const next=makeDraft(type==='vehicle'?'fahrzeuge-produktion':'licht-steuerung');next.values.rent_price='';next.values.rent_mode='negotiable';
 const edited=await f.edit(id,{category:next.category,metadata:model.marketplaceMetadataPatch(next),image_url:images[4],extra_images:images.filter((_,i)=>i!==4)});assert.equal(edited.status,200);assert.equal(f.rows.get(id).image_url,images[4]);assert.equal(f.rows.get(id).extra_images.length,9);assert.equal(f.rows.get(id).published,false);assert.match(pricing.listingPriceLabel(f.rows.get(id).price,f.rows.get(id).metadata),/Miete: VB/);
 assert.equal((await f.edit(id,{published:true})).status,403);assert.equal(f.rows.get(id).user_id,'own-provider');
});
test('explicit publication uses owner_published; incomplete profile and admin restrictions do not create approval',async()=>{
 const f=fixture(),draft=makeDraft('licht-quellen'),body={type:'prop',category:draft.category,title:'Own publication test',city:'Own city',image_url:'https://own-files.invalid/1.jpg',metadata:model.marketplaceMetadataPatch(draft),draft:false};
 assert.equal((await f.create(body)).status,200);assert.equal([...f.rows.values()][0].moderation_status,'owner_published');
 f.setRestricted(true);const restricted=await f.create(body);assert.equal(restricted.status,200);assert.equal((await restricted.json()).data.published,false);
 // Existing database transition tests independently execute actual production SQL with profile and admin-role scenarios.
});
test('filtered public rows and exact totals share filters and pagination; rapid requests carry no shared selected-category state',async()=>{
 const f=fixture();for(let i=0;i<55;i++)f.rows.set(`own-${i}`,{id:`own-${i}`,type:'prop',category:i<30?'licht-signal':'kostuem-staender',title:'Own test '+i,city:'Own city',price:i,published:i!==0,created_at:String(i).padStart(3,'0'),metadata:{rental_type:i%2?'beides':'miete'}});
 const result=await(await f.read('marketplace=1&dept=licht&sub=licht-signal&page=1&limit=24')).json();assert.equal(result.count,29);assert.equal(result.data.length,24);assert.ok(result.data.every(row=>row.category==='licht-signal'));
 const second=await(await f.read('marketplace=1&dept=licht&sub=licht-signal&page=2&limit=24')).json();assert.equal(second.count,29);assert.equal(second.data.length,5);assert.equal(new Set([...result.data,...second.data].map(row=>row.id)).size,29);
 const [light,costume]=await Promise.all(['licht','kostuem'].map(dept=>f.read('marketplace=1&dept='+dept).then(r=>r.json())));assert.equal(light.count,29);assert.equal(costume.count,25);
 assert.equal((await(await f.read('marketplace=1&dept=ton')).json()).count,0);assert.equal((await f.read('marketplace=1&dept=licht&sub=kostuem-staender')).status,400);
 const search=await(await f.read('marketplace=1&q=DMX')).json();assert.equal(search.count,29);assert.ok(search.data.every(row=>row.category==='licht-signal'));
});

test('structured prices preserve rental unit and sale semantics and never advertise VB as zero euros',()=>{const draft=makeDraft('licht-quellen');const offers=pricing.listingStructuredOffers(125.5,model.marketplaceMetadataPatch(draft));assert.equal(offers[0].priceSpecification.unitCode,'WEE');assert.match(offers[0].businessFunction,/LeaseOut/);assert.equal(offers.length,1);draft.values.sale_mode='fixed';assert.equal(pricing.listingStructuredOffers(125.5,model.marketplaceMetadataPatch(draft)).length,2);Object.assign(draft.values,{mode:'rent',rent_mode:'negotiable',rent_price:''});assert.equal(pricing.listingStructuredOffers(0,model.marketplaceMetadataPatch(draft)),undefined);});

test('malformed older metadata cannot crash homepage, search or detail price displays',()=>{for(const marketplace of [true,[],{}, {mode:'both'}, {mode:'rent',unit:'day',bundle:'single',rent_mode:'fixed',sale_mode:'request',rent_price:10,sale_price:null,fulfilment:[],specs:null}])assert.doesNotThrow(()=>pricing.listingPriceLabel(30,{marketplace}));});

test('a private incomplete fixed-price draft is allowed, while explicit publication requires its price',()=>{const draft=makeDraft('licht-signal');draft.values.rent_price='';const offer=model.serializeMarketplaceDraft(draft);assert.equal(model.validateMarketplaceOffer(draft.category,'prop',offer,false),null);assert.equal(model.validateMarketplaceOffer(draft.category,'prop',offer,true),'priceRequired');});

test('own older and current offers can be created without photos, later illustrated and saved after removing the last image',async()=>{
 for(const category of ['licht-signal','fahrzeuge-bild']) {
  const f=fixture(),draft=makeDraft(category),type=category.startsWith('fahrzeuge-')?'vehicle':'prop';
  const response=await f.create({type,category,title:'Own no-photo test',city:'Own city',metadata:model.marketplaceMetadataPatch(draft),draft:true,image_url:null,extra_images:[]});
  assert.equal(response.status,200);const row=(await response.json()).data;assert.equal(row.published,false);assert.equal(row.image_url,null);
  assert.equal((await f.edit(row.id,{image_url:'https://own-files.invalid/later.jpg',extra_images:[]})).status,200);
  assert.equal((await f.edit(row.id,{image_url:null,extra_images:[]})).status,200);
  const restored=(await(await f.read('mine=true')).json()).data.find(r=>r.id===row.id);assert.equal(restored.image_url,null);assert.deepEqual(restored.extra_images,[]);assert.equal(restored.category,category);
  f.setUser('other-member');assert.equal((await f.edit(row.id,{image_url:null,extra_images:[]})).status,404);
 }
 const f=fixture();f.rows.set('own-legacy',{id:'own-legacy',type:'prop',category:'Lichttechnik',title:'Own legacy draft',city:'Own city',price:0,user_id:'own-provider',metadata:{},published:false,image_url:null,extra_images:[]});
 assert.equal((await f.edit('own-legacy',{title:'Own legacy draft continued without a photo'})).status,200);assert.equal(f.rows.get('own-legacy').image_url,null);assert.equal(f.rows.get('own-legacy').category,'Lichttechnik');
});

test('selected city IDs survive create/read/edit for homonyms in the same region',async()=>{
 const f=fixture(),draft=makeDraft('licht-quellen');
 const place='Ashford, England, GB';
 const created=await f.create({type:'prop',category:draft.category,title:'Homonym place fixture',city:place,selected_place_city_id:'geonames:2656954',metadata:model.marketplaceMetadataPatch(draft),draft:true});
 assert.equal(created.status,200);
 const first=(await created.json()).data;
 assert.equal(first.place_status,'verified');assert.equal(first.place_city_id,'geonames:2656954');
 assert.equal(first.city,'Ashford');assert.equal(first.place_country_code,'GB');
 const edited=await f.edit(first.id,{city:place,selected_place_city_id:'geonames:2656955'});
 assert.equal(edited.status,200);assert.equal(f.rows.get(first.id).place_city_id,'geonames:2656955');
 const read=await(await f.read('mine=true')).json();assert.equal(read.data[0].place_city_id,'geonames:2656955');
 const manual=await f.edit(first.id,{city:place,selected_place_city_id:''});
 assert.equal(manual.status,200);assert.equal(f.rows.get(first.id).place_status,'pending');assert.equal(f.rows.get(first.id).place_city_id,null);
 const forged=await f.edit(first.id,{city:'Ashford, FR',selected_place_city_id:'geonames:2656954'});
 assert.equal(forged.status,200);assert.equal(f.rows.get(first.id).place_city_id,null);assert.equal(f.rows.get(first.id).place_country_code,'FR');
});

for(const locale of Object.keys(dictionaries))test(`${locale}: actual GET searches canonical/old aliases before exact count and pagination`,async()=>{
 const f=fixture({locale});
 for(let index=0;index<55;index++)f.rows.set(`alias-${index}`,{id:`alias-${index}`,type:'prop',category:index<30?(index%2?'sofa':'requisiten-moebel'):(index%2?'arri':'kamera-kameras'),title:`Opaque fixture ${index}`,description:'Own description',city:'Own city',place_country_code:index===1?'GB':'DE',price:10,published:index!==0,created_at:String(index).padStart(3,'0'),metadata:{rental_type:'miete'}});
 const first=await(await f.read('marketplace=1&q=Sofa&page=1&limit=24')).json();assert.equal(first.count,29);assert.equal(first.data.length,24);assert.ok(first.data.every(row=>['sofa','requisiten-moebel'].includes(row.category)));
 const second=await(await f.read('marketplace=1&q=Sofa&page=2&limit=24')).json();assert.equal(second.count,29);assert.equal(second.data.length,5);assert.equal(new Set([...first.data,...second.data].map(row=>row.id)).size,29);
 const camera=await(await f.read('marketplace=1&q=ARRI')).json();assert.equal(camera.count,25);assert.ok(camera.data.every(row=>['arri','kamera-kameras'].includes(row.category)));
 const native=translate(locale,'MarketplaceCatalog')('subcategories.requisiten-moebel');assert.equal((await(await f.read('marketplace=1&q='+encodeURIComponent(native))).json()).count,29);
 assert.equal((await(await f.read('marketplace=1&q=Sofa&country=DE')).json()).count,28);
 assert.equal((await(await f.read('marketplace=1&q=Sofa&dept=licht')).json()).count,0);
 assert.equal((await(await f.read('marketplace=1&q=Sofa&dept=requisiten&sub=requisiten-moebel')).json()).count,29);
 f.rows.set('direct-title',{id:'direct-title',type:'prop',category:'kamera-kameras',title:'Sony Sofa',city:'Own city',price:10,published:true,created_at:'100',metadata:{rental_type:'miete'}});
 const compound=await(await f.read('marketplace=1&q=Sony%20Sofa')).json();assert.equal(compound.count,1);assert.equal(compound.data[0].id,'direct-title');
 assert.equal((await(await f.read('marketplace=1&q=UnknownBrand%20Sofa')).json()).count,0);
 assert.equal((await(await f.read('marketplace=1&q=Sofa%20Requisiten')).json()).count,29);
 for(const category of ['licht-signal','licht-steuerung','licht-quellen'])f.rows.set(category,{id:category,type:'prop',category,title:'Opaque technical fixture',city:'Own city',price:10,published:true,created_at:'200',metadata:{rental_type:'miete'}});
 const dmx=await(await f.read('marketplace=1&q=Licht%20DMX')).json();assert.equal(dmx.count,2);assert.ok(dmx.data.every(row=>['licht-signal','licht-steuerung'].includes(row.category)));
 assert.deepEqual(f.writes,[]);
});

test('public vehicle matching preserves unknown typed vehicles and known legacy prop vehicles without weakening writes',()=>{
 for(const category of [null,undefined,'','Original international vehicle']){
  assert.equal(catalog.marketplaceMatches(category,'fahrzeuge',null,'vehicle'),true);
  assert.equal(catalog.marketplaceMatches(category,'fahrzeuge','fahrzeuge-bild','vehicle'),false);
  assert.equal(catalog.marketplaceMatches(category,'fahrzeuge',null,'prop'),false);
 }
 for(const type of ['prop','vehicle'])for(const category of ['fahrzeuge-bild','oldtimer']){
  assert.equal(catalog.marketplaceMatches(category,'fahrzeuge',null,type),true);
  assert.equal(catalog.marketplaceMatches(category,'fahrzeuge','fahrzeuge-bild',type),true);
 }
 assert.equal(catalog.marketplaceMatches('Bild-Fahrzeug','fahrzeuge',null,'prop'),true);
 assert.equal(catalog.marketplaceMatches('Bild-Fahrzeug','fahrzeuge','fahrzeuge-bild','prop'),false);
 for(const type of ['location','job','animal'])assert.equal(catalog.marketplaceMatches('fahrzeuge-bild','fahrzeuge',null,type),false);
 assert.equal(catalog.marketplaceCategory('fahrzeuge-bild','prop'),null);
 assert.equal(catalog.marketplaceCategory('Original international vehicle','vehicle'),null);
 const envelope=model.serializeMarketplaceDraft(makeDraft('fahrzeuge-bild'));
 assert.equal(model.validateMarketplaceOffer('fahrzeuge-bild','prop',envelope),'invalidCategory');
 assert.equal(model.validateMarketplaceOffer('Original international vehicle','vehicle',envelope),'invalidCategory');
 assert.equal(model.validateMarketplaceOffer('fahrzeuge-bild','vehicle',envelope),null);
});

for(const locale of Object.keys(dictionaries))test(`${locale}: broad vehicle GET and client matching agree before count/page; exact children never guess`,async()=>{
 const f=fixture({locale}),add=(id,type,category,extra={})=>f.rows.set(id,{id,type,category,title:'Opaque original title',city:'Original town',place_country_code:'DE',price:10,published:true,created_at:id,metadata:{rental_type:'miete'},...extra});
 for(let index=0;index<55;index++)add(`read-${String(index).padStart(2,'0')}`,index<30?'vehicle':'prop',index<30?(index%3===0?null:index%3===1?'':'Original vehicle kind'):index<39?'oldtimer':index<48?'fahrzeuge-produktion':'licht-signal',index===0?{place_country_code:'GB'}:{});
 add('old-typed-vehicle','vehicle','kamera-kameras');add('broad-legacy-prop','prop','Bild-Fahrzeug');add('canonical-vehicle','vehicle','fahrzeuge-bild');
 add('private-vehicle','vehicle',null,{published:false});add('wrong-location','location','fahrzeuge-bild');add('wrong-job','job','fahrzeuge-bild');add('unknown-prop','prop','Unclear original prop',{title:'Vehicle car van'});
 const original=structuredClone([...f.rows.values()]),publicRows=original.filter(row=>row.published&&['prop','vehicle'].includes(row.type)),known=catalog.deptValues(catalog.DEPARTMENTS.find(department=>department.id==='fahrzeuge'));
 const expected=publicRows.filter(row=>row.type==='vehicle'||known.includes(row.category));assert.equal(expected.length,51);
 const ids=rows=>rows.map(row=>row.id).sort();assert.deepEqual(ids(publicRows.filter(row=>catalog.marketplaceMatches(row.category,'fahrzeuge',null,row.type))),ids(expected));
 const pages=await Promise.all([1,2,3].map(async page=>{const response=await f.read(`marketplace=1&dept=fahrzeuge&page=${page}&limit=24`);assert.equal(response.status,200);return response.json();}));
 for(const result of pages)assert.equal(result.count,51);assert.deepEqual(pages.map(result=>result.data.length),[24,24,3]);assert.deepEqual(ids(pages.flatMap(result=>result.data)),ids(expected));
 const precise=await(await f.read('marketplace=1&dept=fahrzeuge&sub=fahrzeuge-bild&limit=100')).json();const group=catalog.DEPARTMENTS.find(department=>department.id==='fahrzeuge').groups.find(group=>group.id==='fahrzeuge-bild');const preciseRows=publicRows.filter(row=>catalog.groupValues(group).includes(row.category));
 assert.equal(precise.count,10);assert.deepEqual(ids(precise.data),ids(preciseRows));assert.deepEqual(ids(publicRows.filter(row=>catalog.marketplaceMatches(row.category,'fahrzeuge','fahrzeuge-bild',row.type))),ids(preciseRows));
 const narrowed=await(await f.read('marketplace=1&dept=fahrzeuge&country=GB&limit=100')).json();assert.equal(narrowed.count,1);assert.equal(narrowed.data[0].id,'read-00');
 const conjunction=await(await f.read('marketplace=1&dept=fahrzeuge&q=Vehicle%20car%20van&limit=100')).json();assert.equal(conjunction.count,0);
 assert.deepEqual([...f.rows.values()],original);assert.deepEqual(f.writes,[]);
});
