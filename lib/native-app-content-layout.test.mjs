import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { nativeAppContentRegion, nativeContentFocusDelta, nativeContentUnobscuredRegion } from './native-app-content-region.ts';

// Next already declares PostCSS. Do not depend on a package-manager-specific
// hoisted copy, a browser installation or an external design test service.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const postcss = nextRequire('postcss');
const css = readFileSync(new URL('../components/app/NativeAppSurface.module.css', import.meta.url), 'utf8');
const selector = ':global(html[data-cg-native-community-appearance="app"]) :global(body) main.surface:global(.site-main[data-native-app-surface="v1"])';
const normalizeSelector = value => value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/["']/g, '').replace(/\s+/g, ' ').trim();
const sameSelector = value => normalizeSelector(value) === normalizeSelector(selector);

function declarations(source) {
  const rules = [];
  postcss.parse(source).walkRules(rule => {
    if (rule.selectors.some(sameSelector)) rules.push(rule);
  });
  assert.ok(rules.length, 'The body-specific native main selector must remain present');
  const result = new Map();
  for (const rule of rules) {
    assert.equal(rule.parent.type, 'root', 'Conditional native main overrides need an explicit layout contract');
    for (const node of rule.nodes) {
      if (node.type === 'comment') continue;
      assert.equal(node.type, 'decl', 'Nested native main overrides need an explicit layout contract');
      const prop = node.prop.toLowerCase();
      assert.ok(!/^(?:all|padding|padding-block(?:-.+)?|padding-inline(?:-.+)?|inset(?:-.+)?|overflow|block-size|min-block-size|max-block-size|transform|translate|scale|rotate)$/.test(prop), `${prop} must not override the separate canvas/clearance longhands`);
      const previous = result.get(prop);
      if (!previous || node.important || !previous.important) result.set(prop, { value: node.value, important: Boolean(node.important) });
    }
  }
  return result;
}

// A small length-only CSS expression reader, limited to the functions/units in
// this layout contract. Unknown syntax fails instead of guessing browser pixels.
function expression(value) {
  assert.ok(!value.includes('/*'), 'Comments inside layout values need an explicit expression contract');
  const pattern = /\s+|--[A-Za-z0-9_-]+|(?:\d+(?:\.\d*)?|\.\d+)(?:dvh|px)?|[A-Za-z][A-Za-z0-9-]*|[()+,-]/gy;
  const locations = [];
  while (pattern.lastIndex < value.length) {
    const start = pattern.lastIndex, match = pattern.exec(value);
    assert.ok(match, `Unsupported layout expression: ${value}`);
    if (!/^\s+$/.test(match[0])) locations.push({ token: match[0], start, end: pattern.lastIndex });
  }
  const tokens = locations.map(part => part.token);
  let index = 0;
  const take = expected => { assert.equal(tokens[index++], expected, `Expected ${expected} in ${value}`); };
  const primary = () => {
    const token = tokens[index++];
    if (token === '+' || token === '-') {
      assert.ok(/^(?:\d|\.)/.test(tokens[index] ?? '') && locations[index - 1].end === locations[index].start, 'A signed CSS length must be one contiguous numeric token');
      return { kind: 'sign', sign: token, value: primary() };
    }
    if (/^(?:\d|\.)/.test(token ?? '')) {
      assert.ok(/(?:px|dvh)$/.test(token) || Number(token) === 0, 'Nonzero layout lengths need units');
      return { kind: 'length', value: Number.parseFloat(token), unit: token.endsWith('dvh') ? 'dvh' : 'px' };
    }
    assert.ok(['var', 'env', 'calc', 'min', 'max'].includes(token), `Unsupported CSS function ${token}`);
    take('(');
    if (token === 'var' || token === 'env') {
      const name = tokens[index++];
      assert.match(name, token === 'var' ? /^--[A-Za-z0-9_-]+$/ : /^[A-Za-z][A-Za-z0-9-]*$/);
      const fallback = tokens[index] === ',' ? (index++, sum()) : null;
      take(')');
      return { kind: token, name, fallback };
    }
    const args = [sum()];
    while (tokens[index] === ',') { index++; args.push(sum()); }
    take(')');
    assert.ok(token !== 'calc' || args.length === 1, 'calc must have one expression');
    return { kind: token, args };
  };
  const sum = () => {
    let left = primary();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = locations[index];
      assert.ok(/\s/.test(value[operator.start - 1] ?? '') && /\s/.test(value[operator.end] ?? ''), 'CSS binary + and - require whitespace on both sides');
      index++;
      left = { kind: 'sum', operator: operator.token, left, right: primary() };
    }
    return left;
  };
  const result = sum();
  assert.equal(index, tokens.length, `Trailing layout expression in ${value}`);
  return result;
}

