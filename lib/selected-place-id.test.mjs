import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuickStartDraft, START_QUICK_START_DRAFT, createQuickStartIntentData } from './quick-start-flow.ts';
import { normalizeGuidedProfileDraft } from './guided-profile-draft.ts';
import { setupProfilePayload } from './provider-profile-setup.ts';
import { sanitizeProjectDraftData, projectDraftMetadata } from './project-drafts.ts';

test('private onboarding drafts preserve selected identities independently of duplicate labels',()=>{
 const raw={...structuredClone(START_QUICK_START_DRAFT),intents:['location'],personCity:'Ashford, England',personCountry:'GB',personPlaceCityId:'geonames:2656954',sections:{location:{...createQuickStartIntentData(),city:'Ashford, England, GB',selected_place_city_id:'geonames:2656955'}}};
 const saved=normalizeQuickStartDraft(JSON.parse(JSON.stringify(raw)));
 assert.equal(saved.personPlaceCityId,'geonames:2656954');assert.equal(saved.sections.location.selected_place_city_id,'geonames:2656955');
 const payload=setupProfilePayload(saved,null,[]);assert.equal(payload.location,'Ashford, England, GB');assert.equal(payload.selected_place_city_id,'geonames:2656954');
 const old=normalizeQuickStartDraft({...raw,personPlaceCityId:undefined,sections:{location:{city:'Own legacy village'}}});
 assert.equal(old.personPlaceCityId,'');assert.equal(old.sections.location.city,'Own legacy village');assert.equal(old.sections.location.selected_place_city_id,'');
 const guided=normalizeGuidedProfileDraft({city:'Ashford, England, GB',selected_place_city_id:'geonames:2656954'});
 assert.equal(guided.selected_place_city_id,'geonames:2656954');
 assert.equal(normalizeGuidedProfileDraft({...guided,selected_place_city_id:{forged:true}}).selected_place_city_id,'');
});

test('project draft transport retains a selected ID without exposing it as member-authored metadata',()=>{
 const data=sanitizeProjectDraftData({title:'Own project',location:'Ashford, England, GB',selected_place_city_id:'geonames:2656955',place_country_code:'DE'});
 assert.equal(data.selected_place_city_id,'geonames:2656955');assert.equal(Object.hasOwn(data,'place_country_code'),false);
 assert.equal(Object.hasOwn(projectDraftMetadata(data,'own-project-draft'),'selected_place_city_id'),false);
 assert.equal(projectDraftMetadata(data,'own-project-draft').location,'Ashford, England, GB');
});
