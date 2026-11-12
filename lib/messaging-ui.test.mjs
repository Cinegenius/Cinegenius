import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {messageDestinationKey,restoredMessageValue,restoredPeople,suggestedGroupName,validMessageRequestKey,messagingPeople,validConversationId,confirmedChatMessage} from './messaging-ui.ts';
const key='11111111-1111-4111-8111-111111111111', chat='22222222-2222-4222-8222-222222222222';
function compiledFunction(file,name){const ast=ts.createSourceFile(file,readFileSync(new URL(file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let fn;const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text===name)fn=node;ts.forEachChild(node,visit);};visit(ast);assert.ok(fn);return ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;}
const submit=compiledFunction('../components/messaging/MessageComposer.tsx','submit');
const start=compiledFunction('../components/messaging/NewMessageDialog.tsx','start');
const storedMessage={id:key,sender_id:'owner',content:'Own unsent message',created_at:'2026-11-12T09:00:00Z',read_at:null};
const response=(status,body)=>({ok:status>=200&&status<300,json:async()=>body});
const tick=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
function composer(fetch,{flush=async()=>true,destination={recipientId:'recipient-a'}}={}){
 const target=messageDestinationKey(destination),owner={current:'owner'},pending={current:false};
 const state={value:{destination:target,content:'Own unsent message',requestKey:key},phase:'idle',error:'',completed:0,sent:[],snapshots:[]};
 const set=field=>action=>{state[field]=typeof action==='function'?action(state[field]):action;};
 return{state,owner,send(){const deps={value:state.value,key:target,destination,accountId:'owner',owner,pending,sameAccount:true,wrongTarget:false,draft:{loaded:true,flush:async()=>{state.snapshots.push(structuredClone(state.value));return flush();},complete:async()=>{state.completed++;}},validMessageRequestKey,confirmedChatMessage,validConversationId,flushSync:fn=>fn(),crypto:{randomUUID:()=>key},setPhase:set('phase'),setError:set('error'),setValue:set('value'),onSent:(message,conversationId)=>state.sent.push({message,conversationId}),window:{setTimeout:()=>1,clearTimeout(){}},AbortController,fetch,t:key=>key,uiErrorMessage:(cause,fallback)=>cause.message??fallback};return new Function(...Object.keys(deps),submit+';return submit;')(...Object.values(deps))({preventDefault(){}});}};
}
test('private recovered messages require the exact destination and retain a valid retry key',()=>{
 const draft={destination:'recipient:person-a',content:'Private content',requestKey:key};
 assert.deepEqual(restoredMessageValue(draft,'recipient:person-a'),draft);
 assert.equal(restoredMessageValue(draft,'recipient:person-b'),null);
 assert.equal(restoredMessageValue(draft,'conversation:'+chat),null);
 assert.equal(messageDestinationKey({conversationId:chat,recipientId:'person-b'}),'conversation:'+chat);
 assert.equal(restoredMessageValue({...draft,content:'x'.repeat(5001)},draft.destination),null);
});
test('group suggestions use the selected names, while restored selections are bounded and deduplicated',()=>{
 assert.equal(suggestedGroupName([{id:'a',name:'Anna'},{id:'b',name:'Ben'}],'Group'),'Anna, Ben');
 assert.equal(suggestedGroupName([{id:'a',name:'x'.repeat(150)}],'Group').length,80);
 assert.deepEqual(restoredPeople([{id:'a',name:'Anna',secret:'not restored'},{id:'a',name:'duplicate'},{id:'bad/id',name:'Bad'}]),[{id:'a',name:'Anna'}]);
});
test('message send waits for private recovery, then retries with identical key, target and content',async()=>{
 let confirm,calls=0;const saving=new Promise(done=>confirm=done),requests=[];
 const form=composer(async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return ++calls===1?response(503,{error:'offline'}):response(200,{conversationId:chat,message:{...storedMessage}});},{flush:()=>saving});
 form.state.value.requestKey='';const pending=form.send();await tick();assert.equal(calls,0);assert.equal(form.state.phase,'saving');assert.equal(form.state.snapshots[0].requestKey,key);confirm(true);await pending;
 assert.equal(form.state.value.content,'Own unsent message');assert.equal(form.state.completed,0);await form.send();assert.deepEqual(requests[0],requests[1]);assert.equal(requests[0].body.accountId,'owner');assert.equal(form.state.completed,1);assert.equal(form.state.value.content,'');assert.equal(form.state.sent[0].conversationId,chat);
});
test('failed private save or unconfirmed response never clears text or claims a send',async()=>{
 let calls=0;const unsaved=composer(async()=>{calls++;},{flush:async()=>false});await unsaved.send();assert.equal(calls,0);assert.equal(unsaved.state.error,'recoveryError');assert.equal(unsaved.state.value.content,'Own unsent message');
 const malformed=composer(async()=>response(200,{conversationId:chat}));await malformed.send();assert.equal(malformed.state.completed,0);assert.equal(malformed.state.value.requestKey,key);assert.equal(malformed.state.error,'sendError');
});
test('account switch during recovery or a pending send cannot send or complete another account input',async()=>{
 let release;const saving=new Promise(done=>release=done);let calls=0;const form=composer(async()=>{calls++;return response(200,{conversationId:chat,message:{...storedMessage}});},{flush:()=>saving});const task=form.send();form.owner.current='another-account';release(true);await task;assert.equal(calls,0);assert.equal(form.state.completed,0);
 let finish;const network=new Promise(done=>finish=done);const pending=composer(()=>network);const send=pending.send();await tick();pending.owner.current=undefined;finish(response(200,{conversationId:chat,message:{...storedMessage}}));await send;assert.equal(pending.state.completed,0);assert.equal(pending.state.sent.length,0);
});
test('double taps send only once to the conversation captured by the mounted composer',async()=>{
 let finish,calls=0;const network=new Promise(done=>finish=done),requests=[];const form=composer(async(url,init)=>{calls++;requests.push({url,body:JSON.parse(init.body)});return network;},{destination:{conversationId:chat}});const send=form.send();await form.send();await tick();assert.equal(calls,1);assert.equal(requests[0].url,'/api/conversations/'+chat);finish(response(200,{message:{...storedMessage}}));await send;assert.equal(form.state.sent.length,1);
});
function chooser(fetch,selected){const state={value:{name:'',selected,requestKey:key},phase:'idle',error:'',snapshots:[],opened:[],resets:0};const owner={current:'owner'},pending={current:false};const set=field=>action=>{state[field]=typeof action==='function'?action(state[field]):action;};return{state,owner,async start(){const deps={value:state.value,sameAccount:true,accountId:'owner',owner,pending,draft:{loaded:true,flush:async()=>{state.snapshots.push(structuredClone(state.value));return true;}},setPhase:set('phase'),setError:set('error'),setValue:set('value'),validMessageRequestKey,validConversationId,suggestedGroupName,flushSync:fn=>fn(),crypto:{randomUUID:()=>key},onOpen:(destination,commit)=>state.opened.push({destination,commit}),reset:()=>{state.resets++;},visible:{current:true},window:{location:{href:'https://fixture.invalid/messages'}},fetch,AbortSignal,t:k=>k,uiErrorMessage:(cause,fallback)=>cause.message??fallback};return new Function(...Object.keys(deps),start+';return start;')(...Object.values(deps))();}};}
test('one selected person opens an existing chat without creating a group',async()=>{
 const calls=[];const dialog=chooser(async(url,init)=>{calls.push({url,init});return response(200,{conversationId:chat});},[{id:'person-a',name:'Anna'}]);await dialog.start();assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/conversations?with_user=person-a');assert.equal(calls[0].init.cache,'no-store');assert.deepEqual(dialog.state.opened[0].destination,{conversationId:chat});assert.equal(dialog.state.resets,0);dialog.state.opened[0].commit();assert.equal(dialog.state.resets,1);
});
test('multiple people create a group with a useful name and preserve a lost-response retry',async()=>{
 let fail=true;const requests=[];const dialog=chooser(async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return fail?response(503,{error:'offline'}):response(200,{conversationId:chat});},[{id:'person-a',name:'Anna'},{id:'person-b',name:'Ben'}]);await dialog.start();assert.equal(dialog.state.value.requestKey,key);assert.equal(dialog.state.value.selected.length,2);assert.equal(dialog.state.opened.length,0);fail=false;await dialog.start();assert.deepEqual(requests[0],requests[1]);assert.equal(requests[0].body.name,'Anna, Ben');assert.equal(requests[0].body.accountId,'owner');assert.deepEqual(dialog.state.opened[0].destination,{conversationId:chat});assert.equal(dialog.state.snapshots.length,2);
});