function lengths(style, viewport, variables, safe) {
  const parsed = new Map();
  const parse = value => { if (!parsed.has(value)) parsed.set(value, expression(value)); return parsed.get(value); };
  function evaluate(node, seen, stack = []) {
    if (node.kind === 'length') return node.value * (node.unit === 'dvh' ? viewport.height / 100 : 1);
    if (node.kind === 'sign') return (node.sign === '-' ? -1 : 1) * evaluate(node.value, seen, stack);
    if (node.kind === 'sum') return evaluate(node.left, seen, stack) + (node.operator === '-' ? -1 : 1) * evaluate(node.right, seen, stack);
    if (node.kind === 'var' || node.kind === 'env') {
      seen.add(node.name);
      assert.ok(!stack.includes(node.name), 'Layout variables must not form a cycle');
      const value = node.kind === 'env' ? safe[node.name] : style.get(node.name)?.value ?? variables[node.name];
      if (value !== undefined) return evaluate(parse(typeof value === 'number' ? `${value}px` : value), seen, [...stack, node.name]);
      assert.ok(node.fallback, `Missing layout variable ${node.name}`);
      return evaluate(node.fallback, seen, stack);
    }
    const values = node.args.map(arg => evaluate(arg, seen, stack));
    return node.kind === 'min' ? Math.min(...values) : node.kind === 'max' ? Math.max(...values) : values[0];
  }
  return prop => {
    assert.ok(style.has(prop), `Missing native main ${prop}`);
    const seen = new Set();
    const value = evaluate(parse(style.get(prop).value), seen);
    assert.ok(Number.isFinite(value), `${prop} must resolve to a finite length`);
    return { value, seen };
  };
}

const cases = [
  { viewport: { top: 0, height: 852 }, header: 127, safeTop: 59, safeBottom: 34 },
  { viewport: { top: 0, height: 884 }, header: 100, safeTop: 32, safeBottom: 0 },
  { viewport: { top: 0, height: 560 }, header: 127, safeTop: 59, safeBottom: 34 },
  { viewport: { top: 24, height: 480 }, header: 100, safeTop: 32, safeBottom: 34 },
  { viewport: { top: 0, height: 393 }, header: 68, safeTop: 0, safeBottom: 21 },
  ...[0, 1, 8, 12, 16, 23, 24, 25, 68].map(height => ({ viewport: { top: 0, height: 139 + height }, header: 127, safeTop: 59, safeBottom: 34 })),
];

