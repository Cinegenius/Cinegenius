import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readdirSync} from 'node:fs';
import {staticImagePatterns,PUBLIC_SUPABASE_IMAGE_PATTERNS} from './image-optimization-policy.ts';
const require=createRequire(import.meta.url);
const {hasLocalMatch}=require('next/dist/shared/lib/match-local-pattern');
const {hasRemoteMatch}=require('next/dist/shared/lib/match-remote-pattern');
test('platform-level image policy permits existing static assets but no protected or community API variants',()=>{
 const files=readdirSync(new URL('../public',import.meta.url),{recursive:true,encoding:'utf8'}),patterns=staticImagePatterns(files);
 for(const file of files.filter(f=>/\.(avif|webp|png|jpe?g|gif|svg|ico)$/i.test(f)))assert.equal(hasLocalMatch(patterns,'/'+file),true);
 assert.equal(hasLocalMatch(patterns,'/_next/static/media/own-fixture.hash.png'),true);
 for(const path of ['/api/media/owner/file.webp','/api/media/owner/file.webp?size=thumbnail','/api/community-image?image=private','/api/community-image','/api//community-image','/api/test/../community-image','/%61pi/media/owner/file.webp'])assert.equal(hasLocalMatch(patterns,path),false);
});
test('remote image policy allows public Storage originals and transforms but rejects private, signed and authenticated URLs',()=>{
 const origin='https://own-fixture.supabase.co/storage/v1/';
 for(const path of ['object/public/listing-images/test.webp','render/image/public/listing-images/test.webp?width=200'])assert.equal(hasRemoteMatch([],PUBLIC_SUPABASE_IMAGE_PATTERNS,new URL(origin+path)),true);
 for(const path of ['object/sign/protected-media/test.webp?token=private','object/authenticated/protected-media/test.webp','render/image/sign/protected-media/test.webp?token=private'])assert.equal(hasRemoteMatch([],PUBLIC_SUPABASE_IMAGE_PATTERNS,new URL(origin+path)),false);
});
