import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EDITORIAL_ACTOR, editorialCredentialValid, editorialRouteAllowed } from './editorial-agent-policy.ts';
const token='cge_'+'a'.repeat(64), digest=createHash('sha256').update(token).digest('hex');
test('editorial access needs the exact machine key and an explicit global activation',()=>{
 assert.equal(EDITORIAL_ACTOR,'cinegenius-editorial');assert.equal(editorialCredentialValid('Bearer '+token,'true',digest),true);
 for(const enabled of [undefined,'false','1','TRUE'])assert.equal(editorialCredentialValid('Bearer '+token,enabled,digest),false);
 for(const auth of [null,'','Bearer support','Bearer '+token+'x','Basic '+token,'Bearer '+'cge_'+'b'.repeat(64)])assert.equal(editorialCredentialValid(auth,'true',digest),false);
 for(const hash of [undefined,'','0'.repeat(63),digest.toUpperCase()])assert.equal(editorialCredentialValid('Bearer '+token,'true',hash),false);
});
test('the machine route allowlist cannot reach admin, accounts, profiles, or destructive actions',()=>{
 for(const [path,method] of [['/api/editorial/entries','GET'],['/api/editorial/entries','POST'],['/api/editorial/entries/moderation','POST'],['/api/editorial/upload','POST'],['/api/editorial/media','GET'],['/api/editorial/organizations','GET']])assert.equal(editorialRouteAllowed(path,method),true);
 for(const path of ['/api/admin/organizations','/api/editorial/entries/delete','/api/editorial/organizations/new','/api/editorial/entries/','/api/editorialx/entries','toString','__proto__','/api/profile'])for(const method of ['GET','POST','DELETE'])assert.equal(editorialRouteAllowed(path,method),false);
 for(const method of ['DELETE','PATCH','PUT'])assert.equal(editorialRouteAllowed('/api/editorial/entries',method),false);
});

test('official article query parameters survive while private and tracking parameters do not',async()=>{
 const {editorialSourceUrl}=await import('./editorial-agent-policy.ts');
 assert.equal(editorialSourceUrl('https://www.ffa.de/detail.html?meldung=film-news&utm_source=test#article'),'https://www.ffa.de/detail.html?meldung=film-news');
 for(const url of ['http://example.org/news','https://user:password@example.org/news','https://127.0.0.1/news','https://example.internal/news','https://example.org/?access_token=secret','https://example.org/?%65mail=private'])assert.equal(editorialSourceUrl(url),null);
});