function assertLayout(source) {
  const style = declarations(source);
  const raw = prop => style.get(prop)?.value;
  for (const [prop, expected] of Object.entries({ position: 'fixed', 'box-sizing': 'border-box', 'min-height': '0', 'max-height': 'none', bottom: 'auto', 'overflow-y': 'auto', 'overscroll-behavior-y': 'contain' })) {
    assert.equal(raw(prop), expected, `${prop} must preserve the full native scroll canvas`);
  }
  for (const prop of ['min-height', 'padding-top', 'padding-bottom']) assert.equal(style.get(prop)?.important, true, `${prop} must beat the installed host fallback`);
  for (const input of [...cases, { viewport: { top: 0, height: 852 }, header: null, safeTop: 59, safeBottom: 34, fallback: true }]) {
    const { viewport, header, safeTop, safeBottom, fallback } = input;
    const region = nativeAppContentRegion(viewport, header, safeTop, safeBottom);
    const variables = { '--cg-app-safe-top': `${safeTop}px`, '--cg-app-safe-bottom': `${safeBottom}px`, '--mobile-safe-area-height': `${safeBottom}px`, '--cg-app-active-rail-height': '64px' };
    if (!fallback) Object.assign(variables, { '--cg-app-content-top': `${region.top}px`, '--cg-app-content-height': `${region.height}px`, '--cg-app-content-clearance': `${region.clearance}px` });
    const read = lengths(style, viewport, variables, { 'safe-area-inset-top': safeTop, 'safe-area-inset-bottom': safeBottom });
    const top = read('top').value, height = read('height'), paddingTop = read('padding-top').value, paddingBottom = read('padding-bottom');
    assert.equal(top, region.top);
    assert.equal(top + height.value, viewport.top + viewport.height, 'The visual main must reach the visible bottom, including behind floating controls');
    assert.ok(paddingTop >= 0 && paddingBottom.value >= 0 && paddingTop + paddingBottom.value <= height.value, 'Padding must not force tiny border boxes past the viewport');
    assert.equal(read('scroll-padding-bottom').value, paddingBottom.value, 'Focus and end-of-list clearance must agree');
    assert.equal(read('scroll-padding-top').value, 76, 'The sticky rail must retain its top clearance');
    if (!fallback) {
      assert.ok(height.seen.has('--cg-app-content-height'), 'Measured visual viewport height must be consumed');
      assert.ok(paddingBottom.seen.has('--cg-app-content-clearance'), 'Measured control clearance must be consumed');
    }
    if (height.value >= region.clearance + 24) {
      assert.equal(paddingTop, 12);
      assert.equal(paddingBottom.value, region.clearance + 12, 'Control clearance belongs at the end of content, not in a smaller viewport');
      const visible = nativeContentUnobscuredRegion({ top, bottom: top + height.value }, read('scroll-padding-top').value, paddingBottom.value);
      const field = { top: visible.bottom + 8, bottom: visible.bottom + 52 };
      const delta = nativeContentFocusDelta(field, visible, 0);
      assert.ok(delta > 0 && field.bottom - delta <= visible.bottom, 'A field behind controls must scroll into the separate unobscured region');
    }
  }
}

function changed(edit) {
  const root = postcss.parse(css);
  const main = root.nodes.find(node => node.type === 'rule' && node.selectors.some(sameSelector));
  assert.ok(main);
  edit(root, main);
  return root.toString();
}

test('actual native CSS keeps full visual height, trailing clearance and separate focus through fallback/keyboard/rotation/tiny cases', () => assertLayout(css));

test('the old clipped height and a clipped pre-measurement fallback fail the layout contract', () => {
  for (const edit of [
    (_root, main) => main.walkDecls('height', decl => { decl.value = 'calc(var(--native-content-height) - 160px)'; }),
    (_root, main) => main.walkDecls('--native-content-height', decl => { decl.value = 'var(--cg-app-content-height,max(0px,calc(100dvh - var(--native-content-top) - 160px)))'; }),
  ]) assert.throws(() => assertLayout(changed(edit)));
});

test('invalid calc operator syntax cannot masquerade as a valid full-height fallback', () => {
  for (const value of [
    'var(--cg-app-content-height,max(0px,calc(100dvh-var(--native-content-top))))',
    'var(--cg-app-content-height,max(0px,calc(100dvh -var(--native-content-top))))',
    'var(--cg-app-content-height,max(0px,calc(100dvh- var(--native-content-top))))',
  ]) assert.throws(() => assertLayout(changed((_root, main) => main.walkDecls('--native-content-height', decl => { decl.value = value; }))));
});

