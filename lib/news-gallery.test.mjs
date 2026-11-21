import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNewsGallery,newsGalleryImages,newsCreditUrl,newsPreviewImage} from './news-gallery.ts';
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