test('known private contacts stay searchable alongside deduplicated public results',()=>{
 const privateContact={id:'private',name:'Anna private contact'},known={id:'known',name:'Anna known'};
 assert.deepEqual(messagingPeople([privateContact,known],[{id:'known',name:'Anna updated'},{id:'public',name:'Anna public'}],'Anna').map(person=>person.id),['private','known','public']);
 assert.equal(messagingPeople([privateContact],[],'Anna')[0],privateContact);
 assert.deepEqual(messagingPeople([privateContact,known],[],'Anna',['known']).map(person=>person.id),['private']);
});
test('malformed success acknowledgements cannot confirm another account, text or destination',()=>{
 assert.equal(confirmedChatMessage(storedMessage,'owner','Own unsent message'),true);
 for(const patch of [{id:'unknown'},{sender_id:'other'},{content:'Other message'},{created_at:'not-a-date'},{read_at:undefined}])assert.equal(confirmedChatMessage({...storedMessage,...patch},'owner','Own unsent message'),false);
 assert.equal(validConversationId('not-a-chat'),false);
});
const groupAction=compiledFunction('../components/messaging/GroupInfoDialog.tsx','act');
const leaveRequest=compiledFunction('../components/messaging/GroupInfoDialog.tsx','requestLeave');
function groupFixture({lastAdmin=false}={}){
 const events=[],state={value:{name:' New group name ',baseName:'Old group name',editing:true,selected:[{id:'person-a',name:'Anna'},{id:'person-b',name:'Ben'}]},saving:false,posting:false,error:''},pending={current:false};
 const set=field=>action=>{state[field]=typeof action==='function'?action(state[field]):action;};
 function deps(){return{pending,sameAccount:true,lastAdmin,accountId:'owner',group:{id:chat},members:[],value:state.value,same:()=>true,confirmDialog:async()=>{events.push('confirm');return true;},setSaving:set('saving'),setPosting:set('posting'),setError:set('error'),setValue:set('value'),setAdding(){},flushSync:fn=>fn(),draft:{flush:async()=>{events.push('flush');return true;},complete:async()=>{events.push('complete');}},request:async(url,body)=>{events.push(['request',url,body]);},onRefresh:async()=>{events.push('refresh');},onLeave:()=>events.push('left'),t:key=>key,uiErrorMessage:(cause,fallback)=>cause.message??fallback};}
 return{state,events,act:(action,member,confirmed)=>new Function(...Object.keys(deps()),groupAction+';return act;')(...Object.values(deps()))(action,member,confirmed)};
}
test('confirmed group edits acknowledge their recovery snapshot and remove already added people',async()=>{
 const rename=groupFixture();await rename.act('rename');assert.equal(rename.state.value.name,'New group name');assert.equal(rename.state.value.baseName,'New group name');assert.equal(rename.state.value.editing,false);assert.deepEqual(rename.events.filter(event=>typeof event==='string'),['flush','flush','refresh']);
 const add=groupFixture();await add.act('add');assert.equal(add.events.filter(Array.isArray).length,2);assert.deepEqual(add.state.value.selected,[]);assert.equal(add.state.posting,false);assert.equal(add.events.at(-2),'flush');
});
test('last admins cannot leave implicitly, and confirmed leave stops recovery before navigation',async()=>{
 const blocked=groupFixture({lastAdmin:true});await blocked.act('leave');assert.equal(blocked.state.error,'lastAdmin');assert.equal(blocked.events.length,0);
 const allowed=groupFixture();await allowed.act('leave',undefined,true);assert.deepEqual(allowed.events.slice(-2),['complete','left']);
});
test('group leave closes the native modal and waits for the private-form guard before mutation',async()=>{
 const events=[];let approve;
 const deps={pending:{current:false},lastAdmin:false,sameAccount:true,confirmDialog:async()=>{events.push('confirm');return true;},same:()=>true,t:key=>key,onClose:()=>events.push('close'),window:{setTimeout:fn=>fn()},leave:fn=>{events.push('guard');approve=fn;},onResume:()=>events.push('resume'),act:async(action,_member,confirmed)=>events.push([action,confirmed])};
 const run=new Function(...Object.keys(deps),leaveRequest+';return requestLeave;')(...Object.values(deps));await run();assert.deepEqual(events,['confirm','close','guard']);approve();assert.deepEqual(events.slice(-2),['resume',['leave',true]]);
});
test('HTTP rejection preserves the exact private message and retry key for all expected failure statuses',async()=>{
 for(const status of [401,403,429,500]){const form=composer(async()=>response(status,{error:'HTTP '+status}));await form.send();assert.equal(form.state.completed,0);assert.equal(form.state.value.content,'Own unsent message');assert.equal(form.state.value.requestKey,key);assert.equal(form.state.error,'HTTP '+status);}
});
test('group mutations require an explicit success acknowledgement',async()=>{
 const code=compiledFunction('../components/messaging/GroupInfoDialog.tsx','request');
 for(const payload of [{},{success:false},{success:'true'}]){const deps={accountId:'owner',fetch:async()=>response(200,payload),AbortSignal,t:key=>key};const run=new Function(...Object.keys(deps),code+';return request;')(...Object.values(deps));await assert.rejects(run('/api/conversations/'+chat+'/group',{name:'Changed'},'PATCH'),/groupError/);}
});
