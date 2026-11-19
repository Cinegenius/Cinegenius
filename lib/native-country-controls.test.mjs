import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {translatorFor} from './i18n-test-fixture.mjs';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
import * as core from './places/core.ts';
import {COUNTRY_CODES} from './places/countries.ts';
import * as choices from './browse-country.ts';
import * as directoryFilters from './organization-directory-filters.ts';
function load(file,mocks){const module={exports:{}};const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',code)(id=>{assert.ok(Object.hasOwn(mocks,id),'Unexpected dependency '+id);return mocks[id]},module,module.exports);return module.exports.default}
function nodes(tree,predicate,out=[]){if(Array.isArray(tree))tree.forEach(child=>nodes(child,predicate,out));else if(tree?.props){if(predicate(tree))out.push(tree);nodes(tree.props.children,predicate,out)}return out}
for(const locale of SUPPORTED_LOCALES)test(`${locale}: complete native country choice has localized labels and no invented choices`,()=>{
 const changed=[];const Component=load('components/app/NativeCountrySelect.tsx',{'react/jsx-runtime':jsx,react:{useMemo:fn=>fn()},'next-intl':{useLocale:()=>locale,useTranslations:namespace=>translatorFor(locale,namespace)},'lucide-react':{Globe:'globe'},'@/components/BrowseSelect':{default:'select'},'@/lib/places/countries':{COUNTRY_CODES},'@/lib/places/core':core,'./NativeBrowseToolbar':{NativeBrowseQuickFilter:'quick'},'./NativeCountrySelect.module.css':{default:{select:'select'}}});
 const tree=Component({value:'AT',onChange:value=>changed.push(value)}),control=nodes(tree,n=>n.type==='select')[0].props;
 assert.equal(control.label,translatorFor(locale,'Places')('country'));assert.equal(control.value,'AT');assert.equal(control.options.length,COUNTRY_CODES.length+2);assert.equal(new Set(control.options.map(x=>x.value)).size,control.options.length);assert.equal(control.options[0].label,translatorFor(locale,'Places')('allCountries'));assert.equal(control.options[1].label,translatorFor(locale,'NewsRegion')('unassignedCountry'));for(const option of control.options)assert.ok(option.label?.trim());assert.equal(control.options.find(x=>x.value==='AT').label,core.countryName('AT',locale));control.onChange('DE');assert.deepEqual(changed,['DE']);
 const compact=Component({value:'AT',onChange:control.onChange,compact:true});assert.equal(compact.type,'quick');assert.equal(compact.props.kind,'country');assert.deepEqual(compact.props.options,control.options);assert.equal(compact.props.label,control.label);
});
test('organization country control is native only and changes a real URL without retaining a previous page',()=>{
 for(const native of[false,true]){const pushes=[];const Component=load('components/organizations/NativeOrganizationCountryFilter.tsx',{'react/jsx-runtime':jsx,'next/navigation':{useRouter:()=>({push:(...args)=>pushes.push(args)})},'@/components/app/NativeCountrySelect':{default:'country'},'@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native},'@/lib/browse-country':choices});const tree=Component({country:'AT'});if(!native){assert.equal(tree,null);continue}const control=nodes(tree,n=>n.type==='country')[0].props;control.onChange('DE');assert.deepEqual(pushes,[['/organizations?country=DE',{scroll:false}]]);control.onChange('all');assert.equal(pushes.at(-1)[0],'/organizations');control.onChange('invalid-country');assert.equal(pushes.length,2)}
});
for(const country of['DE','AT','unassigned','', ['DE','AT']])test(`organization page preserves canonical country and filters through paging/back: ${JSON.stringify(country)}`,async()=>{
 const calls=[];const selected=Array.isArray(country)?'':country;
 const Component=load('app/organizations/page.tsx',{'react/jsx-runtime':jsx,'next/link':{default:'a'},'next-intl/server':{getLocale:async()=>'de',getTranslations:async namespace=>translatorFor('de',namespace)},'@/components/PageHeader':{default:'header'},'@/components/organizations/PublicOrganizationLinks':{OrganizationCards:'cards'},'@/lib/organization-directory':{organizationDirectory:async(filters,locale,signal)=>{calls.push({filters,locale,signal});return{organizations:[{id:'public',slug:'public'}],hasMore:true,count:50,cities:[],filters}}},'@/lib/browse-country':choices,'@/lib/organization-directory-filters':directoryFilters,'@/components/app/NativeOrganizations':{default:'native-organizations'}});
 const tree=await Component({searchParams:Promise.resolve({country,page:'2',q:'film',city:'id:berlin'})});
 const filters={country:selected,page:2,q:'film',city:'id:berlin'};
 assert.deepEqual(calls[0].filters,filters);assert.equal(calls[0].locale,'de');assert.ok(calls[0].signal instanceof AbortSignal);
 assert.deepEqual(tree.props.data.filters,filters);
 const links=nodes(tree,n=>n.type==='a').map(n=>n.props.href);
 assert.ok(links.includes(selected?`/news?country=${selected}`:'/news'));
 for(const page of [1,3])assert.ok(links.includes(directoryFilters.organizationDirectoryHref({...filters,page})));
});
