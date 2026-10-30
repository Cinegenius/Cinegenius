import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {createTranslator} from 'next-intl';
import * as primary from './primary-occupation.ts';
import * as occupations from './crew-occupations.ts';
import * as editor from './profile-occupation-editor.ts';
import * as departmentData from './departments.ts';
import * as grip from './gripTaxonomy.ts';

const option = (department, title) => primary.occupationChoices([title]).find(value => value.departmentId === department);
const light = option('licht', 'Gaffer (Oberbeleuchter)');
const animal = option('filmtiere-tiertraining', 'Filmtiertrainer/in');
const reference = primary.occupationReference;

test('the remove chip works for bare, legacy, translated and unknown saved titles without touching other titles', () => {
  for (const title of ['Tiertrainer','Tiertrainer*in','Tiertrainer/in für Film, Fernsehen und Werbung','Animal Trainer','Mein alter individueller Beruf']) {
    const positions = ['Gaffer', title, 'Lichtassistent*in'];
    const before = structuredClone(positions);
    const edited = editor.removeProfilePosition(positions, undefined, title);
    assert.deepEqual(edited.positions, ['Gaffer','Lichtassistent*in']);
    assert.ok(edited.occupations.every(value => value.departmentId === 'licht'));
    assert.deepEqual(positions, before);
    assert.equal(occupations.crewOccupationsError({occupations: edited.occupations}, edited.positions), null);
  }
});

test('unchecking the canonical animal role removes its saved legacy aliases instead of restoring them on save', () => {
  const positions = ['Gaffer','Tiertrainer*in','Filmtiertrainer/in'];
  const oldReference = {departmentId:'set-logistik',roleId:'set-logistik/'+encodeURIComponent('Tiertrainer*in')};
  const edited = editor.toggleProfileOccupation(positions, [reference(light),oldReference], reference(animal));
  assert.deepEqual(edited.positions,['Gaffer']);
  assert.deepEqual(edited.occupations,[reference(light)]);
  const reloaded = JSON.parse(JSON.stringify(edited));
  assert.deepEqual(occupations.selectedCrewOccupations(reloaded.positions,reloaded.occupations),[reference(light)]);
});

test('removing one shared title binding keeps the other explicitly selected department', () => {
  const sameTitle = primary.occupationCatalogue.filter(value => value.label === 'Playback Operator');
  assert.ok(sameTitle.length >= 2);
  let edited = editor.toggleProfileOccupation(['Playback Operator','Gaffer'],[...sameTitle.map(reference),reference(light)],reference(sameTitle[0]));
  assert.deepEqual(edited.positions,['Playback Operator','Gaffer']);
  assert.ok(!edited.occupations.some(value => value.roleId === sameTitle[0].roleId));
  for (const remaining of sameTitle.slice(1)) edited = editor.toggleProfileOccupation(edited.positions,edited.occupations,reference(remaining));
  assert.deepEqual(edited.positions,['Gaffer']);
  const removedChip = editor.removeProfilePosition(['Playback Operator','Gaffer'],[...sameTitle.map(reference),reference(light)],'Playback Operator');
  assert.deepEqual(removedChip.positions,['Gaffer']);
  assert.deepEqual(removedChip.occupations,[reference(light)]);
});

test('all selectable roles can be selected and removed by stable identity, preserving unrelated legacy content', () => {
  for (const value of primary.occupationCatalogue) {
    const added = editor.toggleProfileOccupation(['Eigene Zusatzangabe'],[],reference(value));
    assert.deepEqual(added.positions,['Eigene Zusatzangabe',value.label]);
    const removed = editor.toggleProfileOccupation(added.positions,added.occupations,reference(value));
    assert.deepEqual(removed.positions,['Eigene Zusatzangabe'],value.roleId);
    assert.deepEqual(removed.occupations,[],value.roleId);
  }
});

