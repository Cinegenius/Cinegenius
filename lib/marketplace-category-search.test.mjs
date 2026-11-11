import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import * as catalog from './marketplaceCategories.ts';
import * as search from './marketplace-category-search.ts';
import * as offer from './marketplace-offer.ts';

const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
const allIds=catalog.DEPARTMENTS.flatMap(department=>department.groups.map(group=>group.id));
const code=ts.transpileModule(readFileSync(new URL('../components/MarketplaceOfferFields.tsx',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
function elements(node,predicate,result=[]){
 if(Array.isArray(node))for(const child of node)elements(child,predicate,result);
 else if(node&&typeof node==='object'&&node.props){if(predicate(node))result.push(node);elements(node.props.children,predicate,result);}
 return result;
}
function content(node){if(node==null||typeof node==='boolean')return '';if(Array.isArray(node))return node.map(content).join(' ');return typeof node==='object'?content(node.props?.children):String(node);}

// Actual Picker handlers with controlled React state/parent; no transport or persistence.
function picker({locale='de',value='',vehicleOnly=false}={}){
 let language=locale,props={value,vehicleOnly},cursor=0,tree,focusCount=0;
 const slots=[],changes=[];
 const hooks={
  useState(initial){const index=cursor++;if(!slots[index])slots[index]={value:typeof initial==='function'?initial():initial};return [slots[index].value,next=>{slots[index].value=typeof next==='function'?next(slots[index].value):next;}];},
  useRef(initial){const index=cursor++;if(!slots[index])slots[index]={current:initial};return slots[index];},
  useId(){return 'fixture-category-results';},
 };
 const mocks={react:hooks,'react/jsx-runtime':jsx,'next-intl':{useLocale:()=>language,useTranslations:namespace=>translatorFor(language,namespace)},'@/lib/marketplaceCategories':catalog,'@/lib/marketplace-category-search':search,'@/lib/marketplace-offer':{}};
 const loaded={exports:{}};new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(mocks,name),`Unexpected picker import ${name}`);return mocks[name];},loaded,loaded.exports);
 function render(){cursor=0;tree=loaded.exports.MarketplaceCategoryPicker({...props,onChange(next){changes.push(next);props={...props,value:next};}});elements(tree,node=>node.type==='input')[0].props.ref.current={focus(){focusCount++;}};}
 render();
 return {
  changes,get value(){return props.value;},get focusCount(){return focusCount;},get tree(){return tree;},html:()=>renderToStaticMarkup(tree),
  type(query){elements(tree,node=>node.type==='input')[0].props.onChange({target:{value:query}});render();},
  results:()=>elements(tree,node=>node.type==='button'&&Object.hasOwn(node.props,'aria-pressed')),
  selects:()=>elements(tree,node=>node.type==='select'),
  choose(id){const choice=search.marketplaceCategoryOptions(translatorFor(language,'MarketplaceCatalog'),language,{vehicleOnly}).find(choice=>choice.value===id);const button=elements(tree,node=>node.type==='button'&&Object.hasOwn(node.props,'aria-pressed')).find(button=>content(button).includes(choice?.path));assert.ok(button,`Missing result ${id}`);button.props.onClick();render();},
  changeSelect(index,value){elements(tree,node=>node.type==='select')[index].props.onChange({target:{value}});render();},
  clear(){elements(tree,node=>node.type==='button'&&!Object.hasOwn(node.props,'aria-pressed'))[0].props.onClick();render();},
  setLocale(next){language=next;render();},setValue(next){props={...props,value:next};render();},
 };
}

