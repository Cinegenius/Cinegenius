import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const require=createRequire(import.meta.url);
function fixture(){const calls=[];let visible=true;
 const db=createClient('https://fixture.invalid','own-test-key',{auth:{persistSession:false},global:{fetch:async input=>{
 const u=new URL(input),t=u.pathname.split('/').at(-1);calls.push(u);
 const rows=t==='company_members'?[{id:'public-member',user_id:'public',status:'accepted',public_titles:['Produktion']},{id:'private-member',user_id:'private',status:'accepted'}]:t==='profiles'?[{user_id:'public',display_name:'Own test member',slug:'own-test',avatar_url:null}]:t==='company_equipment'?(u.searchParams.get('published')==='eq.true'?[{id:'published-fixture'}]:[{id:'published-fixture'},{id:'private-fixture'}]):[];
 return new Response(JSON.stringify(rows),{headers:{'content-type':'application/json'}});
 }}});
 const code=ts.transpileModule(readFileSync(new URL('../app/companies/[slug]/page.tsx',import.meta.url),'utf8')+'\nexport {getCompanyPublicData};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const deps={'@/lib/responsible-person-server':{publicResponsiblePerson:async()=>null},'@/lib/db':{db},'@/lib/linked-profile-access':{visibleLinkedProfileIds:async()=>new Set(visible?['public']:[])},'next/navigation':{},'@clerk/nextjs/server':{},'./CompanyDetail':{},'@/lib/company-membership-requests':{isPublicCompanyMembership:s=>s==='accepted'}};
 const m={exports:{}};new Function('require','module','exports',code)(n=>deps[n]??require(n),m,m.exports);
 return {...m.exports,calls,hide:()=>{visible=false;}};
}
test('company public page excludes private equipment and private linked identities, and rechecks changed permissions',async()=>{
 const f=fixture();let result=await f.getCompanyPublicData('own-company','owner');assert.equal(result.members.length,1);assert.equal(result.members[0].profile.display_name,'Own test member');assert.deepEqual(result.equipment,[{id:'published-fixture'}]);
 assert.ok(f.calls.filter(u=>u.pathname.endsWith('/profiles')).every(u=>!u.searchParams.get('user_id').includes('private')));
 f.hide();result=await f.getCompanyPublicData('own-company','owner');assert.equal(result.members.length,0);
});
