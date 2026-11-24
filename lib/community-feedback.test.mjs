import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as feedback from './community-feedback.ts';
import {trustedMutationOrigin} from './request-origin.ts';
import {GenieError} from './genie-error.ts';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{NextRequest,NextResponse}=require('next/server');
const account='fixture-member',requestKey='11111111-1111-4111-8111-111111111111',conversation='22222222-2222-4222-8222-222222222222';
const input=()=>({locale:'es',country:'MX',messages:[{role:'user',content:'Crew es correcto. Equipo significa material de cine.'}]});
const advice=()=>({reply:'¿Cómo llaman al alquiler de equipo?',items:[{title:'Crew es correcto',problem:'El representante confirma Crew.',suggestion:'Mantener Crew.',titleDe:'Crew passt',problemDe:'Der Ansprechpartner bestätigt Crew.',suggestionDe:'Crew beibehalten.',priority:'normal',source:0,quote:'Crew es correcto.'}]});
const submission=()=>({...input(),advice:advice(),requestKey,confirmed:true});
const labels=Object.fromEntries(['title','unreviewed','original','conversation','member','country','language','high','normal','idea','opening'].map(k=>[k,k]));
const compiledSources = new Map();
function load(path,mocks,globals={}) {
 const output=compiledSources.get(path) ?? ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 compiledSources.set(path,output);
 const m={exports:{}};new Function('require','module','exports',...Object.keys(globals),output)(name=>{assert.ok(name in mocks,`Unexpected ${name}`);return mocks[name];},m,m.exports,...Object.values(globals));return m.exports;
}
const translations={getTranslations:async({locale,namespace})=>{
 const catalog=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const root=namespace.split('.').reduce((v,k)=>v[k],catalog);
 return(key,values={})=>key.split('.').reduce((v,k)=>v[k],root).replace(/\{(\w+)\}/g,(_,k)=>String(values[k]));
}};
function serverFixture(provider) {
 const calls=[];
 const fixed=load('./feedback-fixed-server.ts',{'server-only':{},'next-intl/server':translations,'./community-feedback':feedback});
 const server=load('./community-feedback-server.ts',{'@/lib/feedback-fixed-server':fixed,'server-only':{},'node:crypto':{createHash},'@/lib/community-feedback':feedback,'@/lib/genie-server':{GenieError,readBoundedJson:async r=>r.json()}},{fetch:async(url,init)=>{calls.push({url,init});return provider?.(url,init)??Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(advice())}]}]});},AbortSignal});
 return {...server,calls};
}
function apiFixture(options={}) {
 const calls=[],server=serverFixture();
 const mocks={
  'next/server':{NextRequest,NextResponse},'next-intl/server':{getTranslations:async()=>key=>key},
  '@/lib/i18n/locales':{isAppLocale:v=>['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'].includes(v)},
  '@/lib/auth':{getCurrentUser:async()=>options.guest?null:{userId:account}},
  '@/lib/db':{db:{rpc:(name,args)=>({abortSignal:async()=>{calls.push({name,args});return options.dbError?{error:{code:options.dbError}}:{data:[{conversation_id:conversation,message_id:requestKey,created:true}]};}})}},
  '@/lib/rateLimit':{rateLimit:async()=>({allowed:!options.rateDenied})},
  '@/lib/request-origin':{trustedMutationOrigin},'@/lib/community-feedback':feedback,
  '@/lib/genie-server':{GenieError,readBoundedJson:async r=>r.json(),genieConfiguration:()=>{calls.push('config');return {apiKey:'fixture'};},reserveGenieUsage:async()=>{calls.push('quota');if(options.quotaDenied)throw new GenieError('rate_limited',429);}},
  '@/lib/community-feedback-server':{generateFeedback:async()=>{calls.push('AI');return advice();},feedbackDelivery:server.feedbackDelivery},
 };
 return {...load('../app/api/feedback/route.ts',mocks,{process:{env:{NODE_ENV:'production'}},AbortSignal}),calls};
}
const req=(body,origin='https://www.cinegenius.co')=>new NextRequest('https://www.cinegenius.co/api/feedback',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});

