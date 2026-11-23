import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {browseFilterControls,hasBrowseFilterControls} from './browse-filter-controls.ts';
import {readSearchBrowseFilters} from './browse-filters.ts';
test('UI controls normalize only presentation blanks, sorted selection and numeric input; the server validates every request',()=>{
 assert.deepEqual(browseFilterControls({version:1,country:'',departments:[],location:{sqm:'0',power:''}}),{version:1});
 assert.equal(hasBrowseFilterControls({version:1}),false);
 const input={version:1,companyCategories:['kameraverleih','lichtverleih','kameraverleih'],location:{currency:'EUR',min:'12,50',sqm:'40.500000',power:'1'}};
 const normalized=browseFilterControls(input);assert.deepEqual(readSearchBrowseFilters(normalized),normalized);assert.equal(normalized.location.min,'12.5');assert.equal(normalized.location.sqm,'40.5');assert.deepEqual(normalized.companyCategories,['kameraverleih','lichtverleih']);
 assert.equal(readSearchBrowseFilters(browseFilterControls({version:1,companyCategories:['invented-role']})),null);
 assert.equal(readSearchBrowseFilters(browseFilterControls({version:1,location:{min:'-1'}})),null);
});
test('actual numeric input handlers defer Smart requests until blur/Enter and keep local directory fields immediate',()=>{
 const require=createRequire(import.meta.url),source=ts.transpileModule(readFileSync(new URL('../components/app/NativeFilterNumber.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const defer of [true,false]){
  let draft='',value='',commits=[],blurred=0;const m={exports:{}};
  new Function('require','module','exports',source)(id=>id==='react'?{useState:()=>[draft,next=>{draft=next}]}:require(id),m,m.exports);
  const render=()=>m.exports.default({value,defer,onCommit:next=>{value=next;commits.push(next)}});
  render().props.onChange({target:{value:'50'}});assert.equal(render().props.value,'50');assert.deepEqual(commits,defer?[]:['50']);
  render().props.onBlur({target:{value:'50'}});assert.deepEqual(commits,['50']);
  render().props.onKeyDown({key:'Enter',preventDefault(){},currentTarget:{blur(){blurred++}}});assert.equal(blurred,defer?1:0);
 }
});
test('the client controls module imports only the type and does not bundle the authoritative place/coordinate databases',()=>{
 const source=readFileSync(new URL('./browse-filter-controls.ts',import.meta.url),'utf8'),compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 assert.doesNotMatch(compiled,/\bimport\b|\brequire\(/);assert.doesNotMatch(compiled,/city-coordinates|publicMapPoint|placeCatalog/);
});
