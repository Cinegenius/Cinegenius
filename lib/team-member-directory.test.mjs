import test from 'node:test';
import assert from 'node:assert/strict';
import {teamMemberDirectory,TEAM_MEMBER_PAGE_SIZE} from './team-member-directory.ts';
const member=(name,index,status='active')=>({userId:`person_${index}`,name,status,role:'member'});
test('a long directory bounds each status independently and keeps invitations reachable',()=>{
 const members=Array.from({length:500},(_,i)=>member(`Person ${500-i}`,i));members.push(member('Zoë Einladung',501,'invited'));
 const before=structuredClone(members),result=teamMemberDirectory(members,'','de');
 assert.equal(result.active.total,500);assert.equal(result.active.visible.length,TEAM_MEMBER_PAGE_SIZE);
 assert.equal(result.invited.visible[0].name,'Zoë Einladung');assert.equal(result.hasMore,true);assert.deepEqual(members,before);
 assert.deepEqual(result.active.visible.slice(0,3).map(m=>m.name),['Person 1','Person 2','Person 3']);
 assert.equal(teamMemberDirectory(members,'','de',60).active.visible.length,60);
 assert.equal(teamMemberDirectory(members,'','de',510).hasMore,false);
});
test('search covers names outside the initial page, normalizes accents, and preserves scripts',()=>{
 const members=[...Array.from({length:500},(_,i)=>member(`Anna ${i}`,i)),member('Zoë Müller',501),member('Ірина Коваль',502),member('山田 太郎',503)];
 assert.deepEqual(teamMemberDirectory(members,' ZOE MULLER ','de').active.visible.map(m=>m.userId),['person_501']);
 assert.equal(teamMemberDirectory(members,'Коваль','uk').active.total,1);
 assert.equal(teamMemberDirectory(members,'山田','ja').active.total,1);
 assert.equal(teamMemberDirectory(members,'missing','en').active.total,0);
});
test('sorting follows locale and ties remain deterministic across server refreshes',()=>{
 const members=[member('Östen',1),member('Zara',2),member('Anna',3),member('Anna',0)];
 const swedish=teamMemberDirectory(members,'','sv').active.visible;
 assert.deepEqual(swedish.map(m=>m.userId),['person_0','person_3','person_2','person_1']);
 assert.deepEqual(teamMemberDirectory([...members].reverse(),'','sv').active.visible,swedish);
});
