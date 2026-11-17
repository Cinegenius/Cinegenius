import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {dashboardLegacyDestination} from './personal-area-navigation.ts';

// Contact decisions belong to the canonical InboxFriends component. Its full
// failure, duplicate decision, account-switch and late-response tests remain in
// inbox-friends-client.test.mjs; Dashboard must not maintain another contact list.
const source=readFileSync(new URL('../app/dashboard/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const page=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='DashboardPage');
assert.ok(page);
const require=createRequire(import.meta.url);
function entry(user,isLoaded=true){
 const loaded={};
 const code=ts.transpileModule(page.getText(ast).replace('export default ','')+';exports.Page=DashboardPage;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const Inner=()=>null;
 new Function('require','exports','useUser','useTranslations','DashboardContent',code)(require,loaded,()=>({user,isLoaded}),()=>key=>key,Inner);
 return loaded.Page();
}

test('saved contact and own-content links have one canonical destination and keep input parameters intact',()=>{
 for(const [tab,expected]of[['friends','/messages?view=friends'],['favorites','/favorites'],['profil','/profile'],['firma','/company-dashboard']]){
  const params=new URLSearchParams({tab,untrusted:'https://elsewhere.invalid'}),before=params.toString();
  assert.equal(dashboardLegacyDestination(params),expected);assert.equal(params.toString(),before);
 }
 for(const tab of ['settings','analytics','bookings','listings','jobs','overview','unknown'])assert.equal(dashboardLegacyDestination(new URLSearchParams({tab})),null);
});

test('dashboard content remounts for each authenticated account and remains absent during identity loading',()=>{
 assert.equal(entry({id:'owner-a'}).key,'owner-a');assert.equal(entry({id:'owner-b'}).key,'owner-b');
 assert.equal(entry({id:'owner-a'},false).props.role,'status');assert.equal(entry(null).props.role,'status');
});

test('dashboard has no hidden contact decisions, duplicate favorites or duplicate company fetches',()=>{
 assert.doesNotMatch(source,/\/api\/friendships|\/api\/favorites|\/api\/companies\?mine|changeFriend|ContactCard|setFriends/);
 assert.doesNotMatch(source,/activeTab === "(?:friends|favorites|firma|profil|messages)"/);
});