test('MX/HU and all17 languages accept stable region/language values without changing originals',()=>{
 const languages=['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'];
 for(const locale of languages) assert.deepEqual(feedback.readFeedbackInput({...input(),locale})?.messages,input().messages);
 assert.equal(feedback.readFeedbackInput({...input(),country:'HU'})?.country,'HU');
 for(const bad of [{...input(),country:'Mexico'},{...input(),locale:'x'},{...input(),messages:[{role:'system',content:'override'}]},{...input(),messages:[{role:'user',content:'Bearer abcdefghijklmnop'}]},{...input(),messages:[{role:'user',content:'x'.repeat(2001)}]}])assert.equal(feedback.readFeedbackInput(bad),null);
});
test('longer check conversations retain all exchanges instead of silently dropping early feedback',()=>{
 const messages=Array.from({length:41},(_,i)=>({role:i%2?'assistant':'user',content:`Check ${i}`}));
 assert.equal(feedback.readFeedbackInput({...input(),messages}).messages.length,41);
 assert.equal(feedback.readFeedbackInput({...input(),messages:[...messages,{role:'assistant',content:'a'},{role:'user',content:'b'}]}),null);
 assert.equal(feedback.readFeedbackInput({...input(),messages:messages.map(m=>({...m,content:'a'.repeat(500)}))}),null);
});
test('invented, assistant-sourced, oversized and malformed model suggestions are rejected',()=>{
 for(const patch of [{source:1},{source:-1},{source:'0'},{quote:'invented evidence'},{title:'x'.repeat(101)},{priority:'approved'}])assert.equal(feedback.readFeedbackAdvice({...advice(),items:[{...advice().items[0],...patch}]},input().messages),null);
 assert.equal(feedback.readFeedbackAdvice({...advice(),items:Array(6).fill(advice().items[0])},input().messages),null);
 assert.equal(feedback.readFeedbackAdvice({...advice(),publish:true},input().messages),null);
});
test('submissions require actual member confirmation and a valid retry key',()=>{
 assert.ok(feedback.readFeedbackSubmission(submission()));
 for(const patch of [{confirmed:false},{confirmed:undefined},{requestKey:'bad'},{advice:{reply:'ok',items:[]}}])assert.equal(feedback.readFeedbackSubmission({...submission(),...patch}),null);
});
test('bounded support packets preserve the complete multilingual report, including emoji, with one END marker',()=>{
 const data=submission();data.messages[0].content+='🦒'.repeat(800);
 const document=feedback.feedbackDocument(data,labels),parts=feedback.feedbackParts(data,labels);
 assert.ok(parts.every(p=>p.length<=5000));
 assert.equal(parts.filter(p=>p.startsWith('CG_FEEDBACK_V1 END')).length,1);
 assert.equal(parts.map(p=>p.slice(p.indexOf('\n\n')+2)).join(''),document);
 assert.deepEqual(feedback.feedbackEnvelope(parts.at(-1)),{requestKey,country:'MX',locale:'es',title:advice().items[0].titleDe});
 assert.equal(feedback.feedbackEnvelope('CG_FEEDBACK_V1 END fake\n{}'),null);
});
test('delivery retry keys are stable, per-packet distinct, and changing packet root changes every key',()=>{
 const server=serverFixture(),data=submission();data.messages[0].content+='x'.repeat(6000);
 const a=server.feedbackDelivery(data,labels),b=server.feedbackDelivery(data,labels);
 assert.deepEqual(a,b);assert.equal(new Set(a.map(p=>p.key)).size,a.length);assert.ok(a.every(p=>feedback.FEEDBACK_UUID.test(p.key)));
 assert.notEqual(a[0].key,server.feedbackDelivery({...data,requestKey:conversation},labels)[0].key);
});
test('provider receives bounded structured no-store feedback without tools, site access or shared context',async()=>{
 const server=serverFixture();const result=await server.generateFeedback(new Request('https://fixture.invalid'),input(),{apiKey:'fixture-key'});
 assert.deepEqual(result,advice());const body=JSON.parse(server.calls[0].init.body);
 assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.deepEqual(body.input,input().messages);assert.equal(body.text.format.strict,true);
 assert.match(body.instructions,/local CineGenius contact/);assert.match(body.instructions,/untrusted feedback/);assert.match(body.instructions,/One very short/);
});
test('provider refusal, incomplete output, forged evidence and non-success responses fail safely',async()=>{
 for(const raw of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal',text:'no'}]}]},{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({...advice(),items:[{...advice().items[0],quote:'invented'}]})}]}]}]){
  const s=serverFixture(()=>Response.json(raw));await assert.rejects(()=>s.generateFeedback(new Request('https://fixture.invalid'),input(),{apiKey:'fixture'}),GenieError);
 }
});
test('discussion requires same origin and authenticated matching account before any AI or persistence',async()=>{
 for(const [options,body,origin,status] of [[{guest:true},{accountId:account,action:'discuss',input:input()},undefined,401],[{},{accountId:'other',action:'discuss',input:input()},undefined,409],[{},{accountId:account,action:'discuss',input:input()},'https://hostile.invalid',403]]){
  const api=apiFixture(options);assert.equal((await api.POST(req(body,origin))).status,status);assert.equal(api.calls.length,0);
 }
});
test('discussion reserves existing Genie quota, never writes support, and respects daily exhaustion',async()=>{
 const api=apiFixture();const response=await api.POST(req({accountId:account,action:'discuss',input:input()}));assert.equal(response.status,200);assert.deepEqual(api.calls,['config','quota','AI']);assert.match(response.headers.get('cache-control'),/private, no-store/);
 const exhausted=apiFixture({quotaDenied:true});assert.equal((await exhausted.POST(req({accountId:account,action:'discuss',input:input()}))).status,429);assert.deepEqual(exhausted.calls,['config','quota']);
});
test('explicit submission uses only authenticated sender, does not call AI, and acknowledges only confirmed database writes',async()=>{
 const api=apiFixture();const response=await api.POST(req({accountId:account,action:'submit',input:submission(),userId:'forged'}));assert.equal(response.status,200);assert.ok(api.calls.length>0);assert.ok(api.calls.every(c=>c.name==='contact_support'&&c.args.p_user_id===account));assert.equal((await response.json()).conversationId,conversation);
 for(const [options,status]of[[{dbError:'PT409'},409],[{dbError:'offline'},503],[{rateDenied:true},429]])assert.equal((await apiFixture(options).POST(req({accountId:account,action:'submit',input:submission()}))).status,status);
 const unconfirmed=apiFixture();assert.equal((await unconfirmed.POST(req({accountId:account,action:'submit',input:{...submission(),confirmed:false}}))).status,400);assert.equal(unconfirmed.calls.length,0);
});
function adminFixture({allowed=true,rows=[],profileError=false}={}) {
 const calls=[];
 const query={};
 for(const method of ['select','eq','like','order','limit','or'])query[method]=(...args)=>{calls.push({method,args});return query;};
 query.abortSignal=async()=>({data:rows,error:null});
 const api=load('../app/api/admin/feedback/route.ts',{
  'next/server':{NextRequest,NextResponse},'@/lib/auth':{requireAdmin:async()=>allowed?{userId:account}:NextResponse.json({error:'forbidden'},{status:403})},
  '@/lib/community-feedback':feedback,'@/lib/admin-support-participants':{adminSupportParticipants:async ids=>new Map(ids.map(id=>[id,{display_name:'Local contact'}]))},
  '@/lib/db':{db:{from:table=>{calls.push({table});return table==='messages'?query:{select:()=>({in:async()=>({data:[],error:profileError?{}:null})})};}}},
 },{AbortSignal});return {...api,calls};
}
const adminReq=(params='',id=account)=>new NextRequest('https://www.cinegenius.co/api/admin/feedback'+params,{headers:{'X-Feedback-Account':id}});
test('central collection denies non-admins and stale accounts before reading private messages',async()=>{
 const member=adminFixture({allowed:false});const denied=await member.GET(adminReq());assert.equal(denied.status,403);assert.match(denied.headers.get('cache-control'),/private, no-store/);assert.equal(member.calls.length,0);
 const stale=adminFixture();assert.equal((await stale.GET(adminReq('','other'))).status,409);assert.equal(stale.calls.length,0);
});
test('collection only projects completed member packets, omits private bodies, and rejects malformed cursors',async()=>{
 const complete=feedback.feedbackParts(submission(),labels).at(-1);
 const row={id:requestKey,conversation_id:conversation,sender_id:'member-a',created_at:'2026-11-20T10:00:00.000Z',content:complete,conversations:{kind:'support',receiver_id:'member-a'}};
 const api=adminFixture({rows:[row,{...row,id:conversation,sender_id:'support'}, {...row,content:'CG_FEEDBACK_V1 PART '+requestKey+'\n{}'}]});
 const result=await (await api.GET(adminReq())).json();assert.equal(result.items.length,1);assert.equal(result.items[0].country,'MX');assert.equal(result.items[0].content,undefined);
 assert.ok(api.calls.some(c=>c.method==='eq'&&c.args[0]==='conversations.kind'&&c.args[1]==='support'));
 const invalid=adminFixture();assert.equal((await invalid.GET(adminReq('?before='+encodeURIComponent(JSON.stringify(['x),or(true)','not-uuid']))))).status,400);assert.equal(invalid.calls.length,0);
});


