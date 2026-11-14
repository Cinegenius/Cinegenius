import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {SUPPORTED_LOCALES} from '../../lib/i18n/locales.ts';

const origin = 'https://www.cinegenius.co';
const template = readFileSync(new URL('../src/voice.js', import.meta.url), 'utf8');
const script = template.replace('null /* CINEGENIUS_VOICE_CONFIG */', () => JSON.stringify({origin, locales:SUPPORTED_LOCALES}));
function fixture({transport = 'ios', url = origin, subframe = false} = {}) {
  const listeners = new Map(), events = [], sent = [], timers = new Map(), intervals = new Map();
  let sequence = 0, broken = false;
  const listen = (name, callback) => listeners.set(name, [...(listeners.get(name) ?? []), callback]);
  const emit = event => {events.push(event); for (const listener of listeners.get(event.type) ?? []) listener(event);};
  const location = {origin:new URL(url).origin, href:url};
  const document = {visibilityState:'visible', addEventListener:listen};
  const navigator = {userActivation:{isActive:true}};
  const native = {postMessage: value => {if (broken) throw new Error('detached'); sent.push(typeof value === 'string' ? JSON.parse(value) : value);}};
  const window = {addEventListener:listen, dispatchEvent:emit}; window.self = window; window.top = subframe ? {} : window;
  if (transport === 'ios') window.webkit = {messageHandlers:{cinegeniusVoice:native}};
  if (transport === 'android') window.cinegeniusVoiceNative = native;
  const context = vm.createContext({window, document, location, navigator, crypto:{randomUUID},
    Event:class {constructor(type) {this.type = type;}}, CustomEvent:class {constructor(type, options) {this.type = type; Object.assign(this, options);}},
    setTimeout:(fn, ms) => {const id = ++sequence; timers.set(id, {fn,ms}); return id;}, clearTimeout:id => timers.delete(id),
    setInterval:fn => {const id = ++sequence; intervals.set(id, fn); return id;}, clearInterval:id => intervals.delete(id),
  });
  vm.runInContext(script, context);
  return {window, api:window.CineGeniusVoice, document, location, navigator, events, sent, timers, intervals,
    emit: type => emit({type}), breakTransport:() => {broken = true;},
    reply: (request, payload) => {
      const message = {v:1, documentId:request.documentId, requestId:request.requestId, ...payload};
      if (transport === 'android') native.onmessage({data:JSON.stringify(message)});
      else window.__cinegeniusVoiceReceive(message);
    },
    tick: () => [...intervals.values()].forEach(fn => fn()),
    timeout: () => [...timers.values()].forEach(({fn}) => fn()),
  };
}
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

test('voice is absent outside the configured native main frame', () => {
  for (const options of [{transport:'none'}, {subframe:true}, {url:'https://www.cinegenius.co.evil.test'},
    {url:'http://www.cinegenius.co'}, {url:'https://www.cinegenius.co:8443'}, {url:'capacitor://localhost'}]) {
    const f = fixture(options); assert.equal(f.api, undefined); assert.equal(f.sent.length, 0);
  }
});

for (const transport of ['ios', 'android']) {
  test(`${transport}: installing and checking availability never requests microphone permission`, async () => {
    const f = fixture({transport}); assert.equal(f.sent.length, 0);
    assert.ok(f.events.some(event => event.type === 'cinegenius:voice-ready'));
    const pending = f.api.capabilities({locale:'nl-BE'});
    assert.equal(f.sent[0].action, 'capabilities');
    f.reply(f.sent[0], {type:'result', result:{recognition:true, synthesis:false, systemServiceMayProcessAudio:true}});
    assert.equal((await pending).recognition, true); assert.equal(f.timers.size, 0);
  });
  test(`${transport}: transcript is final-only, scoped to its document and request, and never executed`, async () => {
    const f = fixture({transport}), pending = f.api.start({locale:'de', token:'must-not-cross-bridge'}), request = f.sent[0];
    assert.equal(request.token, undefined);
    f.reply(request, {type:'result', documentId:randomUUID(), result:{text:'foreign'}});
    f.reply(request, {type:'result', requestId:randomUUID(), result:{text:'foreign'}});
    f.reply(request, {type:'state', state:'listening', partialText:'Entwurf'});
    assert.equal(f.timers.size, 1);
    f.api.stop(); assert.equal(f.sent.at(-1).action, 'stop'); assert.equal(f.timers.size, 1);
    const text = 'München: "Kamera" </script> ${notExecutable}';
    f.reply(request, {type:'result', result:{text}});
    assert.equal((await pending).text, text);
    assert.equal(f.sent.length, 2, 'no send, navigation, or write command exists');
    assert.equal(f.timers.size, 0); assert.equal(f.intervals.size, 0);
  });
  test(`${transport}: cancellation discards late results without affecting a newer recording`, async () => {
    const f = fixture({transport}), first = f.api.start({locale:'de'}), old = f.sent[0];
    const cancelled = rejects(first, 'cancelled'); f.api.cancel(); await cancelled;
    const next = f.api.start({locale:'en'}), request = f.sent.at(-1);
    f.reply(old, {type:'result', result:{text:'old private transcript'}}); assert.equal(f.timers.size, 1);
    f.reply(request, {type:'result', result:{text:'new text'}}); assert.equal((await next).text, 'new text');
  });
}

