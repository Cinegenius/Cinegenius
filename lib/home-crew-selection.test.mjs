import test from 'node:test';
import assert from 'node:assert/strict';
import {orderHomeCrew,HOME_CREW_NEW_WINDOW_MS as day,HOME_CREW_ROTATION_MS as interval} from './home-crew-selection.ts';
const now=Date.parse('2026-11-20T12:00:00Z');
const row=(id,age)=>({user_id:id,created_at:new Date(now-age).toISOString()});
test('new members have chronological priority for exactly 24 hours',()=>{
 const rows=[row('old',day+1),row('recent',1000),row('newest',0),row('last-second',day-1),row('expired',day)];
 const ordered=orderHomeCrew(rows,now).map(p=>p.user_id);
 assert.deepEqual(ordered.slice(0,3),['newest','recent','last-second']);
 assert.deepEqual(new Set(ordered.slice(3)),new Set(['old','expired']));
 const expired=orderHomeCrew(rows,now+day).map(p=>p.user_id);
 assert.deepEqual(new Set(expired),new Set(rows.map(p=>p.user_id)));
});
test('older profiles rotate without mutating records, and remain stable during a time window',()=>{
 const rows=Array.from({length:40},(_,i)=>row(`old-${i}`,day*100+i));const before=JSON.stringify(rows);
 const ids=time=>orderHomeCrew(rows,time).map(p=>p.user_id);
 assert.deepEqual(ids(now),ids(now+interval-1));assert.notDeepEqual(ids(now),ids(now+interval));
 assert.deepEqual(ids(now),orderHomeCrew([...rows].reverse(),now).map(p=>p.user_id));assert.equal(JSON.stringify(rows),before);
 const seen=new Set();for(let i=0;i<96;i++)for(const id of ids(now+i*interval).slice(0,10))seen.add(id);
 assert.equal(seen.size,40);
});
test('bad and future dates do not get new-member priority; duplicate identities are removed',()=>{
 const rows=[{user_id:'invalid',created_at:'not-a-date'},{user_id:'missing'},row('future',-1),row('new',10),row('new',100),{user_id:''}];
 const out=orderHomeCrew(rows,now);assert.equal(out[0].user_id,'new');assert.equal(out.length,4);assert.equal(new Set(out.map(p=>p.user_id)).size,4);
 assert.deepEqual(orderHomeCrew([],now),[]);
});
