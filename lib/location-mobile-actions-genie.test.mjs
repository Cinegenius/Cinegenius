import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve('next/package.json'))('postcss');
const css = postcss.parse(readFileSync(new URL('../components/LocationDetail.module.css', import.meta.url), 'utf8'));

// Evaluate the actual small calc/var expression, without a browser-layout claim.
function numeric(expression, values) {
  const tokens = expression.match(/--[\w-]+|\d+(?:\.\d+)?px|calc|var|[()+,]/g) ?? [];
  let at = 0;
  const take = value => {assert.equal(tokens[at++], value);};
  const sum = () => {let n = primary(); while(tokens[at] === '+') {at++;n += primary();} return n;};
  const primary = () => {
    const token = tokens[at++];
    if(token === 'calc') {take('('); const n = sum(); take(')'); return n;}
    if(token === 'var') {
      take('('); const key = tokens[at++]; let fallback;
      if(tokens[at] === ',') {at++;fallback = sum();} take(')');
      return values[key] === undefined ? fallback : numeric(values[key], values);
    }
    assert.match(token ?? '', /^\d+(?:\.\d+)?px$/); return Number.parseFloat(token);
  };
  const result = sum(); assert.equal(at, tokens.length); return result;
}

function bottom({app = true, owner = 'uikit-v1', state = 'available', webGenie = false, measured = 106} = {}) {
  const attributes = {'data-cg-native-community-appearance': app ? 'app' : '', 'data-native-genie-owner-ready': owner, 'data-native-genie-availability': state};
  const values = {'--native-location-action-bottom': `${measured}px`, '--mobile-nav-clearance': '130px', '--cg-app-genie-clearance': webGenie ? '104px' : '0px'};
  let expression = '0px';
  css.walkRules(rule => {
    if(!rule.selector.endsWith('.mobileActionBar')) return;
    const pairs = [...rule.selector.matchAll(/\[([^=\]]+)="([^"]*)"\]/g)];
    if(!pairs.length || !pairs.every(([,key,value]) => attributes[key] === value)) return;
    rule.walkDecls(decl => {if(decl.prop.startsWith('--')) values[decl.prop] = decl.value; if(decl.prop === 'bottom') expression = decl.value;});
  });
  return numeric(expression, values);
}

test('UIKit-owned Genie reserve clears the full-width CTA in its existing resting position, including narrow and tall text layouts', () => {
  // Existing native default: 56pt launcher, bottom = safeBottom + 88pt.
  for(const [width,height,safe,ctaHeight] of [[320,568,34,108],[393,852,34,54],[430,932,34,156]]) {
    const dockTop = height - safe - 8 - 64;
    const ctaBottom = height - bottom({measured:height - dockTop + 8});
    const genieTop = height - safe - 88 - 56;
    assert.ok(ctaBottom <= genieTop - 8, `CTA at width ${width} must end above the Genie launcher`);
    assert.ok(ctaBottom - ctaHeight < ctaBottom);
  }
});

test('only available UIKit-owned app Genie reserves space; hidden, blocked, open and unknown ownership retain measured dock clearance', () => {
  assert.equal(bottom(), 210);
  for(const state of ['hidden','blocked','open','unknown']) assert.equal(bottom({state}), 106);
  for(const owner of ['','uikit-v2','unknown']) assert.equal(bottom({owner}), 106);
  assert.equal(bottom({app:false}), 0);
});

test('existing web Genie clearance is reused once, ordinary web stays bottom zero, and the CTA is never narrowed', () => {
  assert.equal(bottom({owner:'',webGenie:true}), 210);
  assert.equal(bottom({webGenie:true}), 210);
  assert.equal(bottom({app:false,webGenie:true}), 0);
  assert.doesNotMatch(css.toString(), /padding-right:\s*(?:\d{2,}|calc\(|var\()/);
});