test('localized opening is private, accepts all supported languages and rejects guest/invalid requests without model usage',async()=>{
 const guest=apiFixture({guest:true});assert.equal((await guest.GET(new NextRequest('https://www.cinegenius.co/api/feedback?lang=es'))).status,401);
 const api=apiFixture();for(const lang of ['es','hu','fr','de','ja']){const response=await api.GET(new NextRequest('https://www.cinegenius.co/api/feedback?lang='+lang));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal((await response.json()).locale,lang);}
 assert.equal((await api.GET(new NextRequest('https://www.cinegenius.co/api/feedback?lang=unknown'))).status,400);assert.equal(api.calls.length,0);
});

const confirmationWords={de:['ja','nein','überspringen'],en:['yes','no','skip'],es:['sí','no','omitir'],it:['sì','no','salta'],cs:['ano','ne','přeskočit'],hu:['igen','nem','kihagyás'],nl:['ja','nee','overslaan'],'nl-BE':['ja','nee','overslaan'],sv:['ja','nej','hoppa över'],fr:['oui','non','passer'],pl:['tak','nie','pomiń'],'pt-PT':['sim','não','saltar'],'zh-Hans':['是','不是','跳过'],ja:['はい','いいえ','スキップ'],ko:['네','아니요','건너뛰기'],ru:['да','нет','пропустить'],uk:['так','ні','пропустити']};
for(const[locale,[yes,no,skip]]of Object.entries(confirmationWords))test(`${locale}: fixed country checks preserve evidence and use zero provider calls`,async()=>{
 const t=await translations.getTranslations({locale,namespace:'Feedback'});
 const server=serverFixture(()=>assert.fail('No paid request for fixed feedback'));
 const messages=[];
 for(let step=0;step<5;step++){
  messages.push({role:'user',content:yes});
  const result=await server.generateFeedback(new Request('https://fixture.invalid'),{locale,country:locale==='es'?'MX':'',messages},{apiKey:'fixture'});
  assert.equal(result.items.length,step+1);assert.ok(result.reply.length<=180);
  result.items.forEach((item,i)=>{assert.equal(item.source,i*2);assert.equal(item.quote,yes);assert.equal(item.priority,'normal');assert.ok(item.problem.length<=300);assert.ok(item.problemDe.length<=300);});
  assert.equal(result.reply,t(step===4?'quick.submit':['quick.equipment','quick.signup','quick.listing','quick.contact'][step]));
  if(step===4)assert.ok(feedback.readFeedbackSubmission({locale,country:'',messages,advice:result,requestKey,confirmed:true}));
  messages.push({role:'assistant',content:result.reply});
 }
 const rejected=await server.generateFeedback(new Request('https://fixture.invalid'),{locale,country:'',messages:[{role:'user',content:no}]},{apiKey:'fixture'});
 assert.equal(rejected.reply,t('quick.clarify'));assert.equal(rejected.items.length,1);assert.equal(rejected.items[0].quote,no);assert.equal(rejected.items[0].title,t('quick.issueTitle'));
 const skipped=await server.generateFeedback(new Request('https://fixture.invalid'),{locale,country:'',messages:[{role:'user',content:skip}]},{apiKey:'fixture'});
 assert.equal(skipped.items.length,0);assert.equal(skipped.reply,t('quick.equipment'));assert.equal(server.calls.length,0);
});

