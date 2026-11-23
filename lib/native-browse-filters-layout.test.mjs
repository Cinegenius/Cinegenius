import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), nextRequire=createRequire(require.resolve('next/package.json')),postcss=nextRequire('postcss');
const css=readFileSync(new URL('../components/app/NativeBrowseToolbar.module.css',import.meta.url),'utf8');
function rules(source,width){const result=new Map();postcss.parse(source).walkRules(rule=>{let parent=rule.parent;while(parent?.type==='atrule'){if(parent.name==='media'){assert.equal(parent.params,'(prefers-reduced-transparency:reduce)');return;}assert.equal(parent.name,'container');const limit=/max-width:\s*(\d+)px/.exec(parent.params);assert.ok(limit);if(width>Number(limit[1]))return;parent=parent.parent;}for(const selector of rule.selectors){const values=result.get(selector)??{};for(const node of rule.nodes)if(node.type==='decl')values[node.prop]=node.value;result.set(selector,values);}});return result;}
function verify(source){for(const width of [288,292,361]){const r=rules(source,width),kept='.container[data-keep-two-filters]';assert.equal(r.get(kept+' .filter:nth-child(2)')?.display,'block','The second dropdown must remain reachable at 320px');for(const selector of ['.filter','.more','.views :global(.directory-view-button)']){const values=r.get(selector);assert.ok(values);assert.match(values['min-width']??values.width,/44px/,'All six actions retain their 44px target');}if(width<=340){assert.equal(r.get(kept+' .rail')?.padding,'6px 0');assert.equal(r.get(kept+' .filters')?.gap,'0');assert.equal(r.get(kept+' .views')?.['padding-left'],'0');const required=25+2*44+44+3*44+1+2;assert.equal(r.get(kept+' .rail')?.width,'calc(100% + 8px)');assert.equal(r.get(kept+' .rail')?.['margin-inline'],'-4px');assert.ok(required<=width+8,`Two dropdowns, filter and three views fit ${width}px without reducing targets`);}assert.equal(r.get('.rail')?.['min-height'],'58px');}}
test('actual native toolbar keeps the approved two dropdowns plus filter/grid/list/map from 320px',()=>verify(css));
test('causal regressions hiding the second dropdown or restoring wide narrow-screen padding fail the release contract',()=>{
 assert.throws(()=>verify(css.replace('.container[data-keep-two-filters] .filter:nth-child(2) { display:block; }','.container[data-keep-two-filters] .filter:nth-child(2) { display:none; }')));
 assert.throws(()=>verify(css.replace('padding:6px 0','padding:6px 12px')));
 assert.throws(()=>verify(css.replaceAll('min-width:44px','min-width:40px').replaceAll('width:44px','width:40px')));
});
test('actual shared panel preserves viewport/keyboard containment, focus targets and a separate nested equipment section',()=>{
 const panel=postcss.parse(readFileSync(new URL('../components/app/NativeBrowseFilterPanel.module.css',import.meta.url),'utf8')),d=new Map();panel.walkRules(rule=>d.set(rule.selector,Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]))));
 assert.equal(d.get('.panel').position,'fixed');assert.equal(d.get('.panel').overflow,'auto');assert.equal(d.get('.panel')['overscroll-behavior'],'contain');assert.equal(d.get('.choices > button')['min-height'],'44px');
 const location=readFileSync(new URL('../components/app/NativeLocationDetailFilters.tsx',import.meta.url),'utf8');assert.ok(location.indexOf('<details>')<location.indexOf('locations.filterPower'));assert.ok(!location.includes('powerAvailable'));
});