for(const locale of locales){
 test(`${locale}: unchanged leaf IDs have native parent paths and localized alphabetical order`,()=>{
  const t=translatorFor(locale,'MarketplaceCatalog'),choices=search.marketplaceCategoryOptions(t,locale),collator=new Intl.Collator(locale,{sensitivity:'base',numeric:true});
  assert.deepEqual(choices.map(choice=>choice.value).sort(),[...allIds].sort());assert.equal(new Set(choices.map(choice=>choice.value)).size,allIds.length);
  for(const choice of choices){const resolved=catalog.marketplaceCategory(choice.value);assert.equal(choice.departmentId,resolved.department);assert.equal(choice.departmentLabel,t(`categories.${resolved.department}`));assert.equal(choice.label,t(`subcategories.${choice.value}`));assert.equal(choice.path,`${choice.departmentLabel} › ${choice.label}`);}
  for(let index=1;index<choices.length;index++){const previous=choices[index-1],current=choices[index];assert.ok(collator.compare(previous.departmentLabel,current.departmentLabel)<0||(collator.compare(previous.departmentLabel,current.departmentLabel)===0&&collator.compare(previous.label,current.label)<=0));}
  assert.deepEqual(search.searchMarketplaceCategoryOptions('',t,locale),choices);
 });
 test(`${locale}: direct aliases, native terms and synonyms agree with server category candidates`,()=>{
  const t=translatorFor(locale,'MarketplaceCatalog');
  for(const [query,id]of [['Sofa','requisiten-moebel'],['ARRI','kamera-kameras'],['couch','requisiten-moebel'],['DMX','licht-signal'],['Garderobenständer','kostuem-staender'],[t('subcategories.kamera-objektive'),'kamera-objektive']]){
   const choices=search.searchMarketplaceCategoryOptions(query,t,locale);assert.ok(choices.some(choice=>choice.value===id),`${locale}/${query}`);
   const stored=catalog.marketplaceSearchCategories(query,t);assert.ok(stored.includes(id),`${query}: canonical rows stay searchable`);
   const group=catalog.DEPARTMENTS.flatMap(department=>department.groups).find(group=>group.id===id);for(const legacy of catalog.groupValues(group))assert.ok(stored.includes(legacy),`${query}: legacy ${legacy}`);
  }
  assert.deepEqual(search.searchMarketplaceCategoryOptions('Unbekanntes XYZ 9f48',t,locale),[]);
 });
 test(`${locale}: actual Picker selects a direct canonical child with native parent path`,()=>{
  const f=picker({locale}),nav=translatorFor(locale,'MarketplaceNavigation'),t=translatorFor(locale,'MarketplaceCatalog');
  assert.ok(content(f.tree).includes(nav('searchLabel')));assert.equal(f.selects()[1].props.disabled,true);assert.deepEqual(f.changes,[]);
  f.type('Sofa');assert.equal(f.results().length,1);assert.ok(content(f.results()[0]).includes(`${t('categories.requisiten')} › ${t('subcategories.requisiten-moebel')}`));assert.ok(content(f.tree).includes(nav('searchResults',{count:1})));
  for(const button of f.results())assert.equal(button.props.type,'button');
  f.choose('requisiten-moebel');assert.deepEqual(f.changes,['requisiten-moebel']);assert.equal(f.value,'requisiten-moebel');assert.equal(f.selects()[0].props.value,'requisiten');assert.equal(f.selects()[1].props.value,'requisiten-moebel');assert.ok(content(f.tree).includes(nav('selected')));assert.equal(f.focusCount,1);
  f.type('Unbekanntes XYZ 9f48');assert.equal(f.results().length,0);assert.ok(content(f.tree).includes(nav('empty')));assert.equal(f.value,'requisiten-moebel');f.clear();assert.equal(f.focusCount,2);assert.equal(f.value,'requisiten-moebel');
 });
}

