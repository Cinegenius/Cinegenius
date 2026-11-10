import {intlServerFor} from './i18n-test-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator} from 'next-intl';
import {needsPublicSetupProfile,setupProfilePayload,providerProfileEntry} from './provider-profile-setup.ts';
import {START_QUICK_START_DRAFT,createQuickStartIntentData,normalizeQuickStartDraft,validateQuickStartDraft,getQuickStartIntroIntents} from './quick-start-flow.ts';
import {isQuickStartContentSaved} from './onboarding-save.ts';
import {filterProviderProfiles,MARKETPLACE_PROVIDER_FILTER,LOCATION_PROVIDER_FILTER} from './profile-provider-filters.ts';
import {hasProfileBasics} from './profile-setup-flow.ts';
const draft=intents=>({...structuredClone(START_QUICK_START_DRAFT),name:'Own Provider',personCity:'Berlin',personCountry:'Deutschland',intents,sections:Object.fromEntries(intents.filter(x=>['location','equipment'].includes(x)).map(intent=>[intent,{...createQuickStartIntentData(),offerLater:true}]))});
for(const intent of ['location','equipment'])test(`${intent}: provider setup needs no occupation or initial listing, but a real name and place`,()=>{
 const d=draft([intent]);assert.equal(needsPublicSetupProfile(d.intents),true);assert.equal(validateQuickStartDraft(d),null);
 const payload=setupProfilePayload(d,null,[]);assert.deepEqual(payload.profile_types,[intent]);assert.equal(payload.display_name,'Own Provider');assert.equal(hasProfileBasics(payload),true);assert.equal(payload.positions,undefined);assert.equal(payload.crew,undefined);assert.equal(payload.phone,undefined);assert.equal(payload.contact_email,undefined);
 assert.equal(isQuickStartContentSaved(d),false);d.completed.profile=true;assert.equal(isQuickStartContentSaved(d),true);
 assert.equal(validateQuickStartDraft({...d,personCity:''})?.field,'personCity');assert.equal(validateQuickStartDraft({...d,name:''})?.field,'name');
 const filter=intent==='location'?LOCATION_PROVIDER_FILTER:MARKETPLACE_PROVIDER_FILTER;assert.equal(filterProviderProfiles([payload],filter).length,1);
});
test('one profile can be listed in both provider areas without invented crew roles',()=>{
 const d=draft(['location','equipment']);const p=setupProfilePayload(d,null,[]);assert.deepEqual(p.profile_types,['location','equipment']);assert.equal(filterProviderProfiles([p],LOCATION_PROVIDER_FILTER).length,1);assert.equal(filterProviderProfiles([p],MARKETPLACE_PROVIDER_FILTER).length,1);
});
test('existing profile roles, photos and private settings are not cleared by provider-only setup',()=>{
 const existing={profile_type:'camera',profile_types:['camera'],crew:{primaryOccupation:'own-role'}};
 const p=setupProfilePayload(draft(['equipment']),existing,[]);assert.deepEqual(p.profile_types,['camera','equipment']);for(const field of ['positions','crew','avatar_url','bio','slug','profile_visibility','phone','contact_email'])assert.equal(Object.hasOwn(p,field),false);
});
test('provider photo is not copied from an offer image; offer drafts remain resumable',()=>{
 const d=draft(['location']);d.sections.location.imageUrl='/api/media/own-offer-image';d.providerImageUrl='/api/media/own-profile-image';d.talentIntro='Own introduction';
 const normalized=normalizeQuickStartDraft(d);assert.equal(normalized.sections.location.offerLater,true);assert.equal(normalized.providerImageUrl,d.providerImageUrl);assert.equal(normalized.sections.location.imageUrl,d.sections.location.imageUrl);const p=setupProfilePayload(normalized,null,[]);assert.equal(p.avatar_url,d.providerImageUrl);assert.equal(p.bio,d.talentIntro);
 d.sections.location.offerLater=false;assert.equal(validateQuickStartDraft(d)?.field,'location-category');assert.equal(normalizeQuickStartDraft({...d,sections:{location:{title:'Own old title',category:'Wohnen',city:'Berlin'}}}).sections.location.offerLater,false);
});
test('existing provider accounts receive only a voluntary setup entry, never a public backfill',()=>{
 for(const intent of ['location','equipment'])assert.equal(providerProfileEntry(false,{intent,setupComplete:true}),`/profile-setup?provider=${intent}`);
 for(const saved of [{intent:'search',setupComplete:true},{intent:'company',setupComplete:true},{intent:'equipment',setupComplete:false},null])assert.equal(providerProfileEntry(false,saved),null);assert.equal(providerProfileEntry(true,{intent:'location',setupComplete:true}),null);
});
test('new provider interface copy is complete in all six supported languages',()=>{
 const keys=Object.keys(JSON.parse(readFileSync(new URL('../messages/de.json',import.meta.url))).ProviderSetup).sort();
 for(const locale of ['de','en','es','it','cs','hu']){const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url)));assert.deepEqual(Object.keys(messages.ProviderSetup).sort(),keys);const t=createTranslator({locale,messages,namespace:'ProviderSetup'});for(const key of keys)assert.ok(t(key).trim());}
});

