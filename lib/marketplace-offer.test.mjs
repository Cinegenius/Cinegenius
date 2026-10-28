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
const dictionaries=Object.fromEntries(['de','en','es','it','cs','hu'].map(locale=>[locale,JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'))]));
const translate=(locale,namespace)=>key=>key.split('.').reduce((value,part)=>value?.[part],dictionaries[locale][namespace])??key;
test('14 departments share unique stable subcategories; every choice resolves once and all six translations exist',()=>{
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
function fixture(){
 let user='own-provider',profile=true,restricted=false;const rows=new Map(),writes=[];
 const split=text=>{let depth=0,quoted=false,out=[],start=0;for(let i=0;i<text.length;i++){if(text[i]==='"')quoted=!quoted;if(!quoted){if(text[i]==='(')depth++;if(text[i]===')')depth--;if(text[i]===','&&depth===0){out.push(text.slice(start,i));start=i+1;}}}return [...out,text.slice(start)];};
 const match=(row,expression)=>{if(expression.startsWith('and('))return split(expression.slice(4,-1)).every(value=>match(row,value));const m=expression.match(/^(.*?)\.(eq|is|in|ilike)\.(.*)$/);if(!m)throw Error('Unexpected filter '+expression);const [,key,op,value]=m;const actual=key.startsWith('metadata->>')?row.metadata?.[key.slice(11)]:row[key];if(op==='eq')return String(actual)===value;if(op==='is')return actual==null;if(op==='in')return split(value.slice(1,-1)).map(x=>x.replace(/^"|"$/g,'')).includes(String(actual));return String(actual??'').toLowerCase().includes(value.replaceAll('%','').toLowerCase());};
 const db={from(){let predicates=[],orders=[],range=null,pending=null,count=false;const q={select(_cols,options){count=options?.count==='exact';return q;},eq(key,value){predicates.push(row=>row[key]===value);return q;},in(key,values){predicates.push(row=>values.includes(row[key]));return q;},contains(key,value){predicates.push(row=>Object.entries(value).every(([k,v])=>row[key]?.[k]===v));return q;},or(expression){predicates.push(row=>split(expression).some(value=>match(row,value)));return q;},order(key,options={ascending:true}){orders.push([key,options.ascending]);return q;},range(from,to){range=[from,to];return q;},limit(n){range=[0,n-1];return q;},insert(data){pending=['insert',data];return q;},update(data){pending=['update',data];return q;},maybeSingle(){return Promise.resolve(run(true));},single(){return Promise.resolve(run(true));},then(resolve,reject){return Promise.resolve().then(()=>run(false)).then(resolve,reject);}};
 function run(single){let data=[...rows.values()].filter(row=>predicates.every(predicate=>predicate(row)));if(pending){const [action,changes]=pending;if(action==='insert')data=[{id:`own-${rows.size+1}`,created_at:new Date().toISOString(),...changes}];else data=data.map(row=>({...row,...changes}));for(const row of data){rows.set(row.id,row);writes.push(row);}}for(const [key,ascending]of orders.toReversed())data.sort((a,b)=>(a[key]>b[key]?1:a[key]<b[key]?-1:0)*(ascending?1:-1));const total=data.length;if(range)data=data.slice(range[0],range[1]+1);return {data:single?data[0]??null:data,error:null,...(count?{count:total}:{})};}return q;}};
 const mocks={'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>user?{userId:user}:NextResponse.json({error:'unauthorized'},{status:401})},'@/lib/listing-access':{canEditListing:async(id,row)=>row.user_id===id,editableCompanyIdsForUser:async()=>[]},'@/lib/responsible-person':responsible,'@/lib/responsible-person-server':{validateMarketplaceResponsiblePerson:async()=>({person:{userId:user,firstName:'Own',lastName:'Provider'}}),validateResponsiblePerson:async()=>({person:{userId:user}}),accountResponsiblePerson:async()=>({firstName:'Own',lastName:'Provider'})},'@/lib/marketplace-offer':model,'@/lib/marketplaceCategories':catalog,'@/lib/listing-price':pricing,'@/lib/listing-image-gallery':gallery,'@/lib/offer-moderation':moderation,'@/lib/rateLimit':{rateLimit:async()=>({allowed:true})},'next/cache':{revalidatePath(){},revalidateTag(){}},'next-intl/server':{getLocale:async()=> 'de',getTranslations:async ns=>translate('de',ns)},'@/lib/marketplace-publication-server':{publishMarketplaceOffer:async row=>{if(restricted)return {outcome:'restricted',row,error:'restricted'};if(!profile)return {outcome:'profile_required',row,error:'profile_required'};const saved={...row,published:true,moderation_status:'owner_published'};rows.set(row.id,saved);return {outcome:'published',row:saved};}}};
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