test('removing a main occupation invalidates that reference while a removed secondary job preserves the main choice', () => {
  const positions = ['Gaffer','Tiertrainer*in','Tonassistenz'];
  const selections = occupations.selectedCrewOccupations(positions);
  const edited = editor.removeProfilePosition(positions,selections,'Tiertrainer*in');
  assert.equal(primary.primaryOccupationForPositions(reference(animal),edited.positions),null);
  assert.deepEqual(reference(primary.primaryOccupationForPositions(reference(light),edited.positions)),reference(light));
  const empty = editor.removeProfilePosition(['Tiertrainer*in'],[reference(animal)],'Tiertrainer*in');
  assert.deepEqual(empty,{positions:[],occupations:[]});
  assert.deepEqual(editor.removeProfilePosition(['Gaffer'],[reference(light)],'not-selected'),{positions:['Gaffer'],occupations:[reference(light)]});
});

// Execute the actual chip handlers from the page without mounting unrelated account tabs.
function picker(positions, selections = occupations.selectedCrewOccupations(positions), types = ['lighting','location']) {
  const source = readFileSync(new URL('../app/profile/page.tsx',import.meta.url),'utf8');
  const ast = ts.createSourceFile('profile.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const constants = new Set(['TALENT_CHIPS','ANBIETER_CHIPS','TALENT_TYPE_IDS','ANBIETER_TYPE_IDS']);
  const declarations = ast.statements.filter(node => (ts.isFunctionDeclaration(node) && node.name?.text === 'TypeChipPicker') ||
    (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => constants.has(item.name.getText(ast))))).map(node=>node.getText(ast)).join('\n');
  const translate = createTranslator({locale:'de',messages:JSON.parse(readFileSync(new URL('../messages/de.json',import.meta.url),'utf8')),namespace:'FilmAnimals'});
  const bindings = {React,useState:value=>[typeof value==='function'?value():value,()=>{}],useLocale:()=> 'de',useTranslations:()=>translate,
    ...departmentData,...primary,...occupations,...editor,...grip,Search:'svg',X:'svg',ChevronDown:'svg'};
  const compiled = ts.transpileModule(declarations,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
  const Component = new Function('bindings','const {'+Object.keys(bindings).join(',')+'}=bindings;'+compiled+';return TypeChipPicker;')(bindings);
  const changes = {};
  const tree = Component({mode:'roles',positions,occupationSelections:selections,selectedTypes:types,
    onPositionsChange:value=>{changes.positions=value},onOccupationsChange:value=>{changes.occupations=value},onTypesChange:value=>{changes.types=value}});
  const nodes=[];
  const walk=node=>{if(Array.isArray(node))node.forEach(walk);else if(node?.props){nodes.push(node);walk(node.props.children)}};walk(tree);
  return {nodes,changes};
}

test('the real saved chip X removes Tiertrainer and unknown old titles instead of doing nothing', () => {
  for (const title of ['Tiertrainer','Tiertrainer*in','Unbekannte alte Tätigkeit']) {
    const view=picker(['Gaffer',title]);
    const remove=view.nodes.find(node=>node.type==='button'&&node.props['aria-label']===title+' entfernen');
    assert.ok(remove);remove.props.onClick();
    assert.deepEqual(view.changes.positions,['Gaffer']);
    assert.deepEqual(view.changes.occupations,[reference(light)]);
    assert.ok(!view.changes.types || view.changes.types.includes('location'));
  }
});

test('the actual catalogue button unchecks an old animal selection and preserves the remaining light job', () => {
  const view=picker(['Gaffer','Tiertrainer*in'],undefined,['lighting','production','location']);
  const button=view.nodes.find(node=>node.type==='button'&&node.props.children==='Filmtiertrainer/in');
  assert.ok(button);assert.equal(button.props['aria-pressed'],true);button.props.onClick();
  assert.deepEqual(view.changes.positions,['Gaffer']);
  assert.deepEqual(view.changes.occupations,[reference(light)]);
  assert.deepEqual(view.changes.types,['lighting','location']);
});

test('other roles in a shared profile type retain that type and unrelated provider types', () => {
  const view=picker(['Gaffer','Tiertrainer*in','Produktionsleiter (PL)'],undefined,['lighting','production','location']);
  view.nodes.find(node=>node.type==='button'&&node.props['aria-label']==='Tiertrainer*in entfernen').props.onClick();
  assert.deepEqual(view.changes.positions,['Gaffer','Produktionsleiter (PL)']);
  assert.equal(view.changes.types,undefined);
});

test('the actual profile API saves and reloads removal, preserves unrelated fields and still rejects unauthorized writes', async () => {
  const require=createRequire(import.meta.url);const {NextRequest,NextResponse}=require('next/server');
  let signedIn=true;const writes=[];const revalidations=[];
  let saved={user_id:'own-test-user',display_name:'Own test',location:'Berlin',role:'Gaffer',positions:['Gaffer','Tiertrainer*in'],profile_types:['lighting'],
    bio:'Do not change',avatar_url:'/own-test-image.webp',crew:{certificates:['Keep'],primaryOccupation:reference(light),occupations:[reference(light),reference(animal)]}};
  const db=createClient('https://fixture.invalid','test-only-key',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
    const url=new URL(input);assert.equal(url.searchParams.get('user_id'),'eq.own-test-user');
    if(init?.method==='PATCH'){const body=JSON.parse(init.body);writes.push(body);saved={...saved,...body};return new Response(JSON.stringify({user_id:saved.user_id}),{headers:{'content-type':'application/json'}})}
    return new Response(JSON.stringify(saved),{headers:{'content-type':'application/json'}});
  }}});
  const mocks={'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>signedIn?{userId:'own-test-user'}:NextResponse.json({error:'unauthorized'},{status:401})},
    '@clerk/nextjs/server':{clerkClient:async()=>({users:{updateUserMetadata:async()=>{}}})},'next/cache':{revalidateTag:(...args)=>revalidations.push(args)},
    '@/lib/crew-occupations':occupations,'@/lib/primary-occupation':primary,'@/lib/profile-types':await import('./profile-types.ts'),
    '@/lib/profile-display':await import('./profile-display.ts'),'@/lib/profile-cover':await import('./profile-cover.ts'),'@/lib/profile-db-compat':await import('./profile-db-compat.ts')};
  const source=ts.transpileModule(readFileSync(new URL('../app/api/profile/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
  const edit=editor.removeProfilePosition(saved.positions,saved.crew.occupations,'Tiertrainer*in');
  const body={user_id:'other-user',positions:edit.positions,profile_types:saved.profile_types,crew:{...saved.crew,occupations:edit.occupations}};
  const request=()=>new NextRequest('https://fixture.invalid/api/profile',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await mod.exports.PATCH(request())).status,200);
  assert.equal(writes.length,1);assert.equal(saved.user_id,'own-test-user');
  const reload=await mod.exports.GET();assert.equal(reload.status,200);const profile=(await reload.json()).profile;
  assert.deepEqual(profile.positions,['Gaffer']);assert.deepEqual(profile.crew.occupations,[reference(light)]);
  assert.deepEqual(profile.crew.certificates,['Keep']);assert.equal(profile.bio,'Do not change');assert.equal(profile.avatar_url,'/own-test-image.webp');
  const ids=occupations.crewOccupationIds(profile);assert.deepEqual(ids,[light.roleId]);
  assert.equal(occupations.filterCrewOccupations([{occupationIds:ids}],'filmtiere-tiertraining').length,0);
  assert.ok(revalidations.some(([tag,policy])=>tag==='profiles'&&policy.expire===0));
  signedIn=false;assert.equal((await mod.exports.PATCH(request())).status,401);assert.equal(writes.length,1);
});
