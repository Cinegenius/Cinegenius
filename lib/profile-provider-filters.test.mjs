import test from 'node:test';
import assert from 'node:assert/strict';
import {filterProviderProfiles,isPeopleDirectoryProfile,LOCATION_PROVIDER_FILTER as locations,MARKETPLACE_PROVIDER_FILTER as marketplace} from './profile-provider-filters.ts';
import {filterCrewOccupations,crewOccupationIds} from './crew-occupations.ts';
const data=[
 {id:'place',profile_types:['location']}, {id:'studio',profile_type:'studio'},
 {id:'gear',profile_types:['equipment']}, {id:'car',profile_type:'vehicle'},
 {id:'props',profile_types:['props']}, {id:'both',profile_types:['location','vehicle','lighting'],positions:['Lichtassistent*in']},
 {id:'light',profile_types:['lighting'],positions:['Lichtassistent*in']},
];
test('location and marketplace entries filter people by declared provider roles and preserve mixed profiles',()=>{
 assert.deepEqual(filterProviderProfiles(data,locations).map(p=>p.id),['place','studio','both']);
 assert.deepEqual(filterProviderProfiles(data,marketplace).map(p=>p.id),['gear','car','props','both']);
 assert.deepEqual(filterProviderProfiles(data,'wrong'),[]);
 assert.ok(data.every(isPeopleDirectoryProfile));
 assert.equal(isPeopleDirectoryProfile({positions:[],profile_types:[]}),false);
});
test('provider membership does not create a crew job and other filters still intersect',()=>{
 const profiles=data.map(profile=>({...profile,occupationIds:crewOccupationIds(profile)}));
 assert.deepEqual(filterCrewOccupations(profiles,'licht').map(p=>p.id),['both','light']);
 assert.deepEqual(filterProviderProfiles(profiles.filter(p=>p.id==='car'),locations),[]);
 assert.equal(new Set(profiles.map(p=>p.id)).size,profiles.length);
});
