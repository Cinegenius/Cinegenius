import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createTranslator} from 'next-intl';
import {PROFILE_AVATARS, PROFILE_COVERS, defaultProfileAvatar} from './profile-art.ts';
import {initializeSetupProfileArt, setupProfileAvatar, setupProfilePayload, needsPublicSetupProfile} from './provider-profile-setup.ts';
import {START_QUICK_START_DRAFT, normalizeQuickStartDraft, createQuickStartIntentData} from './quick-start-flow.ts';
import {isOwnPublicStorageUrl} from './community-media.ts';
const draft = () => ({...structuredClone(START_QUICK_START_DRAFT),name:'Own name',intents:['equipment'],sections:{equipment:{...createQuickStartIntentData(),offerLater:true}}});

test('new accounts receive varied stable defaults, independent of personal information', () => {
  const seen=new Set();
  for(let i=0;i<400;i++) {
    const id=`user_fixture_${i}`,first=initializeSetupProfileArt(draft(),id,null);
    seen.add(first.profileAvatarUrl);
    assert.equal(first.profileAvatarUrl,defaultProfileAvatar(id));
    assert.equal(initializeSetupProfileArt({...draft(),name:'Different name',personCity:'Tokyo'},id,null).profileAvatarUrl,first.profileAvatarUrl);
    assert.equal(initializeSetupProfileArt(normalizeQuickStartDraft(JSON.parse(JSON.stringify(first))),id,null).profileAvatarUrl,first.profileAvatarUrl);
    assert.equal(first.profileCoverUrl,undefined);
  }
  assert.equal(seen.size,12);
  assert.equal(initializeSetupProfileArt(draft(),'',null).profileAvatarUrl,undefined);
});

test('existing profiles, uploads and explicit removals are never replaced by a suggestion', () => {
  const existing={avatar_url:'/api/media/own/original.webp',cover_image_url:'/api/media/own/cover.webp'};
  const old=draft();assert.equal(initializeSetupProfileArt(old,'user_old',existing),old);
  assert.equal(setupProfileAvatar(old,existing),existing.avatar_url);
  for(const chosen of ['',PROFILE_AVATARS[3].src,'/api/media/own/chosen.webp']) {
    const resumed=normalizeQuickStartDraft({...draft(),profileAvatarUrl:chosen});
    assert.equal(initializeSetupProfileArt(resumed,'user_new',null).profileAvatarUrl,chosen);
    assert.equal(setupProfileAvatar({...resumed,providerImageUrl:'/legacy.webp'},existing),chosen);
  }
  for(const area of ['crew','talent','provider']) {
    const old=draft();if(area==='provider')old.providerImageUrl='/api/media/own/legacy.webp';else old.sections[area]={...createQuickStartIntentData(),imageUrl:'/api/media/own/legacy.webp'};
    assert.equal(initializeSetupProfileArt(old,'user_new',null).profileAvatarUrl,'/api/media/own/legacy.webp');
  }
});

test('onboarding and final payload preserve independent personal art, offer images and removals', () => {
  const before={...draft(),profileAvatarUrl:PROFILE_AVATARS[0].src,profileCoverUrl:PROFILE_COVERS[0].src};
  before.sections.equipment.imageUrl='/api/media/own/listing.webp';
  const resumed=normalizeQuickStartDraft(JSON.parse(JSON.stringify(before)));
  const saved=setupProfilePayload(resumed,null,[]);
  assert.equal(saved.avatar_url,before.profileAvatarUrl);assert.equal(saved.cover_image_url,before.profileCoverUrl);
  assert.equal(resumed.sections.equipment.imageUrl,before.sections.equipment.imageUrl);
  const existing={avatar_url:'/own.webp',cover_image_url:'/cover.webp'};
  const untouched=setupProfilePayload(draft(),existing,[]);
  assert.equal(Object.hasOwn(untouched,'avatar_url'),false);assert.equal(Object.hasOwn(untouched,'cover_image_url'),false);
  const removed=setupProfilePayload(normalizeQuickStartDraft({...before,profileAvatarUrl:'',profileCoverUrl:''}),existing,[]);
  assert.equal(removed.avatar_url,null);assert.equal(removed.cover_image_url,null);
  assert.equal(needsPublicSetupProfile(['company']),false);assert.equal(needsPublicSetupProfile(['search']),false);
});

test('the selected assets are compact public artwork, not uploaded community photographs; all source studies remain recoverable', () => {
  for(const presentation of ['masculine','feminine','neutral'])assert.equal(PROFILE_AVATARS.filter(x=>x.presentation===presentation).length,4);
  assert.equal(PROFILE_COVERS.length,12);
  for(const item of [...PROFILE_AVATARS,...PROFILE_COVERS]) {
    const file=new URL(`../public${item.src}`,import.meta.url);
    assert.ok(statSync(file).size<180_000,`${item.src}: keep downloads small`);
    assert.equal(isOwnPublicStorageUrl(item.src,'https://fixture.supabase.co'),false);
    assert.equal(isOwnPublicStorageUrl(`https://www.cinegenius.co${item.src}`,'https://fixture.supabase.co'),false);
  }
  const archive=new URL('../design/profile-art/2026-11-17/',import.meta.url);
  const catalog=JSON.parse(readFileSync(new URL('catalog.json',archive)));
  assert.equal(catalog.studies.length,20);
  for(const study of catalog.studies)for(const kind of ['avatar','cover']) {
    const bytes=readFileSync(new URL(`${String(study.study).padStart(2,'0')}-${kind}.svg`,archive));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),study.sha256[kind]);
  }
});

test('all 17 languages have usable art labels and preserve the number placeholder', () => {
  for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk']) {
    const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url)));
    const t=createTranslator({locale,messages,namespace:'ProfileArt',onError:error=>{throw error;}});
    for(const key of ['chooseAvatar','chooseCover','hint','editable','masculine','feminine','neutral'])assert.ok(t(key).length>1);
    assert.ok(t('avatarOption',{number:7}).includes('7'));
    for(const cover of PROFILE_COVERS)assert.ok(t(`themes.${cover.theme}`).length>0);
  }
});
