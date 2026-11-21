import test from 'node:test';
import assert from 'node:assert/strict';
import { browsePublicEntries, parsePublicEntryFilters, publicEntryHref } from './public-organization-entries.ts';

const filters = query => parsePublicEntryFilters(new URLSearchParams(query));
const rows=Array.from({length:1007},(_,index)=>({id:String(index).padStart(4,'0'),title:`Cámara ${index}`,topic:'technology',entry_type:'news',place_country_code:'MX',external_url:'https://www.imcine.gob.mx/one',created_at:'2026-11-21T12:00:00Z'}));
test('public filters discard administrative state and safely round-trip real navigation',()=>{
 const parsed=filters('country=mx&status=hidden&publisher=secret&sort=oldest&page=2&type=workshop&topic=technology&source=IMCINE.GOB.MX&search=Cámara');
 assert.equal(publicEntryHref('/organizations/redaktion',parsed),'/organizations/redaktion?country=MX&topic=technology&type=workshop&source=imcine.gob.mx&search=C%C3%A1mara&sort=oldest&page=2');
 assert.deepEqual(filters(new URL(publicEntryHref('/organizations/redaktion',parsed),'https://test.invalid').search),parsed);
 assert.equal(publicEntryHref('/organizations/redaktion',filters('')),'/organizations/redaktion');
 assert.equal(filters('country=EU&topic=invalid&type=draft&page=-1').country,'');
 assert.equal(filters('topic=none').topic,'none');
 assert.equal(filters('page=Infinity').page,1000000);
});
test('all pages preserve deterministic tie order and count each entry exactly once',()=>{
 const seen=[];
 for(let page=1;page<=84;page++) {const result=browsePublicEntries([...rows,rows[0]],filters(`page=${page}`));assert.equal(result.total,1007);seen.push(...result.ids);}
 assert.equal(new Set(seen).size,1007);assert.equal(seen[0],'1006');assert.equal(seen.at(-1),'0000');
 assert.equal(browsePublicEntries(rows,filters('sort=oldest')).ids[0],'0000');
 assert.equal(browsePublicEntries(rows,filters('page=999')).page,84);
});
test('every facet count respects all other selected filters, and search is accent insensitive',()=>{
 const set=[rows[0],{...rows[1],place_country_code:'IT'},{...rows[2],topic:'funding'},{...rows[3],entry_type:'workshop'},{...rows[4],external_url:'https://arri.com/one'},{...rows[5],place_country_code:null,external_url:null}];
 const result=browsePublicEntries(set,filters('country=MX&topic=technology&type=news&source=imcine.gob.mx'));
 for(const values of Object.values(result.facets)) assert.equal(Object.getPrototypeOf(values),Object.prototype,'RSC client props require plain objects');
 assert.equal(result.total,1);assert.equal(result.facets.country.IT,1);assert.equal(result.facets.topic.funding,1);assert.equal(result.facets.type.workshop,1);assert.equal(result.facets.source['arri.com'],1);
 assert.equal(browsePublicEntries(set,filters('search=camara%20IMCINE')).total,4);
 assert.equal(browsePublicEntries(set,filters('country=none&source=none')).total,1);
 assert.equal(browsePublicEntries(set,filters('search=not-present')).total,0);
});