test('vehicleOnly confines helper results and native selections to existing vehicle IDs',()=>{
 const t=translatorFor('de','MarketplaceCatalog'),vehicleIds=catalog.DEPARTMENTS.find(department=>department.id==='fahrzeuge').groups.map(group=>group.id);
 assert.deepEqual(search.marketplaceCategoryOptions(t,'de',{vehicleOnly:true}).map(choice=>choice.value).sort(),vehicleIds.sort());
 assert.deepEqual(search.searchMarketplaceCategoryOptions('Sofa',t,'de',{vehicleOnly:true}),[]);
 const f=picker({vehicleOnly:true});assert.deepEqual(elements(f.selects()[0],node=>node.type==='option'&&node.props.value).map(node=>node.props.value),['fahrzeuge']);
 f.type('Auto');assert.ok(f.results().length>0);assert.ok(f.results().every(button=>content(button).includes(t('categories.fahrzeuge'))));f.choose('fahrzeuge-bild');assert.equal(f.value,'fahrzeuge-bild');
 f.changeSelect(0,'fahrzeuge');f.changeSelect(1,'kamera-kameras');assert.deepEqual(f.changes,['fahrzeuge-bild']);
});
test('opening, searching and switching language preserve old values; changing parent requires a new child',()=>{
 for(const value of ['arri','Lichttechnik','Unclear <script>legacy</script>','licht-signal']){
  const f=picker({value});assert.deepEqual(f.changes,[]);f.type('Sofa');f.setLocale('sv');assert.equal(f.value,value);assert.deepEqual(f.changes,[]);
  f.changeSelect(0,'kostuem');assert.equal(f.selects()[0].props.value,'kostuem');assert.equal(f.value,'');assert.equal(f.selects()[1].props.value,'');assert.deepEqual(f.changes,['']);assert.equal(elements(f.tree,node=>node.type==='input')[0].props.value,'');
  const cleared=offer.marketplaceDraft(f.value);assert.equal(offer.validateMarketplaceOffer(f.value,'prop',offer.serializeMarketplaceDraft(cleared),true),'invalidCategory');assert.equal(offer.validateMarketplaceOffer(f.value,'prop',offer.serializeMarketplaceDraft(cleared),false),'invalidCategory');
  f.changeSelect(1,'kostuem-kleidung');assert.deepEqual(f.changes,['','kostuem-kleidung']);
 }
 const unsafe=picker({value:'Unclear <script>legacy</script>'});assert.doesNotMatch(unsafe.html(),/<script>/);assert.match(unsafe.html(),/&lt;script&gt;/);
});
test('external value changes and vehicle-only legacy mismatches do not infer a replacement',()=>{
 const f=picker();f.changeSelect(0,'kostuem');f.setValue('ton-mikrofone');assert.equal(f.selects()[0].props.value,'ton');assert.equal(f.selects()[1].props.value,'ton-mikrofone');assert.deepEqual(f.changes,[]);
 const restricted=picker({value:'arri',vehicleOnly:true});assert.equal(restricted.value,'arri');assert.equal(restricted.selects()[0].props.value,'');assert.equal(restricted.selects()[1].props.disabled,true);assert.deepEqual(restricted.changes,[]);
});
test('search leaves source records unchanged and returns fresh mutable display choices',()=>{
 const original=JSON.stringify(catalog.DEPARTMENTS),t=translatorFor('de','MarketplaceCatalog'),first=search.marketplaceCategoryOptions(t,'de');first[0].label='Controlled mutation';
 assert.notEqual(search.marketplaceCategoryOptions(t,'de')[0].label,'Controlled mutation');for(const query of ['Sofa','ARRI','so','licht','unknown'])search.searchMarketplaceCategoryOptions(query,t,'de');assert.equal(JSON.stringify(catalog.DEPARTMENTS),original);
});
test('live switching through all nine languages preserves search, explored parent and legacy value without callbacks',()=>{
 const f=picker({value:'ARRI'});f.changeSelect(0,'kamera');f.type('Sofa');
 for(const locale of locales){
  f.setLocale(locale);const t=translatorFor(locale,'MarketplaceCatalog');assert.equal(f.value,'ARRI');assert.equal(f.selects()[0].props.value,'kamera');assert.equal(elements(f.tree,node=>node.type==='input')[0].props.value,'Sofa');assert.ok(content(f.tree).includes(`${t('categories.kamera')} › ${t('subcategories.kamera-kameras')}`));assert.deepEqual(f.changes,[]);
 }
 f.choose('requisiten-moebel');assert.deepEqual(f.changes,['requisiten-moebel']);
});
test('selecting the same parent preserves the child; clearing the parent removes the stale child and query',()=>{
 for(const value of ['licht-signal','Lichttechnik']){
  const f=picker({value});f.type('DMX');f.changeSelect(0,'licht');assert.equal(f.value,value);assert.deepEqual(f.changes,[]);
  f.changeSelect(0,'');assert.equal(f.value,'');assert.equal(f.selects()[0].props.value,'');assert.equal(f.selects()[1].props.value,'');assert.equal(f.selects()[1].props.disabled,true);assert.deepEqual(f.changes,['']);assert.equal(elements(f.tree,node=>node.type==='input')[0].props.value,'');
 }
});
test('actual offer-field category callbacks preserve all prices, optional fields and per-category specifications',()=>{
 const loaded={exports:{}},mocks={react:{},'react/jsx-runtime':jsx,'next-intl':{useTranslations:namespace=>translatorFor('de',namespace)},'@/lib/marketplaceCategories':catalog,'@/lib/marketplace-category-search':search,'@/lib/marketplace-offer':offer};
 new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(mocks,name));return mocks[name];},loaded,loaded.exports);
 const original=offer.marketplaceDraft('licht-signal',125);original.values.manufacturer='Opaque original manufacturer';original.values.faults='Opaque original condition';original.specsByCategory={'licht-signal':{universes:'4',protocols:'DMX'},'kostuem-kleidung':{material:'Opaque original fabric'}};
 const snapshot=structuredClone(original),update=(draft,category)=>{let changed;const tree=loaded.exports.default({value:draft,onChange:next=>{changed=next;}});elements(tree,node=>node.type===loaded.exports.MarketplaceCategoryPicker)[0].props.onChange(category);return changed;};
 const cleared=update(original,'');assert.equal(cleared.category,'');assert.deepEqual(cleared.values,snapshot.values);assert.deepEqual(cleared.specsByCategory,snapshot.specsByCategory);assert.equal(offer.validateMarketplaceOffer(cleared.category,'prop',offer.serializeMarketplaceDraft(cleared),false),'invalidCategory');
 const selected=update(cleared,'kostuem-kleidung');assert.equal(selected.category,'kostuem-kleidung');assert.deepEqual(selected.values,snapshot.values);assert.deepEqual(selected.specsByCategory,snapshot.specsByCategory);assert.deepEqual(original,snapshot);assert.equal(offer.validateMarketplaceOffer(selected.category,'prop',offer.serializeMarketplaceDraft(selected),true),null);
});
for(const locale of locales)test(`${locale}: multiple category words intersect and unknown brand words do not widen results`,()=>{
 const t=translatorFor(locale,'MarketplaceCatalog');
 for(const [query,id]of [['Licht DMX','licht-signal'],['Licht DMX','licht-steuerung'],['Sofa Requisiten','requisiten-moebel']]){const matches=search.searchMarketplaceCategoryOptions(query,t,locale);assert.ok(matches.some(choice=>choice.value===id),query);assert.ok(catalog.marketplaceSearchCategories(query,t).includes(id));}
 assert.ok(search.searchMarketplaceCategoryOptions('Licht DMX',t,locale).every(choice=>['licht-signal','licht-steuerung'].includes(choice.value)));
 for(const query of ['Sony Sofa','UnknownBrand Sofa','ARRI UnknownBrand']){assert.deepEqual(catalog.marketplaceSearchCategories(query,t),[],query);assert.deepEqual(search.searchMarketplaceCategoryOptions(query,t,locale),[],query);}
 assert.ok(catalog.marketplaceSearchCategories('Virtual Production',t).every(value=>catalog.marketplaceCategory(value)?.department==='studio'));
});
