import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const template = readFileSync(new URL('../src/app-viewport.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app-viewport.css', import.meta.url), 'utf8');
const origin = 'https://www.cinegenius.co';
const script = template.replace('null /* CINEGENIUS_VIEWPORT_CONFIG */', () => JSON.stringify({origin, css, styleId:'cinegenius-app-viewport'}));

function fixture({url = origin, subframe = false, headReady = true} = {}) {
  const styles = [];
  let callback;
  let disconnected = false;
  const head = {append: style => styles.push(style)};
  const document = {
    head: headReady ? head : null,
    getElementById: id => styles.find(style => style.id === id),
    createElement: tag => { assert.equal(tag, 'style'); return {}; },
  };
  const window = {location: {origin: new URL(url).origin}};
  window.self = window;
  window.top = subframe ? {} : window;
  const context = vm.createContext({window, document, MutationObserver: class {
    constructor(fn) {callback = fn;}
    observe(target) {assert.equal(target, document);}
    disconnect() {disconnected = true;}
  }});
  return {styles, run: () => vm.runInContext(script, context),
    ready() {document.head = head; callback();},
    get observed() {return !!callback;}, get disconnected() {return disconnected;}};
}

test('bundled viewport styles apply once to the configured main page', () => {
  const f = fixture(); f.run(); f.run();
  assert.deepEqual(f.styles, [{id:'cinegenius-app-viewport', textContent:css}]);
  assert.equal(f.observed, false);
});

test('viewport adapter leaves other origins and embedded pages unchanged', () => {
  for (const options of [{subframe:true}, {url:'https://www.cinegenius.co.evil.example'},
    {url:'http://www.cinegenius.co'}, {url:'https://www.cinegenius.co:8443'},
    {url:'https://clerk.cinegenius.co'}, {url:'capacitor://localhost'}]) {
    const f = fixture(options); f.run();
    assert.deepEqual(f.styles, []); assert.equal(f.observed, false);
  }
});

test('document-start installation waits for the head, then stops observing', () => {
  const f = fixture({headReady:false}); f.run();
  assert.equal(f.observed, true); assert.deepEqual(f.styles, []);
  f.ready(); assert.equal(f.disconnected, true);
  f.run(); assert.equal(f.styles.length, 1);
});
