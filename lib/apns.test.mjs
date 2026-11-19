import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { createApnsRequestBuilder, apnsResponseResult, validApnsDeviceToken } from './apns.ts';

// Disposable signing material, generated in memory. No env, credentials, provider or device contact.
const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const config={teamId:'AAAAAAAAAA',keyId:'BBBBBBBBBB',privateKey:pair.privateKey.export({type:'pkcs8',format:'pem'}),bundleId:'co.cinegenius.app.preview',environment:'sandbox'};
const now=Date.parse('2026-11-19T01:00:00Z');
const delivery={id:'00000000-0000-4000-8000-000000000001',deviceToken:'ab'.repeat(32),body:'Generic notification',destination:'messages',expiresAt:now+60*60_000};

test('provider JWT is a valid ES256 signature with Apple claims and the configured topic',()=>{
 const request=createApnsRequestBuilder(config,()=>now)(delivery);
 const [header,claims,signature]=request.headers.authorization.slice(7).split('.');
 assert.deepEqual(JSON.parse(Buffer.from(header,'base64url')),{alg:'ES256',kid:config.keyId});
 assert.deepEqual(JSON.parse(Buffer.from(claims,'base64url')),{iss:config.teamId,iat:now/1000});
 assert.equal(Buffer.from(signature,'base64url').length,64);
 assert.equal(verify('sha256',Buffer.from(header+'.'+claims),{key:pair.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')),true);
 assert.equal(request.endpoint,'https://api.sandbox.push.apple.com');
 assert.equal(request.headers['apns-topic'],config.bundleId);
 assert.equal(request.headers['apns-push-type'],'alert');
 assert.equal(request.headers['apns-expiration'],String(delivery.expiresAt/1000));
});
test('one bounded provider token is reused and refreshed after fifty minutes',()=>{
 let clock=now;const build=createApnsRequestBuilder(config,()=>clock);
 const first=build(delivery).headers.authorization;
 clock+=21*60_000;assert.equal(build(delivery).headers.authorization,first);
 clock=now+50*60_000;assert.notEqual(build(delivery).headers.authorization,first);
});
test('expired notifications do not produce a provider request; malformed targets and overlong retention fail closed',()=>{
 const build=createApnsRequestBuilder(config,()=>now);
 assert.equal(build({...delivery,expiresAt:now}),null);
 for(const invalid of [{id:'other/path'},{deviceToken:'ab/00'},{destination:'https://evil.invalid'},{body:''},{expiresAt:now+25*60*60_000}]) assert.throws(()=>build({...delivery,...invalid}),/apns_invalid_delivery/);
 assert.equal(validApnsDeviceToken('AB'.repeat(16)),true);
 assert.equal(validApnsDeviceToken('ab'.repeat(64)),true);
 assert.equal(validApnsDeviceToken('abc'),false);
 assert.equal(validApnsDeviceToken('ab'.repeat(513)),false);
});
test('only closed navigation and generic alert copy leave the provider boundary',()=>{
 const request=createApnsRequestBuilder({...config,environment:'production'},()=>now)({...delivery,conversationId:'PRIVATE_CANARY',accountId:'PRIVATE_CANARY',message:'PRIVATE_CANARY'});
 assert.equal(request.endpoint,'https://api.push.apple.com');
 assert.deepEqual(JSON.parse(request.body),{aps:{alert:{title:'CineGenius',body:'Generic notification'},sound:'default'},cg_destination:'messages'});
 assert.ok(!request.body.includes('PRIVATE_CANARY'));
 assert.ok(Buffer.byteLength(request.body)<4096);
});
test('provider acceptance is distinct from delivery, invalid devices and temporary failures',()=>{
 assert.deepEqual(apnsResponseResult({status:200,requestId:delivery.id},delivery.id),{kind:'accepted'});
 assert.equal(apnsResponseResult({status:200,requestId:'wrong'},delivery.id).kind,'retry');
 assert.deepEqual(apnsResponseResult({status:410,timestamp:now},delivery.id),{kind:'invalid-device',invalidSince:now});
 assert.equal(apnsResponseResult({status:400,reason:'BadDeviceToken'},delivery.id).kind,'invalid-device');
 assert.equal(apnsResponseResult({status:403,reason:'ExpiredProviderToken'},delivery.id).kind,'configuration');
 assert.deepEqual(apnsResponseResult({status:503},delivery.id),{kind:'retry',retryAfterMs:15*60_000});
 assert.equal(apnsResponseResult({status:413},delivery.id).kind,'rejected');
});
test('configuration validation does not accept arbitrary endpoints, algorithms or invalid signing keys',()=>{
 for(const invalid of [{environment:'http://example.invalid'},{teamId:'invalid'},{bundleId:'bad/path'},{privateKey:'not a key'}]) assert.throws(()=>createApnsRequestBuilder({...config,...invalid}),/apns_configuration/);
});
