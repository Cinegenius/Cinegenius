import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navigateMessageView,backFromMessageView,MESSAGE_HISTORY_KEY} from './message-navigation.ts';

function browser(initial='https://example.invalid/messages'){
 const entries=[{url:'https://example.invalid/before',state:{__NA:true}},{url:initial,state:{__NA:true,__PRIVATE_NEXTJS_INTERNALS_TREE:['messages']}}];let index=1;
 const browser={get location(){return new URL(entries[index].url)},history:{get state(){return entries[index].state},
  // Next's native History wrapper supplies its internal router state itself.
  pushState(state,_title,url){assert.equal(state.__NA,undefined);entries.splice(index+1);entries.push({url:new URL(url,entries[index].url).href,state:{...state,__NA:true,__PRIVATE_NEXTJS_INTERNALS_TREE:['messages']}});index++},
  replaceState(state,_title,url){assert.equal(state.__NA,undefined);entries[index]={url:new URL(url,entries[index].url).href,state:{...state,__NA:true,__PRIVATE_NEXTJS_INTERNALS_TREE:['messages']}}},
  back(){if(index>0)index--},forward(){if(index<entries.length-1)index++}
 },get entries(){return entries}};return browser;
}
test('opening a chat adds exactly one real entry; Back returns to the list, Forward restores the chat',()=>{
 const b=browser();assert.equal(navigateMessageView(b,'own-member',{conversationId:'own-chat'}),true);
 assert.equal(b.location.search,'?conv=own-chat');assert.equal(b.entries.length,3);
 backFromMessageView(b,'own-member');assert.equal(b.location.pathname+b.location.search,'/messages');
 b.history.forward();assert.equal(b.location.search,'?conv=own-chat');
 b.history.back();b.history.back();assert.equal(b.location.pathname,'/before');
});
test('switching chats represents actual steps and selecting the current chat adds no duplicates',()=>{
 const b=browser();navigateMessageView(b,'own-member',{conversationId:'chat-a'});navigateMessageView(b,'own-member',{conversationId:'chat-b'});
 assert.equal(navigateMessageView(b,'own-member',{conversationId:'chat-b'}),false);assert.equal(b.entries.length,4);
 backFromMessageView(b,'own-member');assert.equal(b.location.search,'?conv=chat-a');backFromMessageView(b,'own-member');assert.equal(b.location.pathname+b.location.search,'/messages');
});
test('a recipient becoming an existing/new conversation replaces the same entry and retains company context',()=>{
 const b=browser();navigateMessageView(b,'own-member',{recipientId:'own-contact',companySlug:'own-company'});
 navigateMessageView(b,'own-member',{conversationId:'own-chat',recipientId:'own-contact',companySlug:'own-company'},true);
 assert.equal(b.entries.length,3);assert.equal(b.location.searchParams.get('conv'),'own-chat');assert.equal(b.location.searchParams.get('company_slug'),'own-company');
 backFromMessageView(b,'own-member');assert.equal(b.location.pathname+b.location.search,'/messages');b.history.forward();assert.equal(b.location.searchParams.get('conv'),'own-chat');
});
test('deep-linked chats close to the list without inventing history entries or leaving for a previous website',()=>{
 for(const query of ['?conv=direct','?to=own-contact']){
  const b=browser('https://example.invalid/messages'+query);backFromMessageView(b,'own-member');
  assert.equal(b.location.pathname+b.location.search,'/messages');assert.equal(b.entries.length,2);b.history.back();assert.equal(b.location.pathname,'/before');
 }
});
test('history is account scoped, contains only routing identifiers, and cannot navigate another page',()=>{
 const b=browser();navigateMessageView(b,'first-account',{conversationId:'own-chat'});
 const state=b.history.state[MESSAGE_HISTORY_KEY];assert.deepEqual(Object.keys(state).sort(),['current','owner','previous']);
 backFromMessageView(b,'another-account');assert.equal(b.location.pathname+b.location.search,'/messages');
 const other=browser('https://example.invalid/profile/own');assert.equal(navigateMessageView(other,'own-member',{conversationId:'own-chat'}),false);backFromMessageView(other,'own-member');assert.equal(other.location.pathname,'/profile/own');
 assert.equal(navigateMessageView(b,'',{conversationId:'own-chat'}),false);
});
test('the message selection follows URL traversal without clearing account contacts or text drafts',()=>{
 const source=readFileSync('app/messages/page.tsx','utf8');
 assert.match(source,/\[convParam, toParam, user\?\.id\]/);assert.doesNotMatch(source,/autoOpenedConversationRef|autoOpenedRecipientRef/);
 assert.match(source,/\[user\?\.id, loadConversations, loadFriendRequests\]/);
 assert.match(source,/navigateMessageView\(window, user.id, \{ conversationId: conv.id \}\)/);
 assert.match(source,/drafts.current.get\(activeId \?\? newConvRecipient/);
 assert.match(source,/contactsLoading && !contacts.length/);
});
