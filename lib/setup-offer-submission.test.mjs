import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator} from 'next-intl';
import {setupOfferState,submitSetupOffer} from './setup-offer-submission.ts';

test('saved account completion is not publication: use the actual per-offer status and keep absent rows unknown',()=>{
 for(const input of [null,undefined,{},[],{moderation_status:'draft'},{published:'true'},{published:false,moderation_status:'unknown-status'}])assert.equal(setupOfferState(input),'unavailable');
 assert.equal(setupOfferState({published:false,moderation_status:null}),'draft','legacy private drafts remain actionable');
 for(const state of ['draft','pending','changes_requested','rejected','hidden'])assert.equal(setupOfferState({published:false,moderation_status:state}),state);
 for(const state of ['approved','owner_published','legacy_review_required']){
  assert.equal(setupOfferState({published:true,moderation_status:state}),'published');
  assert.equal(setupOfferState({published:false,moderation_status:state}),'unavailable','do not fabricate public state from approval alone');
 }
});
test('explicit submission reuses the existing authenticated publication endpoint, with no creation or approval payload',async()=>{
 const calls=[];const request=async(url,init)=>{calls.push({url,init});return Response.json({success:true,submitted:true,published:false,moderation_status:'pending'});};
 assert.equal(await submitSetupOffer('own/id','Could not confirm',request),'pending');
 assert.deepEqual(calls,[{url:'/api/listings/own%2Fid/publish',init:{method:'POST'}}]);
 assert.equal(await submitSetupOffer('own-id','Could not confirm',async()=>Response.json({success:true,published:true,moderation_status:'owner_published'})),'published');
 assert.equal(await submitSetupOffer('own-id','Could not confirm',async()=>Response.json({success:true,moderation_status:'pending'})),'pending');
});
test('denied access, validation, stale revisions, failed saves and ambiguous responses never report successful submission',async()=>{
 for(const status of [400,401,403,404,409,429,500,503])await assert.rejects(submitSetupOffer('own-id','fallback',async()=>Response.json({error:'Specific failure'},{status})),/Specific failure/);
 for(const body of [{success:false},{success:true},{success:true,published:false},{published:true},{success:true,moderation_status:'approved',published:false},null])await assert.rejects(submitSetupOffer('own-id','Could not confirm',async()=>Response.json(body)),/Could not confirm/);
 await assert.rejects(submitSetupOffer('own-id','Could not confirm',async()=>new Response('not JSON')),/Could not confirm/);
 await assert.rejects(submitSetupOffer('own-id','Could not confirm',async()=>{throw Error('offline')}),/offline/);
});
test('retry after a lost response uses the same saved offer and accepts a confirmed pending response',async()=>{
 const ids=[];let attempt=0;
 const request=async url=>{ids.push(url);if(attempt++===0)throw Error('network lost');return Response.json({success:true,submitted:true,published:false});};
 await assert.rejects(submitSetupOffer('saved-offer','failure',request));
 assert.equal(await submitSetupOffer('saved-offer','failure',request),'pending');
 assert.deepEqual(ids,['/api/listings/saved-offer/publish','/api/listings/saved-offer/publish']);
});
test('all completion states, actions and permission explanations are translated in every supported language',()=>{
 for(const locale of ['de','en','es','it','cs','hu']){
  const messages=JSON.parse(readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'));
  const t=createTranslator({locale,messages,namespace:'SetupOffers'});
  for(const key of ['accountReady','nextStep','location','equipment','locationRule','marketplaceRule','submitLocation','submitMarketplace','submitting','reload','openPublic','edit','saveError',...['loading','draft','pending','published','changes_requested','rejected','hidden','unavailable'].map(s=>'states.'+s)]){
   assert.ok(t(key).trim());assert.notEqual(t(key),'SetupOffers.'+key);
  }
 }
});
