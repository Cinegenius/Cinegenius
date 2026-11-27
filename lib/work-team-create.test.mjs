import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamWithPeople,emptyTeamCreation,restoreTeamCreation} from './work-team-create.ts';
import {mergeFormDraft} from './form-draft.ts';

const id='10000000-0000-4000-8000-000000000001',channel='20000000-0000-4000-8000-000000000001';
const initial=()=>({...emptyTeamCreation(),name:'Filmteam',people:[{id:'person_a',name:'A'},{id:'person_b',name:'B'}]});
function fixture({uncertain,saveFailure=false,switchAfter,denied=false,conflict=false,existing=false}={}) {
 let durable=initial(),live=true,revision=1,serial=0,failed=false,teams=0,channels=0,role=denied?'member':'admin';
 const ops=new Map(),writes=[],members=[{userId:'actor',status:'active'},...(existing?[{userId:'person_a',status:'invited'}]:[])];
 const ports={accountId:'actor',current:()=>live,key:()=>`request_${++serial}`,
  persist:async value=>{if(saveFailure)throw Error('save failed');durable=structuredClone(value);},
  read:async()=>({accountId:'actor',id,revision,role,members:structuredClone(members)}),
  write:async op=>{
   assert.deepEqual(durable.pending,op,'the exact payload must already be durable');writes.push(structuredClone(op));
   const fingerprint=JSON.stringify(op),prior=ops.get(op.p.key);
   if(prior){assert.equal(prior.fingerprint,fingerprint);return prior.result;}
   if(conflict&&op.action==='invite'&&!failed){failed=true;revision++;throw Object.assign(Error('changed'),{status:409});}
   if(op.action==='create_team')teams++;
   else {assert.equal(op.p.revision,revision);revision++;if(op.action==='create_channel')channels++;else members.push({userId:op.p.userId,status:'invited'});}
   const result={teamId:id,...(op.action==='create_channel'?{channelId:channel}:{})};ops.set(op.p.key,{fingerprint,result});
   if(switchAfter===op.action)live=false;
   if(uncertain===op.action&&!failed){failed=true;throw Error('connection lost after commit');}
   return result;
  }};
 return {ports,get durable(){return structuredClone(durable);},get teams(){return teams;},get channels(){return channels;},writes,members};
}
test('contact-first creation creates one team, a named chat, and pending invitations only',async()=>{
 const f=fixture();assert.equal(await createTeamWithPeople(initial(),f.ports),id);
 assert.equal(f.teams,1);assert.equal(f.channels,1);assert.equal(f.members.filter(m=>m.status==='invited').length,2);
 assert.deepEqual(f.writes.map(op=>op.action),['create_team','create_channel','invite','invite']);
 assert.equal(f.durable.pending,null);assert.equal(f.durable.step,4);
});
for(const action of ['create_team','create_channel','invite'])test(`explicit retry after an uncertain ${action} acknowledgement does not duplicate it`,async()=>{
 const f=fixture({uncertain:action});await assert.rejects(createTeamWithPeople(initial(),f.ports),/connection lost/);
 const saved=f.durable;assert.equal(saved.pending.action,action);
 assert.equal(await createTeamWithPeople(restoreTeamCreation(saved),f.ports),id);
 assert.equal(f.teams,1);assert.equal(f.channels,1);assert.equal(f.members.filter(m=>m.status==='invited').length,2);
 const same=f.writes.filter(op=>op.p.key===saved.pending.p.key);assert.equal(same.length,2);assert.deepEqual(same[0],same[1]);
});
test('private recovery outage prevents the first team write',async()=>{
 const f=fixture({saveFailure:true});await assert.rejects(createTeamWithPeople(initial(),f.ports),/save failed/);assert.equal(f.writes.length,0);
});
test('a pending operation left only in memory by a failed save is saved again before retry can write',async()=>{
 const f=fixture(),persist=f.ports.persist;let failed=false,unconfirmed;
 f.ports.persist=async value=>{if(value.pending&&!failed){failed=true;unconfirmed=structuredClone(value);throw Error('save failed');}await persist(value);};
 await assert.rejects(createTeamWithPeople(initial(),f.ports),/save failed/);assert.equal(f.writes.length,0);
 await createTeamWithPeople(unconfirmed,f.ports);assert.equal(f.teams,1);assert.equal(f.channels,1);
});
test('account/container/source loss after an acknowledgement stops further writes',async()=>{
 for(const action of ['create_team','create_channel','invite']){const f=fixture({switchAfter:action});await assert.rejects(createTeamWithPeople(initial(),f.ports),/session_changed/);assert.equal(f.writes.at(-1).action,action);assert.ok(f.durable.pending);}
});
test('fresh server membership and admin rights are checked before subsequent writes',async()=>{
 const f=fixture({denied:true});await assert.rejects(createTeamWithPeople(initial(),f.ports),/session_changed/);assert.deepEqual(f.writes.map(op=>op.action),['create_team']);
});
test('a confirmed revision conflict is retried only explicitly with fresh rights and payload',async()=>{
 const f=fixture({conflict:true});await assert.rejects(createTeamWithPeople(initial(),f.ports),/changed/);assert.equal(f.durable.pending,null);const rejected=f.writes.at(-1);
 await createTeamWithPeople(f.durable,f.ports);const retried=f.writes.find(op=>op.action==='invite'&&op.p.userId===rejected.p.userId&&op.p.key!==rejected.p.key);
 assert.ok(retried);assert.ok(retried.p.revision>rejected.p.revision);assert.equal(f.teams,1);
});
test('freshly invited or active selected members are not invited again',async()=>{
 const f=fixture({existing:true});await createTeamWithPeople(initial(),f.ports);assert.deepEqual(f.writes.filter(op=>op.action==='invite').map(op=>op.p.userId),['person_b']);
});
test('old name-only pending team creation keeps its exact key on recovery',()=>{
 const pendingAction={action:'create_team',p:{name:'Old team',key:'old_request_123'}};
 const recovered=mergeFormDraft({...emptyTeamCreation(),pendingAction:null},{name:'Old team',pendingAction});
 assert.deepEqual(restoreTeamCreation(recovered),{...emptyTeamCreation(),name:'Old team',pending:pendingAction});
 const forged={...initial(),teamId:id,step:2,pending:{action:'invite',p:{teamId:id,revision:1,key:'fixture_key',userId:'another_user'}}};
 assert.equal(restoreTeamCreation(forged).pending,null);
});