test('missing clearance and old twelve-pixel-only padding fail the layout contract', () => {
  for (const edit of [
    (_root, main) => main.walkDecls('--native-content-clearance', decl => decl.remove()),
    (_root, main) => main.walkDecls('padding-bottom', decl => { decl.value = '12px'; }),
    (_root, main) => main.walkDecls('scroll-padding-bottom', decl => { decl.value = '12px'; }),
    (_root, main) => main.walkDecls('box-sizing', decl => { decl.value = 'content-box'; }),
  ]) assert.throws(() => assertLayout(changed(edit)));
});

test('later matching height/padding overrides and layout shorthands fail, including after comments', () => {
  for (const decl of [{ prop: 'height', value: '20px' }, { prop: 'padding-bottom', value: '0', important: true }, { prop: 'padding', value: '0', important: true }, { prop: 'all', value: 'initial', important: true }]) {
    assert.throws(() => assertLayout(changed(root => {
      root.append(postcss.comment({ text: 'A later override must not hide from the gate' }));
      root.append(postcss.rule({ selector }).append(decl));
    })));
  }
});

test('a lower-priority declaration cannot override the important host-clearance longhand', () => {
  assertLayout(changed(root => root.append(postcss.rule({ selector }).append({ prop: 'padding-bottom', value: '0' }))));
});

const smartCSS = readFileSync(new URL('../components/SmartSearchResults.module.css', import.meta.url), 'utf8');
function assertSmartUtility(source) {
  const root = postcss.parse(source), prefix = ':global(html[data-cg-native-community-appearance="app"]) .explorer ';
  const expected = new Map([
    [prefix + '.utilityRow', { display: 'flex', 'align-items': 'center', gap: '4px', 'min-width': '0' }],
    [prefix + '.utilityRow > :global(.native-translation-notice)', { flex: '1', 'min-width': '0', 'margin-block': '0' }],
    [prefix + '.utilityRow > :global(.smart-map-info)', { flex: '0 0 44px' }],
    [prefix + '.utilityRow :global(.smart-map-info > summary)', { 'min-width': '44px', 'min-height': '44px' }],
    [prefix + ':global(.smart-result-list) > .block:first-of-type', { 'margin-top': '0', 'padding-top': '0' }],
  ]);
  const found = new Map();
  root.walkRules(rule => {
    if (rule.selector.includes('.utilityRow')) for (const branch of rule.selectors) assert.ok(normalizeSelector(branch).startsWith(normalizeSelector(prefix) + ' '), 'Compact utility styles must stay inside native Smart');
    for (const [target] of expected) if (rule.selectors.some(value => normalizeSelector(value) === normalizeSelector(target))) {
      const values = found.get(target) ?? new Map();
      rule.walkDecls(decl => {
        assert.ok(!['all', 'padding', 'margin'].includes(decl.prop), 'Shorthands must not restore a hidden utility row or gap');
        const previous = values.get(decl.prop);
        if (!previous || decl.important || !previous.important) values.set(decl.prop, { value: decl.value, important: Boolean(decl.important) });
      });
      found.set(target, values);
    }
  });
  for (const [target, values] of expected) for (const [prop, value] of Object.entries(values)) {
    assert.equal(found.get(target)?.get(prop)?.value, value, `${prop} must keep the shared utility row compact and touch-sized`);
  }
}

test('native Smart keeps one compact utility row with full touch targets and no repeated first-area top gap', () => assertSmartUtility(smartCSS));

test('restoring standalone utility spacing or shrinking Info targets fails the existing mandatory layout gate', () => {
  for (const [before, after] of [
    ['min-width:0; margin-block:0;', 'min-width:0; margin-block:4px;'],
    ['margin-top:0; padding-top:0;', 'margin-top:10px; padding-top:4px;'],
    ['min-width:44px; min-height:44px;', 'min-width:16px; min-height:16px;'],
  ]) {
    assert.ok(smartCSS.includes(before));
    assert.throws(() => assertSmartUtility(smartCSS.replace(before, after)));
  }
});
