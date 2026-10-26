import test from 'node:test';
import assert from 'node:assert/strict';
import { occupationCatalogue, occupationReference, occupationChoices } from './primary-occupation.ts';
import { crewOccupationIds, selectedCrewOccupations, filterCrewOccupations, crewOccupationsError } from './crew-occupations.ts';
const ref=(dept,title)=>occupationReference(occupationChoices([title]).find(o=>o.departmentId===dept));
const profile=(id,positions,crew={})=>({id,positions,crew,occupationIds:crewOccupationIds({positions,crew})});

test('every explicitly selected job contributes to its department and subfilter, regardless of main job',()=>{
 const p=profile('mixed',['Gaffer (Oberbeleuchter)','Lichtassistent*in','Tonassistenz','Key Grip'],{primaryOccupation:ref('licht','Gaffer (Oberbeleuchter)')});
 for(const [dept,title] of [['licht','Lichtassistent*in'],['ton','Tonassistenz'],['grip','Key Grip']]){
  assert.equal(filterCrewOccupations([p],dept).length,1);
  assert.equal(filterCrewOccupations([p],dept,[ref(dept,title).roleId]).length,1);
 }
 assert.equal(filterCrewOccupations([p],'kamera').length,0);
 assert.equal(filterCrewOccupations([p],'licht',[ref('ton','Tonassistenz').roleId]).length,0);
 assert.equal(filterCrewOccupations([p],null).length,1);
});

test('legacy Ian and mixed-department cases retain all exact selected roles without a main job',()=>{
 const ian=profile('ian',['Beleuchter (Electrician)','Lighting Programmer (DMX)','Lichtpult Assistent*in','Lichtpult Operator']);
 for(const title of ian.positions)assert.equal(filterCrewOccupations([ian],'licht',[title]).length,1);
 assert.equal(filterCrewOccupations([ian],'licht',['Gaffer']).length,0);
 const mixed=profile('mixed',['Beleuchter (Electrician)','Key Grip','2nd AC (Clapper / Loader)']);
 for(const dept of ['licht','grip','kamera'])assert.equal(filterCrewOccupations([mixed],dept).length,1);
});

test('type labels, biographies, unknown text and word fragments never become extra occupations',()=>{
 assert.deepEqual(crewOccupationIds({positions:[],role:'Licht'}),[]);
 assert.deepEqual(crewOccupationIds({positions:['Kamera','Unbekannt']}),[]);
 const profile= {positions:['Beleuchter (Electrician)'],profile_types:['lighting'],bio:'Tonassistenz'};
 assert.equal(crewOccupationIds(profile).length,1);
 assert.equal(filterCrewOccupations([{occupationIds:crewOccupationIds(profile)}],'licht',['Gaffer']).length,0);
 assert.equal(filterCrewOccupations([{occupationIds:crewOccupationIds(profile)}],'ton').length,0);
});

test('all selectable catalogue jobs survive roundtrip with their actual department reference',()=>{
 for(const option of occupationCatalogue){
  const crew={occupations:[occupationReference(option)]};
  const p=profile(option.roleId,[option.label],crew);
  assert.deepEqual(p.occupationIds,[option.roleId]);
  assert.equal(filterCrewOccupations([p],option.departmentId,[option.roleId]).length,1);
  assert.equal(crewOccupationsError(crew,p.positions),null);
 }
});

test('same title in multiple departments uses saved group selection, never a guessed second group',()=>{
 const duplicates=occupationCatalogue.filter(o=>o.label==='Playback Operator');assert.ok(duplicates.length>=2);
 for(const option of duplicates){
  const p=profile('playback',[option.label],{occupations:[occupationReference(option)]});
  assert.equal(p.occupationIds.length,1);
  for(const other of duplicates)assert.equal(filterCrewOccupations([p],other.departmentId).length,other.departmentId===option.departmentId?1:0);
 }
});

test('adding, removing, primary changes and repeated filtering preserve only stored selections',()=>{
 let p=profile('edit',['Tonassistenz','Lichtassistent*in']);
 const reloaded=JSON.parse(JSON.stringify(p));
 assert.equal(filterCrewOccupations([reloaded],'ton',['Tonassistenz']).length,1);
 p=profile('edit',['Lichtassistent*in'],{primaryOccupation:ref('licht','Lichtassistent*in')});
 for(let i=0;i<12;i++){
  assert.equal(filterCrewOccupations([p],'ton').length,0);
  assert.equal(filterCrewOccupations([p],'licht').length,1);
  assert.equal(filterCrewOccupations([p],null).length,1);
 }
 assert.ok(crewOccupationsError({occupations:[ref('grip','Key Grip')]},['Tonassistenz']));
 assert.ok(crewOccupationsError({occupations:'wrong'},['Tonassistenz']));
 assert.deepEqual(selectedCrewOccupations(['Gaffer','Oberbeleuchter']).map(o=>o.roleId),[ref('licht','Gaffer').roleId]);
});


test('literal saved choices are not reassigned through aliases in another department',()=>{
 const light=profile('light',['Rigging Best Boy','Best Boy Electric']);
 assert.equal(filterCrewOccupations([light],'licht',['Rigging Best Boy']).length,1);
 assert.equal(filterCrewOccupations([light],'grip').length,0);
 for(const title of ['1. Filmtonassistent*in','Production Sound Mixer']){
  const sound=profile('sound',[title]);assert.ok(sound.occupationIds.length);assert.equal(filterCrewOccupations([sound],'ton',[title]).length,1);
 }
});
