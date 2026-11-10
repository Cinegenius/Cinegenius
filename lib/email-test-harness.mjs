import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,join,dirname,extname} from 'node:path';
import vm from 'node:vm';
export const LOCALES=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
export const TEST_BASE='https://cinegenius-email.example.test';
export const TEST_TO='recipient@example.test';
export const TEST_KEY='re_cinegenius_test_only_never_sent';
export const TEST_SECRET='whsec_cinegenius_test_only';
export function htmlEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function normalized(value){return value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();}
/** Actual local TS in a VM: closed import allowlist, private dummy environment, no real transport. */
export function createEmailHarness({sourceRoot=process.cwd(),locale='en',senderLocale='de',env={},users,clerkFailure=false,providerFailure=null,signatureValid=true,missingSignature=false}={}){
 const root=resolve(sourceRoot),require=createRequire(join(root,'package.json'));
 const ts=require('typescript'),{createTranslator}=require('next-intl');
 const catalogs=new Map(LOCALES.map(code=>[code,JSON.parse(readFileSync(join(root,'messages',code+'.json'),'utf8'))]));
 const state={sent:[],keys:[],lookups:[],translations:[],headerReads:[],cookieReads:0,networkAttempts:0,logs:[],verifications:[]};
 const recipientUsers=users??[{id:'recipient-user',locale,emailAddresses:[{emailAddress:TEST_TO}],privateMetadata:{},unsafeMetadata:{}}];
 const dummyEnv=Object.freeze({RESEND_API_KEY:TEST_KEY,CLERK_WEBHOOK_SECRET:TEST_SECRET,NEXT_PUBLIC_APP_URL:TEST_BASE,...env});
 const fakeHeaders=new Headers({'svix-id':'test-event','svix-timestamp':'1700000000','svix-signature':'test-valid-signature',cookie:'cg_locale='+senderLocale,'accept-language':senderLocale});
 if(missingSignature)fakeHeaders.delete('svix-signature');
 const clerk={users:{async getUser(id){state.lookups.push({kind:'id',id});if(clerkFailure)throw new Error('Controlled Clerk lookup failure');return recipientUsers.find(user=>user.id===id)??null;},async getUserList(options){state.lookups.push({kind:'email',options:structuredClone(options)});if(clerkFailure)throw new Error('Controlled Clerk lookup failure');return{data:recipientUsers.filter(user=>(user.emailAddresses??[]).some(address=>options.emailAddress.includes(address.emailAddress))).slice(0,options.limit)};}}};
 class Resend{constructor(key){if(key!==TEST_KEY)throw new Error('Non-dummy provider key rejected');state.keys.push(key);this.emails={send:async payload=>{state.sent.push(structuredClone(payload));if(providerFailure==='throw')throw new Error('Controlled provider failure');return providerFailure?{error:{name:'ControlledProviderError',statusCode:503}}:{data:{id:'controlled-message-id'},error:null};}};this.batch={send:async()=>{throw new Error('Unexpected batch send');}};}}
 class Webhook{constructor(secret){if(secret!==TEST_SECRET)throw new Error('Non-dummy webhook secret rejected');}verify(body,headers){state.verifications.push({body,headers});if(!signatureValid)throw new Error('Controlled invalid signature');return JSON.parse(body);}}
 const mocks={resend:{Resend},svix:{Webhook},'@clerk/nextjs/server':{clerkClient:async()=>clerk},'next/headers':{headers:async()=>({get(name){state.headerReads.push(name);return fakeHeaders.get(name);}}),cookies:async()=>{state.cookieReads++;throw new Error('Sender cookie must never choose recipient email locale');}},'next-intl/server':{getTranslations:async input=>{if(!input||typeof input!=='object'||!LOCALES.includes(input.locale)||!input.namespace)throw new Error('Explicit recipient locale/namespace required');state.translations.push({...input});return translate(input.locale,input.namespace);}}};
 function translate(code,namespace){return createTranslator({locale:code,messages:catalogs.get(code),namespace,onError(error){throw error;}});}
 const loaded=new Map(),allowedFiles=new Set(['lib/email.ts','lib/i18n/email-locale.ts','lib/i18n/locales.ts','app/api/webhooks/clerk/route.ts']);
 const context=vm.createContext({console:{error:(...args)=>state.logs.push(args),warn:(...args)=>state.logs.push(args),log:(...args)=>state.logs.push(args)},process:Object.freeze({env:dummyEnv}),URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,AbortController,setTimeout,clearTimeout,fetch:()=>{state.networkAttempts++;throw new Error('Network forbidden');}});
 function load(relative){if(!allowedFiles.has(relative))throw new Error('Unexpected local dependency: '+relative);if(loaded.has(relative))return loaded.get(relative).exports;const filename=join(root,relative),mod={exports:{}};loaded.set(relative,mod);const compiled=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const customRequire=id=>{if(Object.hasOwn(mocks,id))return mocks[id];let file;if(id.startsWith('@/'))file=id.slice(2);else if(id.startsWith('.'))file=resolve(dirname(filename),id).slice(root.length+1);else throw new Error('Unexpected external dependency: '+id);if(!extname(file))file+='.ts';return load(file);};const fn=new vm.Script('(function(require,module,exports){'+compiled+'\n})',{filename}).runInContext(context);fn(customRequire,mod,mod.exports);return mod.exports;}
 function webhook(event){return load('app/api/webhooks/clerk/route.ts').POST(new Request(TEST_BASE+'/api/webhooks/clerk',{method:'POST',headers:{'content-type':'application/json',cookie:'cg_locale='+senderLocale,'accept-language':senderLocale},body:JSON.stringify(event)}));}
 return{state,catalogs,translate,load,webhook,dummyEnv,recipientLocale:()=>load('lib/i18n/email-locale.ts').recipientEmailLocale};
}
