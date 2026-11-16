import test from 'node:test';
import assert from 'node:assert/strict';
import {occupationCatalogue, occupationChoices, occupationReference} from './primary-occupation.ts';
import {profileOccupationPreview, profileOccupationFocusError, profileOccupationsUnchanged, crewOccupationIds, filterCrewOccupations} from './crew-occupations.ts';
import {normalizeQuickStartDraft, START_QUICK_START_DRAFT, createQuickStartIntentData, validateQuickStartDraft} from './quick-start-flow.ts';
import {normalizeGuidedProfileDraft, removeGuidedDepartment} from './guided-profile-draft.ts';
const ref=label=>occupationReference(occupationChoices([label])[0]);
const titles=['Gaffer (Oberbeleuchter)','Beleuchter (Electrician)','Rigging Gaffer','Produktionsfahrer*in','Key Grip'];
for(const title of titles)assert.ok(ref(title),title);
const profile={positions:titles.slice(0,4),crew:{primaryOccupation:ref(titles[0]),occupations:titles.slice(0,4).map(ref),additionalOccupation:ref(titles[3])}};
test('main and two secondary jobs are visible while the additional job remains searchable',()=>{
 assert.equal(profileOccupationFocusError(profile),null);
 assert.deepEqual(profileOccupationPreview(profile),titles.slice(0,3));
 const occupationIds=crewOccupationIds(profile);assert.equal(occupationIds.length,4);
 assert.equal(filterCrewOccupations([{occupationIds}],ref(titles[3]).departmentId,[ref(titles[3]).roleId]).length,1);
 assert.deepEqual(profile.positions,titles.slice(0,4));
});
test('an explicit additional slot is required for four, but optional for three',()=>{
 assert.equal(profileOccupationFocusError({...profile,crew:{...profile.crew,additionalOccupation:null}}),'additionalRequired');
 assert.equal(profileOccupationFocusError({positions:titles.slice(0,3),crew:{primaryOccupation:ref(titles[0])}}),null);
 assert.equal(profileOccupationFocusError({positions:titles,crew:{...profile.crew,occupations:titles.map(ref)}}),'limit');
 assert.equal(profileOccupationFocusError({positions:titles.slice(0,2),crew:{}}),'mainRequired');
});
test('additional cannot be the main job, an unselected job or an array of jobs',()=>{
 for(const additionalOccupation of [ref(titles[0]),ref(titles[4]),[ref(titles[3])],{roleId:'invalid',departmentId:'invalid'}])assert.equal(profileOccupationFocusError({...profile,crew:{...profile.crew,additionalOccupation}}),'invalidAdditional');
 for(const positions of ['Gaffer',[null],[''],[1]])assert.equal(profileOccupationFocusError({positions}),'invalidSelection');
});
test('main is first regardless of saved ordering, and extra is excluded even before fourth position',()=>{
 const changed={...profile,positions:[titles[3],titles[2],titles[1],titles[0]]};
 assert.deepEqual(profileOccupationPreview(changed),[titles[0],titles[2],titles[1]]);
});
test('legacy occupations survive unrelated edits and normalization without silently deleting extras',()=>{
 const previous={positions:titles,role:titles[0],crew:{certificates:['kept']}};
 const edited={positions:[titles[0],...titles.slice(1).reverse()],role:titles[0],crew:{primaryOccupation:ref(titles[0]),occupations:titles.map(ref),additionalOccupation:null}};
 assert.equal(profileOccupationsUnchanged(edited,previous),true);assert.equal(profileOccupationFocusError(edited,previous),null);
 assert.equal(profileOccupationFocusError({...edited,crew:{...edited.crew,primaryOccupation:ref(titles[1])}},previous),'limit');
 const unresolved={positions:['Historical job',...titles],crew:{}};
 assert.equal(profileOccupationFocusError({...unresolved,crew:{primaryOccupation:null,occupations:titles.map(ref)}},unresolved),null);
 assert.equal(unresolved.positions.length,6);
});
test('an additional role with a repeated title does not hide a different selected job with the same label',()=>{
 const repeated=occupationCatalogue.find(candidate=>candidate.label!==titles[0]&&occupationCatalogue.some(other=>other.label===candidate.label&&other.roleId!==candidate.roleId));
 assert.ok(repeated,'catalogue must contain a repeated title for this case');
 const matches=occupationChoices([repeated.label]).filter(o=>o.label===repeated.label);
 assert.ok(matches.length>=2);
 const p={positions:[repeated.label,titles[0]],crew:{occupations:[...matches.slice(0,2),ref(titles[0])],primaryOccupation:ref(titles[0]),additionalOccupation:occupationReference(matches[0])}};
 assert.ok(profileOccupationPreview(p).includes(repeated.label));
});
test('resumable setup keeps all four choices and their explicit slots',()=>{
 const roles=titles.slice(0,4).map(title=>({departmentId:ref(title).departmentId,role:title}));
 const d={...structuredClone(START_QUICK_START_DRAFT),step:'review',name:'Example Person',personCity:'München',intents:['crew'],primaryOccupation:ref(titles[0]),additionalOccupation:ref(titles[3]),sections:{crew:{...createQuickStartIntentData(),roles,departmentIds:[...new Set(roles.map(r=>r.departmentId))]}}};
 const restored=normalizeQuickStartDraft(JSON.parse(JSON.stringify(d)));
 assert.deepEqual(restored.additionalOccupation,d.additionalOccupation);assert.equal(restored.sections.crew.roles.length,4);assert.equal(validateQuickStartDraft(restored),null);
 const noExtra={...restored,additionalOccupation:null};assert.equal(validateQuickStartDraft(noExtra)?.field,'primaryOccupation');assert.equal(validateQuickStartDraft(noExtra,{requirePrimary:false}),null);
 const removed=normalizeQuickStartDraft({...restored,sections:{crew:{...restored.sections.crew,roles:roles.slice(0,3)}}});
 assert.equal(removed.additionalOccupation,null);assert.equal(removed.sections.crew.roles.length,3);
});
test('older wizard clears a removed additional job without dropping the remaining selections',()=>{
 const draft=normalizeGuidedProfileDraft({positions:titles.slice(0,4),departmentIds:['licht','produktion'],primaryOccupation:ref(titles[0]),additionalOccupation:ref(titles[3])});
 assert.deepEqual(draft.additionalOccupation,ref(titles[3]));
 const removed=removeGuidedDepartment(draft,'produktion');
 assert.equal(removed.additionalOccupation,null);assert.deepEqual(removed.positions,titles.slice(0,3));
});