test('microphone requires visible page, explicit activation, supported locale and no simultaneous capture', async () => {
  const f = fixture(); f.navigator.userActivation.isActive = false;
  await rejects(f.api.start({locale:'de'}), 'gesture-required');
  f.navigator.userActivation.isActive = true;
  await rejects(f.api.start({locale:'fr'}), 'language-unavailable');
  f.document.visibilityState = 'hidden'; await rejects(f.api.start({locale:'de'}), 'interrupted');
  assert.equal(f.sent.length, 0); f.document.visibilityState = 'visible';
  const first = f.api.start({locale:'de'}); await rejects(f.api.start({locale:'de'}), 'busy');
  const cancelled = rejects(first, 'cancelled'); f.api.cancel(); await cancelled;
});

test('capability queries work for all nine locales without sending account material', async () => {
  const f = fixture();
  for (const locale of SUPPORTED_LOCALES) {
    const pending = f.api.capabilities({locale, account:'private'}), request = f.sent.at(-1);
    assert.equal(request.locale, locale); assert.equal(request.account, undefined);
    f.reply(request, {type:'result', result:{recognition:false, synthesis:false, systemServiceMayProcessAudio:true}});
    await pending;
  }
});

for (const event of ['pagehide','popstate','visibilitychange','route-change']) {
  test(`${event} cancels audio, and detached transport cannot leave promises pending`, async () => {
    const f = fixture(), recording = f.api.start({locale:'de'}), capability = f.api.capabilities({locale:'de'});
    const checks = [rejects(recording, 'interrupted'), rejects(capability, 'interrupted')];
    f.breakTransport();
    if (event === 'visibilitychange') f.document.visibilityState = 'hidden';
    if (event === 'route-change') {f.location.href += '/sign-in'; f.tick();} else f.emit(event);
    await Promise.all(checks); assert.equal(f.timers.size, 0); assert.equal(f.intervals.size, 0);
  });
}

test('permission denial remains a stable error and never starts a fallback microphone', async () => {
  const f = fixture(), pending = f.api.start({locale:'de'});
  f.reply(f.sent[0], {type:'error', code:'permission-denied'});
  await rejects(pending, 'permission-denied'); assert.equal(f.sent.length, 1);
});

test('native timeouts cancel the request and reject late replies', async () => {
  const f = fixture(), pending = f.api.start({locale:'de'});
  const timedOut = rejects(pending, 'timeout'); f.timeout(); await timedOut;
  assert.equal(f.sent.at(-1).action, 'cancel');
  f.reply(f.sent[0], {type:'result', result:{text:'too late'}}); assert.equal(f.timers.size, 0);
});

test('invalid native payloads do not become a successful transcript', async () => {
  for (const result of [{}, {text:''}, {text:4}, {text:'a'.repeat(6001)}]) {
    const f = fixture(), pending = f.api.start({locale:'de'});
    f.reply(f.sent[0], {type:'result', result});
    await rejects(pending, result.text === '' ? 'no-speech' : 'invalid-request');
  }
  const f = fixture(), pending = f.api.capabilities({locale:'de'});
  f.reply(f.sent[0], {type:'result', result:{recognition:'true'}}); await rejects(pending, 'invalid-request');
});

test('speaking cancels capture, respects length and language, and stops on backgrounding', async () => {
  const f = fixture();
  for (const text of ['', ' ', 'a'.repeat(6001), null]) await rejects(f.api.speak({locale:'de',text}), 'invalid-request');
  await rejects(f.api.speak({locale:'fr',text:'Bonjour'}), 'language-unavailable');
  const recording = f.api.start({locale:'de'}), cancelled = rejects(recording, 'cancelled');
  const speech = f.api.speak({locale:'de',text:'Antwort'}); await cancelled;
  assert.equal(f.sent.at(-2).action, 'cancel'); assert.equal(f.sent.at(-1).action, 'speak');
  const interrupted = rejects(speech, 'interrupted'); f.document.visibilityState = 'hidden'; f.emit('visibilitychange');
  await interrupted; assert.equal(f.sent.at(-1).action, 'stopSpeaking');
});

test('starting capture stops speech, successful speech resolves without text', async () => {
  const f = fixture(), speech = f.api.speak({locale:'de',text:'Antwort'});
  const stopped = rejects(speech, 'cancelled'), recording = f.api.start({locale:'de'}); await stopped;
  assert.equal(f.sent.at(-2).action, 'stopSpeaking');
  const cancelled = rejects(recording, 'cancelled'); f.api.cancel(); await cancelled;
  const next = f.api.speak({locale:'nl-BE',text:'Antwoord'});
  f.reply(f.sent.at(-1), {type:'result', result:{}}); assert.equal(await next, undefined);
});

test('transport failure and bounded pending requests fail promptly', async () => {
  const f = fixture(); f.breakTransport(); await rejects(f.api.start({locale:'de'}), 'unavailable'); assert.equal(f.timers.size, 0);
  const g = fixture(), pending = Array.from({length:8}, () => g.api.capabilities({locale:'de'}));
  await rejects(g.api.capabilities({locale:'de'}), 'busy');
  const checks = pending.map(p => rejects(p, 'timeout')); g.timeout(); await Promise.all(checks);
});
