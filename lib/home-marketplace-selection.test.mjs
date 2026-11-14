import test from 'node:test';
import assert from 'node:assert/strict';
import {selectHomeMarketplace} from './home-marketplace-selection.ts';
import {marketplaceFixture} from './home-marketplace-fixture.mjs';
const interval=15*60*1000;
test('home offers mix categories, stay stable in a visit and rotate older as well as new offers',()=>{
 const rows=Array.from({length:18},(_,i)=>({id:String(i),type:i%3===0?'vehicle':'prop',category:String(i%3)})),original=JSON.stringify(rows);
 const selected=selectHomeMarketplace(rows,interval*93);
 assert.equal(selected.length,4);assert.equal(new Set(selected.map(r=>r.category)).size,3);
 assert.deepEqual(selectHomeMarketplace(rows,interval*93+60000),selected);
 assert.notDeepEqual(selectHomeMarketplace(rows,interval*94).map(r=>r.id),selected.map(r=>r.id));
 const shown=new Set(Array.from({length:30},(_,i)=>selectHomeMarketplace(rows,interval*i)).flat().map(r=>r.id));
 assert.equal(shown.size,rows.length);assert.equal(JSON.stringify(rows),original);
});
test('a rotating single slot does not starve offers when group and item counts share a divisor',()=>{
 const rows=Array.from({length:8},(_,i)=>({id:String(i),type:'prop',category:String(i%2)}));
 assert.equal(new Set(Array.from({length:16},(_,i)=>selectHomeMarketplace(rows,interval*i,1)).flat().map(r=>r.id)).size,8);
 assert.deepEqual(selectHomeMarketplace([],0),[]);
 assert.deepEqual(selectHomeMarketplace([rows[0],rows[0]],0),[rows[0]]);
});
test('selection exhausts lean public pages and rechecks publication before card data',async()=>{
 const rows=Array.from({length:301},(_,i)=>({id:String(i).padStart(4,'0'),type:'prop',category:i%2?'camera':'costume',published:true}));
 rows.push({id:'private',published:false,type:'prop',category:'private'});
 const calls=[];let withdrawn;
 const db={from(table){assert.equal(table,'listings');const filters=[];let fields,from=0,to=Infinity;const q={
  select(value){fields=value;return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},eq(k,v){filters.push(r=>r[k]===v);return q},order(){return q},range(a,b){from=a;to=b;return q},
  then(done){calls.push(fields);if(fields.includes('title')){withdrawn=rows[0].id;rows[0].published=false;}
   return Promise.resolve({data:rows.filter(r=>filters.every(fn=>fn(r))).slice(from,to+1),error:null}).then(done)}
 };return q}};
 const result=await marketplaceFixture(db).homeMarketplaceOffers(0);
 assert.equal(calls.filter(c=>c==='id,type,category').length,2);
 assert.equal(result.data.some(r=>r.id===withdrawn||r.id==='private'),false);
 assert.ok(result.data.every(r=>r.published));
 const fail=marketplaceFixture({from:()=>({select(){return this},in(){return this},eq(){return this},order(){return this},range:async()=>({data:null,error:new Error('offline')})})});
 await assert.rejects(fail.homeMarketplaceOffers(0));
});
