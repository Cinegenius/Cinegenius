import test from 'node:test';
import assert from 'node:assert/strict';
import {installNativeCommunityNavigation, NATIVE_COMMUNITY_NAVIGATION_EVENT as eventName} from './native-community-navigation.ts';

function fixture(t) {
  const previous=Object.fromEntries(['window','document','location'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const host=new EventTarget();host.top=host;host.self=host;
  host.webkit={messageHandlers:{cinegeniusWorkplace:{postMessage(){assert.fail('tab routing never opens native Work')}}}};
  const attrs=new Map([['data-native-app-gesture-ready','v1']]);
  const nav={isConnected:true,getAttribute:key=>attrs.get(key)??null,setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)};
  const state={appearance:'app',calls:[],blocked:false,commits:0};
  Object.assign(globalThis,{window:host,location:new URL('https://fixture.invalid/search?smart=1'),document:{documentElement:{getAttribute:()=>state.appearance}}});
  const stop=installNativeCommunityNavigation(nav,area=>{state.calls.push(area);if(!state.blocked)state.commits++});
  t.after(()=>{stop();for(const[key,value]of Object.entries(previous)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key]}});
  const send=detail=>!host.dispatchEvent(new CustomEvent(eventName,{cancelable:true,detail}));
  return {state,nav,attrs,host,send,stop};
}
test('all four closed public areas reuse one existing navigation action',t=>{const f=fixture(t);for(const area of['shots','news','smart','projects'])assert.equal(f.send(area),true);assert.deepEqual(f.state.calls,['shots','news','smart','projects']);assert.equal(f.state.commits,4)});
test('a recognized but blocked or delayed draft action stays claimed without document fallback',t=>{const f=fixture(t);f.state.blocked=true;assert.equal(f.send('projects'),true);assert.equal(f.state.commits,0);assert.equal(f.state.calls.length,1)});
test('arbitrary routes, private utilities and malformed payloads cannot reach the existing router',t=>{const f=fixture(t);for(const value of['workspace','messages','profile','/projects','https://other.invalid/','constructor','__proto__',null,{},['smart']])assert.equal(f.send(value),false);assert.deepEqual(f.state.calls,[])});
test('ordinary website, nonhttps and missing actual native handler are not claimed',t=>{const f=fixture(t);f.state.appearance='website';assert.equal(f.send('projects'),false);f.state.appearance='app';globalThis.location=new URL('http://fixture.invalid');assert.equal(f.send('projects'),false);globalThis.location=new URL('https://fixture.invalid');delete f.host.webkit;assert.equal(f.send('projects'),false);assert.equal(f.state.commits,0)});
test('child frames, disconnected or unfinished bars cannot consume an intent',t=>{const f=fixture(t);f.host.top={};assert.equal(f.send('projects'),false);f.host.top=f.host;f.nav.isConnected=false;assert.equal(f.send('projects'),false);f.nav.isConnected=true;f.attrs.delete('data-native-app-gesture-ready');assert.equal(f.send('projects'),false);assert.equal(f.state.commits,0)});
test('noncancelable and non-CustomEvent events do not navigate',t=>{const f=fixture(t);f.host.dispatchEvent(new CustomEvent(eventName,{detail:'projects'}));f.host.dispatchEvent(new Event(eventName,{cancelable:true}));assert.equal(f.state.commits,0)});
test('cleanup removes its handler and readiness marker, allowing the previous document fallback',t=>{const f=fixture(t);f.stop();assert.equal(f.attrs.has('data-native-app-area-router'),false);assert.equal(f.send('projects'),false);assert.equal(f.state.commits,0)});
