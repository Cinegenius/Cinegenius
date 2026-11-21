import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNewsGallery,newsGalleryImages,newsCreditUrl,newsPreviewImage} from './news-gallery.ts';
import {readershipWindow,newsReadershipQuery,parseReadershipResponse,readershipSignals} from './news-readership.ts';
const id='11111111-1111-4111-8111-111111111111';
const photo={url:'/api/media/editor/'+'1'.repeat(32)+'.jpg',altText:'Archive photograph',creator:'Photographer',sourceUrl:'https://commons.wikimedia.org/wiki/File:Portrait.jpg',licenseName:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',changes:'Unchanged',caption:'Archive: San Diego, 12 July 2012',imageTitle:'Original title',attribution:'Full attribution',credit:'Full credit'};
test('home preview uses a real cover or the first valid gallery image with its original credits',()=>{
 const gallery=[{...photo,url:'https://unreviewed.test/file.jpg'},photo];
 const original=structuredClone(gallery);
 assert.deepEqual(newsPreviewImage(null,gallery),photo);
 assert.deepEqual(newsPreviewImage(photo.url,gallery),photo);
 assert.deepEqual(newsPreviewImage('/legacy-cover.jpg',gallery),{url:'/legacy-cover.jpg'});
 assert.equal(newsPreviewImage(null,[]),null);
 assert.equal(newsPreviewImage(null,[{...photo,creator:''}]),null);
 assert.equal(newsPreviewImage(null,null),null);
 assert.deepEqual(gallery,original,'preview never changes stored image/credit data');
});
test('gallery validates credits without rewriting canonical sources or accepting private link credentials',()=>{
 assert.deepEqual(parseNewsGallery([photo]),[photo]);assert.equal(parseNewsGallery([{...photo,licenseUrl:undefined}])[0].licenseUrl,'');
 for(const patch of [{creator:''},{caption:'a'.repeat(801)},{altText:5},{url:'https://public.test/remote.jpg'},{url:photo.url+'?token=abc'},{sourceUrl:'https://user:pass@example.org/a'},{sourceUrl:'https://example.org/?token=secret'},{sourceUrl:'http://example.org/a'},{licenseUrl:'javascript:alert(1)'}])assert.equal(parseNewsGallery([{...photo,...patch}]),null,JSON.stringify(patch));
 assert.equal(parseNewsGallery([photo,photo]),null);assert.equal(parseNewsGallery(Array(9).fill(photo)),null);assert.deepEqual(parseNewsGallery([]),[]);
 for(const url of ['https://localhost/a','https://foo.internal/a','https://127.0.0.1/a'])assert.equal(newsCreditUrl(url),null);
 assert.equal(newsGalleryImages('/legacy.jpg',[])[0].creator,undefined);assert.equal(newsGalleryImages(photo.url,[photo]).length,1);
});
test('readership uses a fixed completed UTC window and rejects arbitrary query input',()=>{
 const w=readershipWindow(new Date('2026-11-21T16:30:00Z'));assert.deepEqual(w,{from:'2026-10-24T00:00:00.000Z',until:'2026-11-21T00:00:00.000Z',timeZone:'UTC'});
 const q=newsReadershipQuery([id],w);assert.match(q,/countIf/);assert.doesNotMatch(q,/distinct_id|person_id|\$current_url|SELECT \*/);assert.throws(()=>newsReadershipQuery(["x'); DROP TABLE events"],w));assert.throws(()=>newsReadershipQuery(Array(101).fill(id),w));
});
test('malformed, partial, pending and foreign response rows never become zero popularity',()=>{
 assert.deepEqual(parseReadershipResponse({results:[]},[id]),[]);assert.deepEqual(parseReadershipResponse({results:[[id,23,7]]},[id]),[{id,impressions:23,views:7}]);
 for(const value of [null,{}, {results:[[id,-1,3]]},{results:[[id,'23',4]]},{results:[[id,2,4.1]]},{results:[['foreign',20,5]]},{results:[[id,20,5],[id,21,5]]},{results:[],hasMore:true},{results:[],is_partial:true},{results:[],error:'failure'},{results:[],query_status:{complete:false}}])assert.equal(parseReadershipResponse(value,[id]),null);
});
test('small counts stay suppressed and neither zero data nor recent articles claim successful learning',()=>{
 const entry={id,topic:'technology',published_at:'2026-11-18T00:00:00Z',created_at:'2026-11-18T00:00:00Z'},now=new Date('2026-11-21T00:00:00Z');
 assert.deepEqual(readershipSignals([entry],[],now)[0],{id,topic:'technology',state:'cold_start',impressions:null,views:null,learningEligible:false});
 assert.equal(readershipSignals([entry],[{id,impressions:19,views:4}],now)[0].impressions,null);
 assert.equal(readershipSignals([entry],[{id,impressions:20,views:5}],now)[0].learningEligible,true);
 assert.equal(readershipSignals([{...entry,published_at:now.toISOString()}],[{id,impressions:20,views:5}],now)[0].learningEligible,false);
});
