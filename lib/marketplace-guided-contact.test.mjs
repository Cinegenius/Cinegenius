import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {setImmediate as nextTurn} from 'node:timers/promises';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
import * as offer from './marketplace-offer.ts';
import * as catalog from './marketplaceCategories.ts';
import * as prices from './listing-price.ts';
import * as responsible from './responsible-person.ts';
import * as gallery from './listing-image-gallery.ts';
import * as places from './places/core.ts';
import * as selectedPlace from './selected-place-id.ts';
import * as queues from './onboarding-save.ts';
import * as errors from './ui-error-message.ts';
import * as messageAttempts from './message-send-attempt.ts';

const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
const messages=Object.fromEntries(locales.map(locale=>[locale,JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'))]));
const translators=new Map(),compiled=new Map();
function translate(locale,namespace){const key=`${locale}:${namespace??''}`;if(!translators.has(key))translators.set(key,createTranslator({locale,messages:messages[locale],namespace,onError(error){throw error;}}));return translators.get(key);}
function elements(value,predicate,result=[]){if(Array.isArray(value))value.forEach(child=>elements(child,predicate,result));else if(value&&typeof value==='object'&&value.props){if(predicate(value))result.push(value);elements(value.props.children,predicate,result);}return result;}
function text(value){if(value==null||typeof value==='boolean')return'';if(Array.isArray(value))return value.map(text).join('');return typeof value==='object'?text(value.props?.children):String(value);}
const person={firstName:'Own',lastName:'Provider',function:'',customFunction:'',public:false,profileName:'Own verified profile'};
function savedDraft(extra={}){return {type:'equipment',step:5,category:'kamera-kameras',city:'München, Deutschland',title:'Own camera & original title',description:'Own factual description.',price:'75',priceOnRequest:false,imageUrls:[],responsible:person,...extra};}

/** Actual TSX handlers, hooks and effect lifecycle; every transport is an inert fixture. */
function fixture(component,{locale='de',saved=savedDraft(),kind='equipment',props,user={id:'own-requester'},handler}={}){
 let currentLocale=locale,index=0,dirty=false,disposed=false,timerId=0,tree,backing=structuredClone(saved);
 const hooks=[],effects=[],timers=new Map(),requests=[],navigation=[];
 const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((entry,i)=>Object.is(entry,b[i]));
 const react={
  useState(initial){const slot=index++;if(!hooks[slot]){hooks[slot]={value:typeof initial==='function'?initial():initial};hooks[slot].set=next=>{assert.equal(disposed,false,'no update after unmount');const value=typeof next==='function'?next(hooks[slot].value):next;if(!Object.is(value,hooks[slot].value)){hooks[slot].value=value;dirty=true;}};}return [hooks[slot].value,hooks[slot].set];},
  useLayoutEffect(callback,deps){return react.useEffect(callback,deps);},
  useRef(initial){const slot=index++;hooks[slot]??={current:initial};return hooks[slot];},
  useMemo(callback,deps){const slot=index++;if(!same(hooks[slot]?.deps,deps))hooks[slot]={deps:[...deps],value:callback()};return hooks[slot].value;},
  useCallback(callback,deps){return react.useMemo(()=>callback,deps);},
  useEffect(callback,deps){const slot=index++,previous=hooks[slot];if(!same(previous?.deps,deps)){hooks[slot]={deps:deps&&[...deps],cleanup:previous?.cleanup};effects.push(()=>{previous?.cleanup?.();hooks[slot].cleanup=callback();});}},
 };
 const router={push:value=>navigation.push(value),replace:value=>navigation.push(value)};
 const imports={
  react,'react-dom':{flushSync:callback=>{callback();render();}},'react/jsx-runtime':jsx,'next-intl':{useLocale:()=>currentLocale,useTranslations:namespace=>translate(currentLocale,namespace)},
  'next/navigation':{useSearchParams:()=>new URLSearchParams({type:kind}),useRouter:()=>router},'@/lib/use-form-router':{useFormRouter:()=>router},
  '@clerk/nextjs':{useUser:()=>({user,isLoaded:true})},'next/link':{default:'test-link'},
  'lucide-react':new Proxy({},{get:(_target,key)=>`test-icon-${String(key)}`}),
  '@/lib/marketplace-offer':offer,'@/lib/marketplaceCategories':catalog,'@/lib/listing-price':prices,
  '@/lib/responsible-person':responsible,'@/lib/listing-image-gallery':gallery,'@/lib/places/core':places,'@/lib/selected-place-id':selectedPlace,
  '@/lib/onboarding-save':queues,'@/lib/ui-error-message':errors,'@/lib/message-send-attempt':messageAttempts,
  '@/lib/use-form-draft':{useExistingDraftProtection:()=>({complete(){}}),useFormDraft:()=>({loaded:true,status:'saved',flush:async()=>true,complete:async()=>{},resume(){}})},'@/components/FormDraftStatus':{default:'test-draft-status'},
  '@/components/ResponsiblePersonFields':{default:'test-responsible-person',focusResponsiblePerson(){}},
  '@/components/MarketplaceOfferFields':{default:'test-marketplace-fields'},
  '@/components/PrivateLocationEditor':{default:'test-private-location-editor'},
  '@/components/ListingPriceOptions':{default:'test-location-prices'},'@/components/ListingImageManager':{default:'test-gallery'},
  '@/components/GenieWritingAssistant':{default:'test-genie'},'@/components/PlaceField':{default:'test-place-field'},'@/components/ContentUsageNotice':{default:'test-content-usage'},
  '@/components/MarketplaceOfferSummary':{default:'test-marketplace-summary'},'@/components/ContextBackLink':{default:'test-back-link'},
  '@/components/InquiryForm':{default:'test-inquiry'},'@/components/FavoriteButton':{default:'test-favorite'},'@/components/ReviewsSection':{default:'test-reviews'},
  '@/components/ReportButton':{default:'test-report'},'@/components/ProductionCredits':{ProductionCreditsDisplay:'test-credits'},
  '@/components/ListingPhotoGallery':{default:'test-photo-gallery'},'@/components/ListingProviderCard':{default:'test-provider'},
 };
 if(!compiled.has(component)){const extra=component==='GuidedListingWizard'?'\nexport {normalizeDraft,marketplaceForDraft};':'';compiled.set(component,ts.transpileModule(readFileSync(new URL(`../components/${component}.tsx`,import.meta.url),'utf8')+extra,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);}
 const mod={exports:{}};
 const transport=async(url,init={})=>{const request={url,method:init.method??'GET',body:init.body?JSON.parse(init.body):undefined};requests.push(request);const custom=await handler?.(request);if(custom)return custom;
  if(url==='/api/onboarding'&&request.method==='GET')return Response.json({draft:{listingDrafts:{[kind]:structuredClone(backing)}}});
  if(url==='/api/onboarding'&&request.method==='PUT'){backing=structuredClone(request.body.listingDraft);return Response.json({});}
  if(url==='/api/listings'&&request.method==='POST')return Response.json({data:{id:'own-created-listing',published:false,moderation_status:'draft'}});
  if(url==='/api/conversations')return Response.json({conversationId:'own-conversation',message:{id:'own-message'}});
  return Response.json({published:false});
 };
 new Function('require','module','exports','fetch','setTimeout','clearTimeout','TextEncoder','window',compiled.get(component))(
  name=>{assert.ok(Object.hasOwn(imports,name),`Unexpected import ${name}`);return imports[name];},mod,mod.exports,transport,
  callback=>{timers.set(++timerId,callback);return timerId;},id=>timers.delete(id),TextEncoder,{location:{pathname:'/props/own-listing',search:'?context=own'}});
 const render=()=>{for(let pass=0;pass<20;pass++){index=0;dirty=false;effects.length=0;tree=(component==='InquiryForm'?mod.exports.InquiryFormContent:mod.exports.default)(props);effects.splice(0).forEach(effect=>effect());if(!dirty)return tree;}assert.fail('Effects did not settle');};
 return {exports:mod.exports,requests,navigation,render,get tree(){return tree;},get backing(){return backing;},setLocale(value){currentLocale=value;render();},
  async settle(){for(let pass=0;pass<4;pass++){await nextTurn();render();}},async flushRecovery(){const pending=[...timers.values()];timers.clear();pending.forEach(callback=>callback());await this.settle();},
  dispose(){hooks.forEach(hook=>hook.cleanup?.());timers.clear();disposed=true;},
 };
}
const fields=f=>elements(f.tree,item=>item.type==='test-marketplace-fields')[0];
const primary=f=>elements(f.tree,item=>item.type==='button'&&item.props.className?.includes('bg-gold')).at(-1);
const submit=f=>elements(f.tree,item=>item.type==='form')[0];
const inquiryProps=type=>({listingId:'own-listing',listingTitle:'Member title & Unicode č',listingType:type,ownerId:'own-receiver',ownerName:'Own Provider'});
async function mounted(component,options){const f=fixture(component,options);f.render();await f.settle();return f;}

test('guided legacy recovery preserves original text, aliases, prices and optional images without inventing a subcategory',()=>{
 const f=fixture('GuidedListingWizard');
 const legacy=savedDraft({category:'Kameraequipment',price:'',priceOnRequest:false,description:'Member text: als, <XML>, Čeština',imageUrls:undefined,imageUrl:'/api/media/own/old.webp'}),before=structuredClone(legacy);
 const restored=f.exports.normalizeDraft(legacy,'equipment');
 assert.equal(restored.category,legacy.category);assert.equal(restored.description,legacy.description);assert.equal(restored.price,'');assert.deepEqual(restored.imageUrls,[legacy.imageUrl]);
 assert.equal(restored.marketplace.category,'Kameraequipment');assert.equal(restored.marketplace.values.rent_mode,'fixed');assert.equal(restored.marketplace.values.rent_price,'');
 const exact=f.exports.normalizeDraft({...legacy,category:'arri',price:'75.50'},'equipment');
 assert.equal(exact.category,'arri');assert.equal(exact.marketplace.category,'kamera-kameras');assert.equal(exact.marketplace.values.rent_price,'75.50');
 assert.equal(offer.validateMarketplaceOffer(exact.marketplace.category,'prop',offer.serializeMarketplaceDraft(exact.marketplace)),null);
 assert.deepEqual(legacy,before);f.dispose();
});

test('structured recovery retains sale/both values, voluntary facts and specs for inactive categories',()=>{
 const f=fixture('GuidedListingWizard'),marketplace=offer.marketplaceDraft('kamera-objektive');
 Object.assign(marketplace.values,{mode:'both',unit:'project',rent_mode:'negotiable',rent_price:'125.50',sale_mode:'fixed',sale_price:'900',fulfilment:'',condition:'Own condition & untouched'});
 marketplace.specsByCategory={'kamera-objektive':{mount:'Own mount',focal_length:'50 mm'},'licht-quellen':{power:'Own 120 W'}};
 const restored=f.exports.normalizeDraft(savedDraft({category:marketplace.category,marketplace}),'equipment');
 assert.deepEqual(restored.marketplace,marketplace);assert.deepEqual(f.exports.normalizeDraft(JSON.parse(JSON.stringify(restored)),'equipment').marketplace,marketplace);
 assert.equal(restored.marketplace.values.fulfilment,'','an explicitly empty collection preference must not become pickup');f.dispose();
});

test('nine locale switches retain the acknowledged recovery queue and member fields while later failures use the current language',async t=>{
 const f=await mounted('GuidedListingWizard');t.after(()=>f.dispose());const value=fields(f).props.value,memberText='Keep my als <XML>, “quotes”, č and ä unchanged.';
 fields(f).props.onChange({...value,values:{...value.values,included:memberText}});f.render();await f.flushRecovery();
 assert.equal(f.requests.filter(request=>request.method==='PUT').length,1);
 for(const locale of locales){f.setLocale(locale);await f.flushRecovery();assert.equal(fields(f).props.value.values.included,memberText);}
 assert.equal(f.requests.filter(request=>request.url==='/api/onboarding'&&request.method==='GET').length,1,'language changes must not reload private progress');
 assert.equal(f.requests.filter(request=>request.method==='PUT').length,1,'the save acknowledgement must survive language changes');
 const current=fields(f).props.value;fields(f).props.onChange({...current,values:{...current.values,...Object.fromEntries(offer.MARKETPLACE_COMMON_FIELDS.map(key=>[key,'é'.repeat(900)]))}});f.render();await f.flushRecovery();
 assert.ok(text(f.tree).includes(translate('sv')('System.m_699cf9afdb02')));assert.ok(!text(f.tree).includes(translate('de')('System.m_699cf9afdb02')));
});

for(const locale of locales)for(const mode of ['rent','sale','both'])test(`${locale}: guided ${mode} reaches reviewed private creation with shared canonical pricing`,async t=>{
 const f=await mounted('GuidedListingWizard',{locale});t.after(()=>f.dispose());
 const value=fields(f).props.value;
 const updated={...value,values:{...value.values,mode,rent_mode:'fixed',sale_mode:'negotiable',rent_price:'125.50',sale_price:'900',unit:'week',included:'Member-supplied kit'}};
 fields(f).props.onChange(updated);f.render();
 primary(f).props.onClick();await f.settle();assert.equal(elements(f.tree,item=>item.type==='test-responsible-person').length,1,'review follows valid shared prices');
 assert.ok(text(f.tree).includes(prices.listingPriceLabel(mode==='sale'?900:125.5,offer.marketplaceMetadataPatch(updated),undefined,locale,translate(locale,'MarketplaceOffer'))));
 primary(f).props.onClick();await f.settle();
 const post=f.requests.find(request=>request.url==='/api/listings'&&request.method==='POST');assert.ok(post);
 assert.equal(post.body.type,'prop');assert.equal(post.body.category,'kamera-kameras');assert.equal(post.body.draft,true);assert.equal(post.body.price,mode==='sale'?900:125.5);
 assert.equal(post.body.metadata.marketplace.mode,mode);assert.equal(post.body.metadata.marketplace.unit,'week');assert.equal(post.body.metadata.marketplace.included,'Member-supplied kit');
 assert.equal(post.body.image_url,null);assert.deepEqual(post.body.extra_images,[]);assert.deepEqual(post.body.responsible_person,person);
 assert.equal(f.requests.some(request=>request.url.endsWith('/publish')),false,'private creation never publishes implicitly');
});

for(const unit of ['hour','day','week','month','project'])test(`guided vehicle publication data keeps explicit ${unit} pricing and category`,async t=>{
 const marketplace=offer.marketplaceDraft('fahrzeuge-bild');Object.assign(marketplace.values,{mode:'rent',rent_mode:'fixed',rent_price:'50',unit});
 const f=await mounted('GuidedListingWizard',{saved:savedDraft({step:6,category:'fahrzeuge-bild',marketplace})});t.after(()=>f.dispose());
 primary(f).props.onClick();await f.settle();const post=f.requests.find(request=>request.url==='/api/listings'&&request.method==='POST');
 assert.equal(post.body.type,'vehicle');assert.equal(post.body.category,'fahrzeuge-bild');assert.equal(post.body.metadata.marketplace.unit,unit);assert.equal(post.body.draft,true);
 primary(f).props.onClick();await f.settle();
 assert.deepEqual(f.requests.filter(request=>request.url.includes('own-created-listing')).map(({url,method})=>({url,method})),[{url:'/api/listings/own-created-listing',method:'PATCH'},{url:'/api/listings/own-created-listing/publish',method:'POST'}]);
});

for(const amount of ['', '0','-1','NaN','1000001'])test(`guided fixed price '${amount}' cannot silently become an on-request offer`,async t=>{
 const marketplace=offer.marketplaceDraft('kamera-kameras');Object.assign(marketplace.values,{rent_mode:'fixed',rent_price:amount});
 const f=await mounted('GuidedListingWizard',{saved:savedDraft({marketplace})});t.after(()=>f.dispose());
 primary(f).props.onClick();await f.settle();
 assert.ok(fields(f));assert.equal(fields(f).props.value.values.rent_price,amount);assert.equal(elements(f.tree,item=>item.props.role==='alert').length,1);
 assert.equal(f.requests.some(request=>request.url==='/api/listings'),false);
});

test('equipment gallery can be skipped, while unfinished uploads still block leaving it',async t=>{
 const f=await mounted('GuidedListingWizard',{saved:savedDraft({step:3})});t.after(()=>f.dispose());
 const galleryField=elements(f.tree,item=>item.type==='test-gallery')[0];assert.deepEqual(galleryField.props.value,[]);
 assert.equal(text(primary(f)).trim(),translate('de','OptionalMedia')('skip'));
 galleryField.props.onStatusChange({uploading:true,failed:0});f.render();assert.equal(primary(f).props.disabled,true);
 galleryField.props.onStatusChange({uploading:false,failed:0});f.render();primary(f).props.onClick();await f.settle();
 assert.ok(elements(f.tree,item=>item.type==='input'&&item.props.id==='title').length);assert.equal(f.requests.some(request=>request.url==='/api/listings'),false);
});

test('location pricing, metadata and explicit private-save/publication boundaries remain unchanged',async t=>{
 const location=savedDraft({type:'location',step:5,category:'Wohnen',price:'85',priceOnRequest:false,sqm:'80',powerAvailable:true});
 const f=await mounted('GuidedListingWizard',{kind:'location',saved:location});t.after(()=>f.dispose());
 assert.equal(fields(f),undefined);assert.equal(elements(f.tree,item=>item.type==='test-location-prices').length,1);
 primary(f).props.onClick();await f.settle();primary(f).props.onClick();await f.settle();
 const post=f.requests.find(request=>request.url==='/api/listings'&&request.method==='POST');assert.equal(post.body.type,'location');assert.equal(post.body.category,'Wohnen');assert.equal(post.body.price,85);assert.equal(post.body.draft,true);assert.equal(post.body.image_url,null);
 assert.equal(post.body.metadata.sqm,80);assert.equal(post.body.metadata.power_available,true);assert.equal(post.body.metadata.price_on_request,false);assert.equal('marketplace'in post.body.metadata,false);assert.equal('rental_type'in post.body.metadata,false);
 assert.equal(f.requests.some(request=>request.url.endsWith('/publish')),false);
});

test('oversized recovery keeps all visible facts and the last saved draft without sending a replacement',async t=>{
 const previous=savedDraft(),f=await mounted('GuidedListingWizard',{saved:previous});t.after(()=>f.dispose());
 const value=fields(f).props.value,longValues=Object.fromEntries(offer.MARKETPLACE_COMMON_FIELDS.map(key=>[key,'é'.repeat(900)]));
 fields(f).props.onChange({...value,values:{...value.values,...longValues}});f.render();await f.flushRecovery();
 assert.deepEqual(f.backing,previous);assert.equal(f.requests.some(request=>request.method==='PUT'),false);
 assert.equal(fields(f).props.value.values.included,longValues.included);assert.ok(text(f.tree).includes(translate('de')('System.m_699cf9afdb02')));
 assert.equal(f.requests.some(request=>request.method==='DELETE'),false);
});

test('server recovery rejection preserves the last acknowledgement and current unsaved fields',async t=>{
 const previous=savedDraft(),f=await mounted('GuidedListingWizard',{saved:previous,handler:request=>request.method==='PUT'?Response.json({error:translate('de')('System.m_865553e9cb9e')},{status:413}):null});t.after(()=>f.dispose());
 const value=fields(f).props.value;fields(f).props.onChange({...value,values:{...value.values,condition:'Keep my unsaved condition'}});f.render();await f.flushRecovery();
 assert.deepEqual(f.backing,previous);assert.equal(fields(f).props.value.values.condition,'Keep my unsaved condition');assert.ok(text(f.tree).includes(translate('de')('System.m_865553e9cb9e')));assert.equal(f.requests.some(request=>request.method==='DELETE'),false);
});

test('continuing after a413 keeps the recovery error visible on the next step',async t=>{
 const previous=savedDraft(),f=await mounted('GuidedListingWizard',{saved:previous,handler:request=>request.method==='PUT'?Response.json({error:translate('de')('System.m_865553e9cb9e')},{status:413}):null});t.after(()=>f.dispose());
 primary(f).props.onClick();await f.settle();
 assert.equal(elements(f.tree,item=>item.type==='test-responsible-person').length,1);assert.ok(text(f.tree).includes(previous.title));
 assert.ok(text(f.tree).includes(translate('de')('System.m_865553e9cb9e')));assert.equal(elements(f.tree,item=>item.props.role==='alert').length,1);assert.deepEqual(f.backing,previous);
 assert.equal(f.requests.some(request=>request.url==='/api/listings'||request.method==='DELETE'),false);
});

test('continuing an oversized private draft retains its UTF8 warning and every entered fact',async t=>{
 const previous=savedDraft({step:4}),f=await mounted('GuidedListingWizard',{saved:previous});t.after(()=>f.dispose());
 const value=fields(f).props.value,longValues=Object.fromEntries(offer.MARKETPLACE_COMMON_FIELDS.map(key=>[key,'é'.repeat(900)]));
 fields(f).props.onChange({...value,values:{...value.values,...longValues}});f.render();primary(f).props.onClick();await f.settle();
 assert.equal(fields(f).props.prices,undefined);assert.equal(fields(f).props.details,false,'the flow reached the price step');
 assert.equal(fields(f).props.value.values.included,longValues.included);assert.ok(text(f.tree).includes(translate('de')('System.m_699cf9afdb02')));assert.deepEqual(f.backing,previous);
 assert.equal(f.requests.some(request=>request.method==='PUT'||request.method==='DELETE'),false);
});

test('a failed initial recovery read cannot autosave an empty form and can be retried safely',async t=>{
 let reads=0;const previous=savedDraft(),f=await mounted('GuidedListingWizard',{saved:previous,handler:request=>request.url==='/api/onboarding'&&request.method==='GET'&&++reads===1?Response.json({error:translate('de')('Ui.text_ccc99e9b5da8ea')},{status:503}):null});t.after(()=>f.dispose());
 await f.flushRecovery();assert.equal(fields(f),undefined);assert.equal(f.requests.filter(request=>request.method!=='GET').length,0);assert.deepEqual(f.backing,previous);
 const retry=elements(f.tree,item=>item.type==='button')[0];assert.equal(text(retry),translate('de')('setup.copy49'));retry.props.onClick();await f.settle();
 assert.ok(fields(f));assert.equal(fields(f).props.value.values.rent_price,'75');assert.deepEqual(f.backing,previous);
});

test('double-click and a lost create response reuse the persisted request key without implicit publication',async t=>{
 let creates=0;const f=await mounted('GuidedListingWizard',{saved:savedDraft({step:6}),handler:request=>{if(request.url==='/api/listings'&&request.method==='POST'&&++creates===1)throw new TypeError('fetch failed');return null;}});t.after(()=>f.dispose());
 const action=primary(f).props.onClick;action();action();await f.settle();
 const first=f.requests.find(request=>request.url==='/api/listings');assert.ok(first);assert.equal(creates,1);
 assert.match(first.body.onboarding_request_key,/^[\da-f-]{36}$/i);assert.equal(f.backing.requestKey,first.body.onboarding_request_key);
 assert.ok(f.requests.findIndex(request=>request.method==='PUT')<f.requests.indexOf(first));assert.equal(f.requests.some(request=>request.method==='DELETE'),false);
 primary(f).props.onClick();await f.settle();const posts=f.requests.filter(request=>request.url==='/api/listings');assert.equal(posts.length,2);assert.equal(posts[1].body.onboarding_request_key,first.body.onboarding_request_key);assert.equal(f.requests.some(request=>request.url.endsWith('/publish')),false);
});

test('cleanup failure truthfully preserves the saved offer state and remains visible after publication',async t=>{
 const f=await mounted('GuidedListingWizard',{saved:savedDraft({step:6}),handler:request=>request.method==='DELETE'?Response.json({error:'Own fixture cleanup failure'},{status:503}):null});t.after(()=>f.dispose());
 primary(f).props.onClick();await f.settle();
 const warning=translate('de','MarketplaceNavigation')('draftCleanupFailed');assert.ok(text(f.tree).includes(warning));assert.ok(text(f.tree).includes(translate('de','SetupOffers')('states.draft')));
 primary(f).props.onClick();await f.settle();assert.ok(text(f.tree).includes(warning));assert.equal(f.requests.filter(request=>request.url==='/api/listings').length,1);
});

test('retrying an already published keyed offer never presents it as a newly private draft',async t=>{
 const f=await mounted('GuidedListingWizard',{saved:savedDraft({step:6,requestKey:'12345678-1234-4234-8234-123456789abc'}),handler:request=>request.url==='/api/listings'?Response.json({data:{id:'own-created-listing',published:true,moderation_status:'owner_published'}}):null});t.after(()=>f.dispose());
 primary(f).props.onClick();await f.settle();assert.ok(text(f.tree).includes(translate('de','MarketplacePublishing')('publishedTitle')));assert.equal(f.requests.some(request=>request.url.endsWith('/publish')),false);
});

for(const locale of locales)for(const type of ['prop','vehicle'])test(`${locale}: ${type} contact needs only a message and preserves exact identity`,async t=>{
 const props=inquiryProps(type),f=await mounted('InquiryForm',{locale,props});t.after(()=>f.dispose());
 assert.equal(elements(f.tree,item=>item.type==='select')[0].props.value,'');assert.equal(elements(f.tree,item=>item.type==='details').length,1);
 const memberText='Original member words: als <XML> & č, "quotes".';
 elements(f.tree,item=>item.type==='textarea')[0].props.onChange({target:{value:memberText}});f.render();
 assert.equal(elements(f.tree,item=>item.type==='button'&&item.props.type==='submit')[0].props.disabled,false);
 await submit(f).props.onSubmit({preventDefault(){}});await f.settle();
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].url,'/api/conversations');const {accountId,idempotencyKey,...payload}=f.requests[0].body;assert.equal(accountId,'own-requester');assert.match(idempotencyKey,/^[A-Za-z0-9_-]{8,128}$/);assert.deepEqual(payload,{listing_id:props.listingId,listing_title:props.listingTitle,listing_type:type,receiver_id:props.ownerId,content:memberText});
 assert.ok(text(f.tree).includes(translate(locale,'MarketplaceNavigation')('inquirySentDescription')));assert.ok(!text(f.tree).includes('24'));
});

test('optional project context survives a language switch without altering member-written values',async t=>{
 const f=await mounted('InquiryForm',{props:inquiryProps('prop')});t.after(()=>f.dispose());
 const title='Own “Film als Company” <untouched>',message='My exact message remains in Deutsch, čeština & svenska.';
 elements(f.tree,item=>item.type==='input')[0].props.onChange({target:{value:title}});
 elements(f.tree,item=>item.type==='select')[0].props.onChange({target:{value:'Kurzfilm'}});
 elements(f.tree,item=>item.type==='textarea')[0].props.onChange({target:{value:message}});
 f.setLocale('sv');assert.equal(elements(f.tree,item=>item.type==='input')[0].props.value,title);assert.equal(elements(f.tree,item=>item.type==='select')[0].props.value,'Kurzfilm');
 assert.equal(elements(f.tree,item=>item.type==='textarea')[0].props.value,message);
 await submit(f).props.onSubmit({preventDefault(){}});await f.settle();
 assert.equal(f.requests[0].body.content,[translate('sv')('Ui.text_8d608163879370',{value1:title}),translate('sv')('Ui.text_a1d9fa86c76302',{value1:translate('sv')('Ui.text_75b346d26e4973')}),'',message].join('\n'));
});

for(const type of ['creator','location','job','animal'])test(`${type} inquiries retain mandatory project context`,async t=>{
 const f=await mounted('InquiryForm',{props:inquiryProps(type)});t.after(()=>f.dispose());
 assert.equal(elements(f.tree,item=>item.type==='details').length,0);assert.equal(elements(f.tree,item=>item.type==='select')[0].props.value,'Spielfilm');
 elements(f.tree,item=>item.type==='textarea')[0].props.onChange({target:{value:'Own ordinary detailed inquiry'}});f.render();
 assert.equal(elements(f.tree,item=>item.type==='button'&&item.props.type==='submit')[0].props.disabled,true);await submit(f).props.onSubmit({preventDefault(){}});assert.equal(f.requests.length,0);
 elements(f.tree,item=>item.type==='input')[0].props.onChange({target:{value:'Own project'}});f.render();assert.equal(elements(f.tree,item=>item.type==='button'&&item.props.type==='submit')[0].props.disabled,false);
});

test('marketplace requests still reject a short message and guests use the existing safe sign-in return',async t=>{
 const f=await mounted('InquiryForm',{props:inquiryProps('vehicle')});t.after(()=>f.dispose());
 elements(f.tree,item=>item.type==='textarea')[0].props.onChange({target:{value:'Too short'}});f.render();assert.equal(elements(f.tree,item=>item.type==='button'&&item.props.type==='submit')[0].props.disabled,true);await submit(f).props.onSubmit({preventDefault(){}});assert.equal(f.requests.length,0);
 const guest=await mounted('InquiryForm',{props:inquiryProps('prop'),user:null});t.after(()=>guest.dispose());assert.equal(submit(guest),undefined);assert.equal(guest.requests.length,0);
 elements(guest.tree,item=>item.type==='button')[0].props.onClick();assert.equal(guest.navigation[0],'/sign-in?redirect_url=%2Fprops%2Fown-listing%3Fcontext%3Down');assert.equal(guest.requests.length,0);
});

test('item detail retains supplier facts and contact but makes no invented package or rental-contract promise',async t=>{
 const marketplace=offer.marketplaceDraft('kamera-kameras');marketplace.values.included='Own explicitly supplied kit';
 const prop={id:'own-listing',title:'Own item',category:'kamera-kameras',vendor:'Own vendor',location:'Own city',dailyRate:0,pricing:offer.marketplaceMetadataPatch(marketplace),image:'',condition:'Own condition',era:null,delivery:false,description:'Own original description',ownerId:'own-provider',provider:{name:'Own provider'}};
 const f=await mounted('PropDetail',{props:{prop}});t.after(()=>f.dispose());
 const summary=elements(f.tree,item=>item.type==='test-marketplace-summary')[0];assert.equal(summary.props.metadata.marketplace.included,'Own explicitly supplied kit');assert.equal(elements(f.tree,item=>item.type==='test-inquiry')[0].props.ownerId,'own-provider');
 for(const key of ['Ui.text_139deccd621aed','Ui.text_67a73492b0d94e','Ui.text_67e45e82d60fbb'])assert.ok(!text(f.tree).includes(translate('de')(key)),key);
 assert.ok(text(f.tree).includes(prop.description));assert.equal(f.requests.some(request=>request.method==='POST'),false);
});
