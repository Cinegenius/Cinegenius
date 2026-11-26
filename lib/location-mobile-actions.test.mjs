import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const postcss = nextRequire('postcss');
const source = readFileSync(new URL('../components/LocationDetail.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../components/LocationDetail.module.css', import.meta.url), 'utf8');
const ast = ts.createSourceFile('LocationDetail.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isFunctionExpression(node) && node.name?.text === 'bindLocationMobileActions') effect = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
const property = '--native-location-action-bottom';

function fixture({native = true, height = 852, top = 746, dockPresent = true, visible = true, previous = ''} = {}) {
  const values = new Map(previous ? [[property, previous]] : []), priorities = new Map();
  const state = {writes: 0, frames: new Map(), observers: [], mutations: [], events: new Map(), viewportEvents: new Map()};
  let nextFrame = 0;
  const actions = {isConnected: true, style: {
    getPropertyValue: key => values.get(key) ?? '', getPropertyPriority: key => priorities.get(key) ?? '',
    setProperty(key, value, priority = '') { values.set(key, value); priorities.set(key, priority); state.writes++; },
    removeProperty(key) { values.delete(key); priorities.delete(key); state.writes++; },
  }};
  const makeDock = value => ({top: value, visible: true, getClientRects() { return this.visible ? [{}] : []; }, getBoundingClientRect() { return {top: this.top}; }});
  let dock = dockPresent ? makeDock(top) : null;
  if (dock) dock.visible = visible;
  const window = {innerHeight: height, addEventListener: (name, fn) => state.events.set(name, fn), removeEventListener: name => state.events.delete(name),
    visualViewport: {addEventListener: (name, fn) => state.viewportEvents.set(name, fn), removeEventListener: name => state.viewportEvents.delete(name)}};
  const env = {nativeAppearance: native, mobileActions: {current: actions}, window,
    document: {querySelector: () => dock, body: {name: 'body'}, documentElement: {name: 'html'}},
    requestAnimationFrame: fn => {state.frames.set(++nextFrame, fn); return nextFrame;}, cancelAnimationFrame: id => state.frames.delete(id),
    ResizeObserver: class { observed = new Set(); constructor(fn) {this.callback = fn; state.observers.push(this);} observe(node) {this.observed.add(node);} unobserve(node) {this.observed.delete(node);} disconnect() {this.observed.clear();this.disconnected = true;} },
    MutationObserver: class { records = []; constructor(fn) {this.callback = fn;state.mutations.push(this);} observe(node, options) {this.records.push({node,options});} disconnect() {this.disconnected = true;} },
  };
  let cleanup;
  if (effect) {
    const code = ts.transpileModule('module.exports=' + effect, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
    const module = {exports: {}};
    new Function('module', 'exports', ...Object.keys(env), code)(module, module.exports, ...Object.values(env));
    cleanup = module.exports();
  }
  return {state, values, actions, window, get dock() {return dock;}, cleanup: () => cleanup?.(),
    replaceDock(value) {dock = value === null ? null : makeDock(value);},
    flush() {const pending = [...state.frames.values()];state.frames.clear();for (const fn of pending) fn();},
    mutations() {state.mutations[0]?.callback([]);},
  };
}

test('Location CTA uses the actual dock top with an 8px gap across phone, safe-area and resized keyboard layouts', () => {
  assert.ok(effect, 'the mobile CTA must not remain fixed below the native app dock');
  for (const [height, top] of [[852,746],[809,659],[568,496],[393,300],[500,394],[932,811]]) {
    const f = fixture({height,top}), bottom = Number.parseFloat(f.values.get(property));
    assert.equal(height - bottom, top - 8);f.cleanup();
  }
});

test('ordinary website installs no geometry observers, handlers, or inline positioning', () => {
  const f = fixture({native:false});assert.equal(f.values.size,0);assert.equal(f.state.observers.length,0);assert.equal(f.state.mutations.length,0);assert.equal(f.state.events.size,0);
  assert.match(source,/lg:hidden fixed bottom-0/);
});

test('late dock load, replacement and removal rebind observation and release only the owned inset', () => {
  const f = fixture({dockPresent:false});assert.equal(f.values.has(property),false);
  f.replaceDock(746);f.mutations();f.flush();assert.equal(f.values.get(property),'114px');const old=f.dock;
  f.replaceDock(700);f.mutations();f.flush();assert.equal(f.values.get(property),'160px');assert.equal(f.state.observers[0].observed.has(old),false);assert.equal(f.state.observers[0].observed.has(f.dock),true);
  f.replaceDock(null);f.mutations();f.flush();assert.equal(f.values.has(property),false);f.cleanup();
});

test('resize, orientation and visual viewport changes coalesce and preserve alignment rather than inventing keyboard offsets', () => {
  const f=fixture();f.window.innerHeight=500;f.dock.top=380;
  f.state.events.get('resize')();f.state.events.get('orientationchange')();f.state.viewportEvents.get('resize')();f.state.viewportEvents.get('scroll')();
  assert.equal(f.state.frames.size,1);f.flush();assert.equal(f.values.get(property),'128px');assert.equal(500-128,380-8);f.cleanup();
});

test('hidden and invalid dock geometry falls back without producing NaN or negative CSS', () => {
  for(const options of [{visible:false},{top:NaN},{top:0}]){const f=fixture(options);assert.equal(f.values.has(property),false);f.cleanup();}
});

test('unmount cancels pending work, disconnects all observation, and restores the previous owned style', () => {
  const f=fixture({previous:'151px'});f.state.events.get('resize')();assert.equal(f.state.frames.size,1);f.cleanup();
  assert.equal(f.values.get(property),'151px');assert.equal(f.state.frames.size,0);assert.equal(f.state.events.size,0);assert.equal(f.state.viewportEvents.size,0);
  assert.equal(f.state.observers[0].disconnected,true);assert.equal(f.state.mutations[0].disconnected,true);
  const writes=f.state.writes;f.state.observers[0].callback([]);f.flush();assert.equal(f.state.writes,writes);
});

test('cleanup never overwrites a newer external value of the local property', () => {
  const f=fixture();f.actions.style.setProperty(property,'222px');f.cleanup();assert.equal(f.values.get(property),'222px');
});

test('app-only component CSS has safe-area fallback and 44px actions without global chrome overrides', () => {
  const rules=[];postcss.parse(css).walkRules(rule=>rules.push(rule));assert.ok(rules.length);
  for(const rule of rules){assert.match(rule.selector,/^:global\(html\[data-cg-native-community-appearance="app"\](?:\[data-native-genie-owner-ready="uikit-v1"\]\[data-native-genie-availability="available"\])?\) \.mobileActionBar/);assert.doesNotMatch(rule.selector,/data-native-app-bottom-nav|data-native-app-navbar|site-main/);}
  const main=rules.find(rule=>rule.selector.endsWith('.mobileActionBar'));const bottom=main.nodes.find(node=>node.prop==='bottom')?.value;
  assert.match(bottom,/--native-location-action-bottom/);assert.match(bottom,/--mobile-nav-clearance/);
  assert.match(css,/safe-area-inset-left/);assert.match(css,/safe-area-inset-right/);assert.match(css,/min-height: 44px/);
});
