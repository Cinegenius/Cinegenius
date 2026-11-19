import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as wire from './native-push.ts';
import * as apns from './apns.ts';
import * as locales from './i18n/locales.ts';
import {trustedMutationOrigin} from './request-origin.ts';
import {authorizedListingFreshnessCron} from './listing-freshness-cron-auth.ts';
const require=createRequire(import.meta.url);
export const pushInstall='00000000-0000-4000-8000-000000000001',pushRevision='00000000-0000-4000-8000-000000000002',pushLease='00000000-0000-4000-8000-000000000003';
export const pushProof=Buffer.alloc(32,7).toString('base64url'),pushToken='ab'.repeat(32);
export function pushFixture(options={}){
 const calls=[],scheduled=[],sends=[],sessions=[];
 const env={NODE_ENV:'test',CRON_SECRET:'own-worker-secret',...options.env};
 const configuration=options.configuration??{teamId:'ABCDEFGHIJ',keyId:'KLMNOPQRST',privateKey:'synthetic-private-key',bundleId:'co.cinegenius.app',environment:'sandbox'};
 const actor=options.actor===undefined?'account-a':options.actor,sessionId=options.sessionId??'session-a';
 const rpc=options.rpc??(async(action,_actor,_session,input)=>action==='capabilities'?{status:'ok',register:true,dispatch:true}:action==='view'||action==='register'?{status:'ok',installationId:input.installationId,revision:pushRevision,binding:'own',preferences:{messages:true,notices:false},locale:'en'}:{status:'ok',installationId:input.installationId,revision:pushRevision,revoked:true});
 const mocks={
  'server-only':{},'next/server':{after:callback=>scheduled.push(callback)},
  '@clerk/nextjs/server':{auth:async()=>({userId:actor,sessionId}),clerkClient:async()=>({sessions:{getSession:async id=>{sessions.push(id);if(options.sessionError)throw options.sessionError;return{id,userId:actor,status:options.sessionStatus??'active',expireAt:Date.now()+60_000,...options.session};}}})},
  '@/lib/auth':{getCurrentUser:async()=>actor?{userId:actor}:null},
  '@/lib/db':{db:{rpc:(_name,args)=>({abortSignal:async()=>{calls.push(args);return{data:await rpc(args.p_action,args.p_actor,args.p_session,args.p),error:null};}})}},
  '@/lib/rateLimit':{rateLimit:async()=>({allowed:options.rateAllowed!==false})},'@/lib/request-origin':{trustedMutationOrigin},
  './apns':{...apns,createApnsRequestBuilder:()=>{if(options.invalidKey)throw Error('key');return()=>null;}},
  './apns-server':{createApnsSender:()=>async delivery=>{sends.push(delivery);return{kind:'accepted'};}},
  './i18n/locales':locales,'./i18n/messages':{loadMessages:async()=>({PushNotifications:{messageBody:'Generic message only',noticeBody:'Generic notice only'}})},
  './native-push':wire,
  '@/lib/listing-freshness-cron-auth':{authorizedListingFreshnessCron},
 };
 const context=vm.createContext({Buffer,Request,Response,Headers,TextDecoder,Uint8Array,AbortSignal,Date,setTimeout,clearTimeout,process:{env},console:{error(){throw Error('No raw logging allowed');},log(){throw Error('No raw logging allowed');}}});
 const cache=new Map();
 function load(file){if(cache.has(file))return cache.get(file);const source=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};
 const loader=name=>{if(Object.hasOwn(mocks,name))return mocks[name];if(name==='./native-push-server')return load('lib/native-push-server.ts');if(name==='@/lib/native-push-worker')return load('lib/native-push-worker.ts');if(name==='node:crypto')return require(name);throw Error('Unmocked push dependency '+name);};
 new vm.Script('(function(require,module,exports){'+source+'\n})',{filename:file}).runInContext(context)(loader,mod,mod.exports);cache.set(file,mod.exports);return mod.exports;}
 return{load,calls,scheduled,sends,sessions,env,configuration,request(body,overrides={}){return new Request('https://www.cinegenius.co/api/native/v1/push/registrations/'+pushInstall,{method:body===undefined?'GET':'PUT',headers:{'Content-Type':'application/json',Origin:'https://www.cinegenius.co','X-Push-Account':actor??'','X-CineGenius-Push-Contract':wire.NATIVE_PUSH_CONTRACT,'X-Push-Installation-Proof':pushProof,...overrides.headers},...(body===undefined?{}:{body:JSON.stringify(body)}),...overrides});}};
}
