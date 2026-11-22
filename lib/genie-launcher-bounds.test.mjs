import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../components/GenieLauncher.tsx',import.meta.url),'utf8');
const actual=source.slice(source.indexOf('  const readBounds = useCallback'),source.indexOf('  const stopMotion = useCallback'));
const code=ts.transpileModule(actual,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function fixture({native=true,area={left:8,right:385,top:67,bottom:810},viewport={offsetLeft:0,offsetTop:0,width:393,height:852}}={}) {
 const attributes=new Map(),style={};let position;
 const dock={current:{getBoundingClientRect:()=>({width:56,height:56}),style,setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)}};
 const bounds={current:{getBoundingClientRect:()=>area}};
 const window={innerWidth:393,innerHeight:852,visualViewport:viewport};
 const functions=new Function('useCallback','dock','bounds','window','native','onPositionChange',code+';return {readBounds,place}')(fn=>fn,dock,bounds,window,native,value=>position=value);
 return {...functions,attributes,style,get position(){return position}};
}

test('native launcher reaches both OS-safe edges instead of reserving app header and navigation space',()=>{
 const f=fixture();assert.deepEqual(f.readBounds(),{left:8,right:329,top:67,bottom:754});
 f.place({x:-100,y:-100});assert.deepEqual(f.position,{x:8,y:67});assert.equal(f.attributes.has('data-hide-placement'),false);assert.equal(f.attributes.get('data-native-genie-normalized-y'),'0');
 f.place({x:1000,y:1000});assert.deepEqual(f.position,{x:329,y:754});assert.equal(f.attributes.has('data-hide-placement'),false);
});
test('native visual viewport uses 8px while the ordinary website retains its 40px top rule',()=>{
 const area={left:0,right:393,top:0,bottom:852};
 assert.equal(fixture({area}).readBounds().top,8);assert.equal(fixture({native:false,area}).readBounds().top,40);
 const web=fixture({native:false,area:{left:8,right:385,top:104,bottom:748}});web.place({x:8,y:-100});
 assert.equal(web.position.y,104);assert.equal(web.attributes.has('data-hide-placement'),false);
});
test('keyboard/panned visual viewport and narrow widths clamp the native icon without an outer close control',()=>{
 const keyboard=fixture({viewport:{offsetLeft:50,offsetTop:100,width:300,height:200}});
 assert.deepEqual(keyboard.readBounds(),{left:58,right:286,top:108,bottom:236});
 keyboard.place({x:0,y:0});assert.deepEqual(keyboard.position,{x:58,y:108});assert.equal(keyboard.attributes.has('data-hide-placement'),false);
 const short=fixture({area:{left:8,right:385,top:8,bottom:100},viewport:{offsetLeft:0,offsetTop:0,width:393,height:108}});
 short.place({x:100,y:0});assert.equal(short.attributes.has('data-hide-placement'),false);
 short.place({x:100,y:44});assert.equal(short.attributes.has('data-hide-placement'),false);
});
test('the full-screen measurement surface never owns pointer input; outer-close styles remain website-only',()=>{
 const f=fixture({native:false});f.place({x:100,y:67});assert.deepEqual(f.position,{x:100,y:67});f.place({x:100,y:400});assert.deepEqual(f.position,{x:100,y:400});
 const css=readFileSync(new URL('../components/Genie.module.css',import.meta.url),'utf8');
 assert.match(css,/\.launcherBounds\s*\{[^}]*pointer-events:\s*none;[^}]*visibility:\s*hidden;/);
 assert.match(css,/html\[data-cg-native-community-appearance="app"\]\) \.launcherBounds[^}]*--cg-app-safe-top[^}]*--cg-app-safe-bottom/);
 assert.match(css,/data-hide-placement="below"[^}]*top:calc\(100% - 4px\)/);
 assert.match(css,/data-hide-placement="inside"[^}]*top:0/);
});

test('the native Web fallback omits its outer hide control while ordinary website placement remains intact',()=>{assert.ok(source.includes('{!native && <button'));});
