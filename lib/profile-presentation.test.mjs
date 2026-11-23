import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFILE_PRESENTATIONS, profilePresentationFromCrew, preserveProfilePresentation, wantsProfileCover, presentationPortrait} from './profile-presentation.ts';
import {START_QUICK_START_DRAFT, normalizeQuickStartDraft, selectQuickStartPresentation, createQuickStartIntentData, validateQuickStartDraft} from './quick-start-flow.ts';
import {setupProfilePayload, initializeSetupPresentation} from './provider-profile-setup.ts';
import {normalizeGuidedProfileDraft} from './guided-profile-draft.ts';

test('absent and malformed old choices preserve automatic rendering; only an explicit auto clears a saved preference',()=>{
  for(const crew of [null,undefined,{},[],{profilePresentation:'old-layout'}])assert.equal(profilePresentationFromCrew(crew),'auto');
  const previous={profilePresentation:'cover',equipment_known:['Own equipment']};
  for(const next of [null,undefined,{}, {occupationForm:'neutral'}])assert.equal(profilePresentationFromCrew(preserveProfilePresentation(previous,next)),'cover');
  assert.deepEqual(preserveProfilePresentation(previous,{profilePresentation:'auto',occupationForm:'neutral'}),{occupationForm:'neutral'});
  assert.equal(previous.profilePresentation,'cover');
});

for(const intent of ['crew','talent','location','equipment'])test(`${intent}: creation choice survives resume and reaches the profile payload without changing roles or images`,()=>{
  const d={...structuredClone(START_QUICK_START_DRAFT),name:'Own example',personCity:'Berlin',personCountry:'DE',intents:[intent],profileAvatarUrl:'/api/media/own-portrait',profileCoverUrl:'/api/media/own-cover',sections:{[intent]:{...createQuickStartIntentData(),offerLater:true}},completed:{profile:true,listings:{equipment:'own-listing'}}};
  const roles=intent==='crew'?[{departmentId:'kamera',role:'Kameramann'}]:intent==='talent'?[{departmentId:'cast',role:'Schauspieler'}]:[];
  const existing={profile_type:'camera',profile_types:['camera'],crew:{equipment_known:['Own equipment'],occupationForm:'feminine'}};
  const original=setupProfilePayload(d,existing,roles);
  for(const mode of PROFILE_PRESENTATIONS){
    const draft=normalizeQuickStartDraft({...d,profilePresentation:mode});
    assert.equal(draft.profilePresentation,mode);
    const payload=setupProfilePayload(draft,existing,roles);
    assert.equal(payload.crew.profilePresentation,mode);
    assert.equal(payload.crew.occupationForm,'feminine');
    assert.deepEqual(payload.profile_types,original.profile_types);
    assert.deepEqual(payload.positions,original.positions);
    assert.equal(payload.avatar_url,original.avatar_url);
    assert.equal(payload.cover_image_url,original.cover_image_url);
    assert.deepEqual(payload.crew.equipment_known,['Own equipment']);
  }
  const changed=selectQuickStartPresentation(d,'cover');
  assert.equal(changed.completed.profile,false);
  assert.equal(changed.completed.listings.equipment,'own-listing');
  assert.equal(selectQuickStartPresentation(changed,'cover'),changed);
  assert.equal(selectQuickStartPresentation(changed,'invalid'),changed);
});

test('creation choice is optional and does not add a photo requirement or overwrite resumed choices',()=>{
  const draft={...structuredClone(START_QUICK_START_DRAFT),name:'Own provider',personCity:'Berlin',personCountry:'DE',intents:['location'],sections:{location:{...createQuickStartIntentData(),offerLater:true}}};
  for(const mode of [undefined,...PROFILE_PRESENTATIONS])assert.equal(validateQuickStartDraft({...draft,profilePresentation:mode}),null);
  const existing={crew:{profilePresentation:'portrait'}};
  assert.equal(initializeSetupPresentation(draft,existing).profilePresentation,'portrait');
  assert.equal(initializeSetupPresentation({...draft,profilePresentation:'auto'},existing).profilePresentation,'auto');
  assert.equal(initializeSetupPresentation(draft,null),draft);
  assert.equal(normalizeQuickStartDraft({...draft,profilePresentation:'invalid'}).profilePresentation,undefined);
  for(const mode of PROFILE_PRESENTATIONS)assert.equal(normalizeGuidedProfileDraft({profilePresentation:mode}).profilePresentation,mode);
  assert.equal(normalizeGuidedProfileDraft({profilePresentation:'invalid'}).profilePresentation,undefined);
});

test('cover can be deliberately selected for talent; hidden media remain untouched and missing portraits have bounded fallbacks',()=>{
  assert.equal(wantsProfileCover('auto',true),false);
  assert.equal(wantsProfileCover('auto',false),true);
  for(const talent of [true,false]){
    assert.equal(wantsProfileCover('cover',talent),true);
    assert.equal(wantsProfileCover('portrait',talent),false);
    assert.equal(wantsProfileCover('compact',talent),false);
  }
  const photos={avatar_url:'/api/media/own-avatar',cover_image_url:'/api/media/own-cover',profile_images:[{url:'/api/media/own-gallery',featured:true}]};
  const before=structuredClone(photos);
  assert.equal(presentationPortrait(photos),photos.avatar_url);
  assert.equal(presentationPortrait({...photos,avatar_url:null}),photos.profile_images[0].url);
  assert.equal(presentationPortrait({cover_image_url:photos.cover_image_url}),null,'do not substitute a cover for a portrait');
  assert.deepEqual(photos,before);
});