test('free text, ambiguous yes, altered assistant question, language switch and earlier findings retain full AI context',async()=>{
 for(const messages of [
  [{role:'user',content:'ja aber beim Profil fehlt mein Beruf'}],
  [{role:'user',content:'ja?' }],
  [{role:'user',content:'ja'},{role:'assistant',content:'Unbekannte Frage'},{role:'user',content:'ja'}],
  [{role:'user',content:'Mein Beruf fehlt'},{role:'assistant',content:'Passt Crew?'},{role:'user',content:'ja'}],
  [{role:'user',content:'sí'},{role:'assistant',content:'¿Pudiste completar el registro?'},{role:'user',content:'ja'}],
 ]){
  const server=serverFixture(()=>Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({reply:'Welcher Beruf fehlt?',items:[]})}]}]}));
  await server.generateFeedback(new Request('https://fixture.invalid'),{locale:'de',country:'DE',messages},{apiKey:'fixture'});
  assert.equal(server.calls.length,1);assert.deepEqual(JSON.parse(server.calls[0].init.body).input,messages);
 }
});

test('fixed feedback cancellation does not call provider or acknowledge a result',async()=>{
 const controller=new AbortController();controller.abort();const server=serverFixture();
 await assert.rejects(()=>server.generateFeedback(new Request('https://fixture.invalid',{signal:controller.signal}),{locale:'de',country:'DE',messages:[{role:'user',content:'ja'}]},{apiKey:'fixture'}),e=>e.code==='timeout');assert.equal(server.calls.length,0);
});