test('actual profile API saves/reloads both provider types, binds the authenticated account, and rejects guests',async()=>{
 const ts=await import('typescript');const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);const {NextRequest,NextResponse}=require('next/server');const {createClient}=await import('@supabase/supabase-js');
 const types=await import('./profile-types.ts'),display=await import('./profile-display.ts'),primary=await import('./primary-occupation.ts'),occupations=await import('./crew-occupations.ts'),cover=await import('./profile-cover.ts'),compat=await import('./profile-db-compat.ts');
 const rows=new Map();let signedIn=true,calls=0;
 const db=createClient('https://own-fixture.invalid','own-test-only-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  calls++;const url=new URL(input);const id=url.searchParams.get('user_id')?.replace(/^eq\./,'')??'own-provider';let row=rows.get(id)??null;
  if(init.method==='POST'){const value=JSON.parse(init.body);assert.equal(value.user_id,'own-provider');row={...(rows.get(value.user_id)??{}),...value};rows.set(value.user_id,row);}
  if(init.method==='PATCH'){assert.equal(id,'own-provider');row={...row,...JSON.parse(init.body)};rows.set(id,row);}
  return new Response(JSON.stringify(row),{headers:{'content-type':'application/json'}});
 }}});
 const deps={'next-intl/server':intlServerFor(),'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>signedIn?{userId:'own-provider'}:NextResponse.json({error:'account'},{status:401})},'@clerk/nextjs/server':{clerkClient:async()=>({users:{updateUserMetadata:async()=>{}}})},'next/cache':{revalidateTag(){}},'@/lib/profile-types':types,'@/lib/profile-display':display,'@/lib/primary-occupation':primary,'@/lib/crew-occupations':occupations,'@/lib/profile-cover':cover,'@/lib/profile-db-compat':compat};
 const compiled=ts.default.transpileModule(readFileSync(new URL('../app/api/profile/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.default.ModuleKind.CommonJS,target:ts.default.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('require','module','exports',compiled)(name=>deps[name]??require(name),mod,mod.exports);
 const req=(method,body)=>new NextRequest('https://own-fixture.invalid/api/profile',{method,body:JSON.stringify(body),headers:{'content-type':'application/json'}});
 const p=setupProfilePayload(draft(['equipment','location']),null,[]);let response=await mod.exports.POST(req('POST',{...p,user_id:'foreign-member'}));assert.equal(response.status,200);assert.equal((await response.json()).profile.user_id,'own-provider');
 response=await mod.exports.GET();assert.equal(response.status,200);const stored=(await response.json()).profile;assert.deepEqual(stored.profile_types,['location','equipment']);assert.deepEqual(stored.positions,[]);assert.equal(stored.avatar_url,null);assert.equal(rows.has('foreign-member'),false);
 response=await mod.exports.PATCH(req('PATCH',{bio:'Updated own provider',user_id:'foreign-member'}));assert.equal(response.status,200);assert.equal(rows.get('own-provider').bio,'Updated own provider');
 response=await mod.exports.POST(req('POST',{...p,display_name:''}));assert.equal(response.status,400);
 signedIn=false;const before=calls;assert.equal((await mod.exports.POST(req('POST',p))).status,401);assert.equal((await mod.exports.PATCH(req('PATCH',{bio:'denied'}))).status,401);assert.equal(calls,before);
});

test('a combined provider gets only one shared optional profile panel when offers are postponed',()=>{const d=draft(['equipment','location']);assert.deepEqual(getQuickStartIntroIntents(d.intents,d.sections),['equipment']);d.sections.location.offerLater=false;assert.deepEqual(getQuickStartIntroIntents(d.intents,d.sections),['equipment','location']);assert.deepEqual(getQuickStartIntroIntents(['crew',...d.intents],{...d.sections,location:{...d.sections.location,offerLater:true}}),['crew']);});
