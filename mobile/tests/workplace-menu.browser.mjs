// Run with the existing browser toolchain; no browser dependency is shipped in the app.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const loadTool = createRequire(import.meta.url);
const { chromium } = loadTool(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = process.env.CINEGENIUS_TEST_OUTPUT || path.join(root, 'mobile/test-results');
const origin = 'https://www.cinegenius.co';
const locales = ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv'];
const escapeHTML = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function run() {
  await fs.mkdir(output, { recursive: true });
  const script = await fs.readFile(path.join(root, 'mobile/www/workplace-menu.js'), 'utf8');
  const catalogs = Object.fromEntries(await Promise.all(locales.map(async locale => [locale, JSON.parse(await fs.readFile(path.join(root, `messages/${locale}.json`), 'utf8'))])));
  function html(locale) {
    const nav = catalogs[locale].nav;
    return `<!doctype html><html lang="${locale}"><meta name="viewport" content="width=device-width"><style>body{margin:0}dialog{box-sizing:border-box;width:100%;max-width:480px}button{min-height:48px;min-width:44px}nav button{width:100%;text-align:left;overflow-wrap:anywhere}span>span{display:block}</style><button id="show">Menu</button><button id="outside" disabled><span><span>${escapeHTML(nav.ai)}</span><span>${escapeHTML(nav.comingSoon)}</span></span></button><dialog id="site-navigation-menu"><nav><button disabled><svg></svg><span><span>${escapeHTML(nav.ai)}</span><span>${escapeHTML(nav.comingSoon)}</span></span></button><button id="unrelated" disabled>Unrelated disabled control</button></nav></dialog><script>document.getElementById('show').onclick=()=>document.querySelector('dialog').showModal();</script></html>`;
  }
  const browser = await chromium.launch();
  const results = [];
  async function fixture(locale, url = origin + '/native-fixture', native = true) {
    const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html(locale) }));
    const page = await context.newPage();
    if (native) await page.addInitScript(() => {
      window.nativeCalls = [];
      window.webkit = { messageHandlers: { cinegeniusWorkplace: { postMessage: value => window.nativeCalls.push(value) } } };
    });
    await page.goto(url);
    return { context, page };
  }
  try {
    for (const locale of locales) {
      const { context, page } = await fixture(locale);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addScriptTag({ content: script });
      await page.addScriptTag({ content: script });
      assert.equal(await page.locator('[data-cg-native-workplace]').count(), 0, 'Leave hidden server HTML intact until React opens the menu');
      await page.locator('#show').click();
      const button = page.getByRole('button', { name: catalogs[locale].NativeRoomScanner.workplaceTitle, exact: true });
      assert.equal(await button.count(), 1, JSON.stringify({ locale, errors, state: await page.evaluate(() => ({origin: location.origin, installed: window.__cinegeniusWorkplaceInstalled, bridge: typeof window.webkit?.messageHandlers?.cinegeniusWorkplace?.postMessage, menu: document.querySelector('dialog').innerHTML})) }));
      assert.ok(await button.isEnabled());
      assert.ok(await page.locator('#outside').isDisabled());
      assert.ok(await page.locator('#unrelated').isDisabled());
      await button.evaluate(element => element.click());
      assert.deepEqual(await page.evaluate(() => window.nativeCalls), [], 'Scripted events cannot launch the native screen');
      await button.focus();
      await page.keyboard.press('Enter');
      assert.deepEqual(await page.evaluate(() => window.nativeCalls), [{ action: 'openWorkplace', locale }]);
      assert.equal(await page.locator('dialog').evaluate(element => element.open), false);
      assert.equal(page.url(), origin + '/native-fixture');
      // A real SPA rerender can replace the row; it must still open exactly once.
      await page.evaluate(({ label, detail }) => {
        const row = document.querySelector('[data-cg-native-workplace]');
        const replacement = document.createElement('button');
        replacement.disabled = true;
        const text = document.createElement('span');
        for (const value of [label, detail]) {
          const span = document.createElement('span'); span.textContent = value; text.append(span);
        }
        replacement.append(text); row.replaceWith(replacement);
      }, { label: catalogs[locale].nav.ai, detail: catalogs[locale].nav.comingSoon });
      await page.locator('#show').click();
      await button.click();
      assert.deepEqual(await page.evaluate(() => window.nativeCalls), [{ action: 'openWorkplace', locale }, { action: 'openWorkplace', locale }]);
      assert.deepEqual(errors, []);
      results.push({ locale, width: 320, nativeClickAndKeyboard: 'passed' });
      await context.close();
    }

    for (const [url, native] of [[origin + '/native-fixture', false], ['https://www.cinegenius.co.evil.example/native-fixture', true], ['http://www.cinegenius.co/native-fixture', true], ['https://www.cinegenius.co:8443/native-fixture', true]]) {
      const { context, page } = await fixture('de', url, native);
      await page.locator('#show').click();
      await page.addScriptTag({ content: script });
      assert.equal(await page.locator('[data-cg-native-workplace]').count(), 0);
      assert.ok(await page.locator('nav button').first().isDisabled());
      results.push({ url, native, failClosed: 'passed' });
      await context.close();
    }

    const { context, page } = await fixture('de');
    await page.addScriptTag({ content: script });
    await page.evaluate(() => { document.documentElement.lang = 'nl_BE'; });
    await page.locator('#show').click();
    await page.getByRole('button', { name: catalogs['nl-BE'].NativeRoomScanner.workplaceTitle, exact: true }).waitFor({ state: 'attached' });
    await page.evaluate(() => {
      const frame = document.createElement('iframe'); frame.src = '/embedded'; document.body.append(frame);
    });
    const frameElement = page.locator('iframe');
    await frameElement.waitFor();
    const frame = await (await frameElement.elementHandle()).contentFrame();
    await frame.waitForLoadState();
    await frame.evaluate(() => { window.webkit = { messageHandlers: { cinegeniusWorkplace: { postMessage() {} } } }; });
    await frame.evaluate(() => document.querySelector('dialog').showModal());
    await frame.addScriptTag({ content: script });
    assert.equal(await frame.locator('[data-cg-native-workplace]').count(), 0);
    results.push({ localeChange: 'passed', subframeBlocked: 'passed' });
    await context.close();
  } finally { await browser.close(); }
  await fs.writeFile(path.join(output, 'workplace-menu-browser.json'), JSON.stringify(results, null, 2));
  console.log(`Workplace menu: ${results.length} browser checks passed.`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
