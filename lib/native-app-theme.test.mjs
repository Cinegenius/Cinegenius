import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {nativeAppThemeSnapshot,subscribeNativeAppTheme,toggleNativeAppTheme,useNativeAppTheme} from './native-app-theme.ts';

function globals(t,values){
 const original=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const[key,value]of Object.entries(values))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 t.after(()=>{for(const[key,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}});
}

test('SSR and missing DOM keep safe initial theme without browser storage or network',t=>{
 globals(t,{document:undefined});
 assert.equal(nativeAppThemeSnapshot(),'cinema');assert.doesNotThrow(()=>toggleNativeAppTheme());
 assert.doesNotThrow(()=>subscribeNativeAppTheme(()=>{})());
 function Theme(){return React.createElement('span',null,useNativeAppTheme())}
 assert.equal(renderToStaticMarkup(React.createElement(Theme)),'<span>cinema</span>');
});

test('theme quick action updates only the exact app presentation marker; never identity, preferences or network',t=>{
 const attributes={'data-cg-native-community-appearance':'app','data-cg-native-theme-ready':'v1','data-cg-app-theme':'cinema'},writes=[];
 const root={getAttribute:key=>attributes[key]??null,setAttribute:(key,value)=>{writes.push([key,value]);attributes[key]=value}};
 const forbidden=()=>assert.fail('No browser store, provider, cookie or account request for presentation');
 const document={documentElement:root};Object.defineProperty(document,'cookie',{get:forbidden,set:forbidden});
 globals(t,{document,fetch:forbidden,localStorage:new Proxy({},{get:forbidden}),sessionStorage:new Proxy({},{get:forbidden})});
 toggleNativeAppTheme();assert.equal(nativeAppThemeSnapshot(),'pure');
 toggleNativeAppTheme();assert.equal(nativeAppThemeSnapshot(),'cinema');
 assert.deepEqual(writes,[['data-cg-app-theme','pure'],['data-cg-app-theme','cinema']]);
 for(const invalid of [null,'APP','ready','app ','true']){attributes['data-cg-native-community-appearance']=invalid;toggleNativeAppTheme()}
 assert.equal(writes.length,2,'ordinary website cannot be changed by the app control');
 attributes['data-cg-native-community-appearance']='app';
 for(const invalid of [null,'true','ready','v1 ']){attributes['data-cg-native-theme-ready']=invalid;toggleNativeAppTheme()}
 assert.equal(writes.length,2,'older native motion without its ready marker cannot be toggled by fallback');
});

test('theme observation reacts to real theme changes, deduplicates unrelated mutations and disconnects',t=>{
 let theme='cinema',callback,observed,options,disconnected=0,changes=0;
 const root={getAttribute:()=>theme};
 globals(t,{document:{documentElement:root},MutationObserver:class{constructor(cb){callback=cb}observe(node,opts){observed=node;options=opts}disconnect(){disconnected++}}});
 const stop=subscribeNativeAppTheme(()=>changes++);
 assert.equal(observed,root);assert.deepEqual(options,{attributes:true,attributeFilter:['data-cg-app-theme']});
 callback();assert.equal(changes,0);theme='pure';callback();callback();assert.equal(changes,1);
 theme='invalid';callback();assert.equal(changes,2);theme='cinema';callback();assert.equal(changes,2);
 stop();assert.equal(disconnected,1);
});
