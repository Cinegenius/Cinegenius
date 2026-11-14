import test from 'node:test';
import assert from 'node:assert/strict';
import {createGenieRecorder} from './genie-recorder.ts';
import {isGenieSearchHref,isGenieCrewSearchHref,withinCrewRadius} from './genie-search.ts';
import {matchesAudioContainer,selectGenieSpeechVoice,GENIE_SPEECH_RATE,GENIE_SPEECH_VOLUME} from './genie-voice.ts';
test('only bounded, single-valued read-only directory destinations can be opened by voice',()=>{
 for(const href of ['/props?genie=1&q=Boot&cityText=Berlin','/locations?genie=1&q=Studio&country=CH','/locations?genie=1&country=CH'])assert.equal(isGenieSearchHref(href),true,href);
 for(const href of ['/props','/locations?q=Studio','/props?genie=1','/props?genie=1&country=ZZ','/props?genie=1&q=Boot&q=Bike','/locations?genie=1&q=Studio&delete=1','/api/listings?genie=1&q=Boot','//outside.invalid/props?genie=1&q=Boot','/props?genie=1&q=%3Cscript%3E','/props?genie=1&q=%5cfoo','/props?genie=1&q=Boot#admin','/locations?genie=1&country=','/props?genie=1&q='+ 'x'.repeat(151)])assert.equal(isGenieSearchHref(href),false,href);
});
test('calmer speech prefers an available natural voice without switching language or mutating voice order',()=>{
 const voices=[{name:'Basic',lang:'de-DE',localService:true,default:false},{name:'Natural English',lang:'en-US',default:true,localService:false},{name:'Enhanced German',lang:'de-DE',localService:true,default:false}];
 const before=[...voices];assert.equal(selectGenieSpeechVoice(voices,'de'),voices[2]);assert.deepEqual(voices,before);
 assert.equal(selectGenieSpeechVoice(voices,'it'),null);assert.equal(selectGenieSpeechVoice([],'de'),null);
 assert.equal(selectGenieSpeechVoice([{name:'Nederlands',lang:'nl-NL'},{name:'Vlaams',lang:'nl-BE'}],'nl-BE').name,'Vlaams');
 assert.ok(GENIE_SPEECH_RATE<1&&GENIE_SPEECH_RATE>=0.9);assert.ok(GENIE_SPEECH_VOLUME<1&&GENIE_SPEECH_VOLUME>=0.8);
});
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function fixture(t,{permission,provider,native}={}){
 const states=[],texts=[],errors=[],requests=[],recorders=[],tracks=[];const original={window:globalThis.window,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),MediaRecorder:globalThis.MediaRecorder,fetch:globalThis.fetch};
 class Recorder{
  static isTypeSupported(type){return type.startsWith('audio/webm');}
  constructor(stream,options){this.mimeType=options.mimeType;this.state='inactive';recorders.push(this);}
  start(){this.state='recording';}
  stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob([new Uint8Array(30)],{type:this.mimeType})});this.onstop?.();});}
 }
 const makeStream=()=>{const track={stopped:false,stop(){this.stopped=true;}};tracks.push(track);return{getTracks:()=>[track],getAudioTracks:()=>[track]};};
 globalThis.window=Object.assign(new EventTarget(),{CineGeniusVoice:native});globalThis.MediaRecorder=Recorder;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>permission?permission.promise:makeStream()}}});
 globalThis.fetch=async(url,init)=>{requests.push({url,init});return provider?provider(url,init):Response.json({text:'Kamera in München'});};
 const recorder=createGenieRecorder({state:s=>states.push(s),text:s=>texts.push(s),error:s=>errors.push(s)});
 t.after(()=>{recorder.cancel(false);globalThis.window=original.window;globalThis.MediaRecorder=original.MediaRecorder;globalThis.fetch=original.fetch;if(original.navigator)Object.defineProperty(globalThis,'navigator',original.navigator);else delete globalThis.navigator;});
 return{recorder,states,texts,errors,requests,recorders,tracks,makeStream};
}
test('opening is silent; explicit recording closes tracks before a same-origin transcription',async t=>{
 const f=fixture(t);assert.equal(f.requests.length,0);await f.recorder.start('de');assert.equal(f.tracks.length,1);assert.equal(f.requests.length,0);assert.equal(f.states.at(-1),'recording');f.recorder.stop();assert.ok(f.tracks[0].stopped);await flush();assert.deepEqual(f.texts,['Kamera in München']);assert.equal(f.requests[0].url,'/api/genie/transcribe');assert.equal(f.requests[0].init.headers['X-Genie-Locale'],'de');assert.equal(f.states.at(-1),'idle');
});
test('cancelling a late microphone permission stops acquired tracks and does not upload',async t=>{
 const permission=defer(),f=fixture(t,{permission});const pending=f.recorder.start('it');f.recorder.cancel();permission.resolve(f.makeStream());await pending;await flush();assert.ok(f.tracks[0].stopped);assert.equal(f.requests.length,0);assert.equal(f.recorders.length,0);
});
test('cancelled upload cannot send a late transcript to a new account/panel',async t=>{
 const pending=defer(),f=fixture(t,{provider:()=>pending.promise});await f.recorder.start('de');f.recorder.stop();await flush();f.recorder.cancel(false);assert.ok(f.requests[0].init.signal.aborted);pending.resolve(Response.json({text:'Late private speech'}));await flush();assert.deepEqual(f.texts,[]);
});
test('a late stop event from an old recording cannot stop the new microphone',async t=>{
 const f=fixture(t);await f.recorder.start('de');f.recorder.cancel();await f.recorder.start('de');await flush();assert.equal(f.tracks[1].stopped,false);assert.equal(f.requests.length,0);
});
test('native permission denial is not bypassed by a browser microphone',async t=>{
 const f=fixture(t,{native:{version:1,start:async()=>{throw{code:'permission-denied'}},cancel(){}}});await f.recorder.start('de');assert.deepEqual(f.errors,['permission']);assert.equal(f.tracks.length,0);assert.equal(f.requests.length,0);
});
test('native final transcript returns without uploading audio or automatically writing records',async t=>{
 const f=fixture(t,{native:{version:1,start:async()=>({text:'Mittagspause eine Stunde später'}),cancel(){}}});await f.recorder.start('de');assert.deepEqual(f.texts,['Mittagspause eine Stunde später']);assert.equal(f.requests.length,0);assert.equal(f.tracks.length,0);
});
test('a native finalization that never responds times out and discards a late result',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const result=defer();let stops=0;
 const f=fixture(t,{native:{version:1,start:()=>result.promise,stop(){stops++},cancel(){}}});
 const pending=f.recorder.start('de');f.recorder.stop();f.recorder.stop();assert.equal(stops,1);
 t.mock.timers.tick(15_001);assert.deepEqual(f.errors,['timeout']);
 result.resolve({text:'Late result'});await pending;assert.deepEqual(f.texts,[]);
});
test('search links cannot escape read-only crew navigation, including after stored-history restore',()=>{
 assert.ok(isGenieCrewSearchHref('/creators?genie=1&department=kamera&near=geonames%3A2867714&radius=50'));
 for(const href of ['//foreign.invalid','/api/admin?genie=1','/creators?genie=1&department=kamera&redirect_url=https://foreign.invalid','/creators?genie=1&department=kamera&radius=999','/creators?genie=1&department=kamera&department=licht','/creators?genie=1&department=kamera#script','/creators?genie=1&near=x&radius=50'])assert.equal(isGenieCrewSearchHref(href),false,href);
});
test('radius searches match approximate public coordinates and omit unknown places',()=>{
 const near={id:'munich',name:'München',lat:48.137,lng:11.575,radius:50};
 assert.ok(withinCrewRadius({lat:48.137,lng:11.575},near));assert.ok(withinCrewRadius({lat:48.26,lng:11.43},near));assert.equal(withinCrewRadius({lat:52.52,lng:13.4},near),false);assert.equal(withinCrewRadius({},near),false);assert.equal(withinCrewRadius({lat:NaN,lng:11},near),false);
});
test('container checks distinguish permitted media from text or mismatched uploads',()=>{
 assert.ok(matchesAudioContainer(new Uint8Array([0x1a,0x45,0xdf,0xa3,...Array(8).fill(0)]),'audio/webm'));
 assert.equal(matchesAudioContainer(new TextEncoder().encode('not an audio recording'),'audio/webm'),false);
 assert.equal(matchesAudioContainer(new Uint8Array(4),'audio/mp4'),false);
});
