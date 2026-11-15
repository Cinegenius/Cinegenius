import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('./map-layer-lifecycle.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(){let next=0,frames=new Map(),moves=[],resizes=0,zooms=0,transforms=0;const mod={exports:{}};
 const map={getCenter:()=>({lat:52,lng:13}),getZoom:()=>10,getBounds:()=>({getNorthWest:()=>({lat:53,lng:12})}),latLngToContainerPoint:()=>({x:1,y:2})};
 const gl={_actualCanvas:{},once:(event,fn)=>moves.push(fn),jumpTo:()=>{}};
 const layer={_map:map,_glMap:gl,_transitionEnd(){throw Error('old unsafe callback')},_resizeContainer(){resizes++},_zoomEnd(){zooms++},onRemove(){this._map=null;this._glMap=null}};
 new Function('require','module','exports','requestAnimationFrame','cancelAnimationFrame',code)(id=>{assert.equal(id,'leaflet');return{DomUtil:{setTransform:()=>transforms++}}},mod,mod.exports,fn=>{frames.set(++next,fn);return next},id=>frames.delete(id));
 mod.exports.guardMapLayerFrames(layer);
 return{layer,map,frames,moves,counts:()=>({resizes,zooms,transforms}),flush(){const calls=[...frames.values()];frames.clear();calls.forEach(fn=>fn())}};
}
test('map resize frames are cancelled on removal and stale move completion cannot touch the removed map',()=>{
 const f=fixture();f.layer._transitionEnd();assert.equal(f.frames.size,1);f.layer.onRemove(f.map);assert.equal(f.frames.size,0);f.flush();assert.deepEqual(f.counts(),{resizes:0,zooms:0,transforms:0});
 const live=fixture();live.layer._transitionEnd();live.flush();assert.equal(live.moves.length,1);live.layer.onRemove(live.map);live.moves[0]();assert.deepEqual(live.counts(),{resizes:1,zooms:0,transforms:1});
});
test('active resize updates stay coalesced and complete normally while instance replacement discards old frames',()=>{
 const f=fixture();f.layer._transitionEnd();f.layer._transitionEnd();assert.equal(f.frames.size,1);f.flush();f.moves[0]();assert.deepEqual(f.counts(),{resizes:1,zooms:1,transforms:1});
 f.layer._transitionEnd();f.layer._map={};f.flush();assert.deepEqual(f.counts(),{resizes:1,zooms:1,transforms:1});
});
