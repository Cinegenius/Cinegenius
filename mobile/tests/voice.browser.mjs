// Real browser interaction with a mocked native transport. No microphone,
// speech service, CineGenius backend or paid API is contacted by this check.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.CINEGENIUS_PLAYWRIGHT_PATH || 'playwright');
const origin = 'https://www.cinegenius.co';
const template = await readFile(new URL('../src/voice.js', import.meta.url), 'utf8');
const script = template.replace('null /* CINEGENIUS_VOICE_CONFIG */', () => JSON.stringify({origin, locales:['de','en','es','it','cs','hu','nl','nl-BE','sv']}));
const browser = await chromium.launch();
let passed = 0;
try {
  for (const platform of ['ios','android']) {
    const context = await browser.newContext();
    await context.route('**/*', route => route.fulfill({contentType:'text/html', body:'<button id="start">Start</button><button id="cancel">Cancel</button>'}));
    await context.addInitScript({content:`
      window.sent = []; window.states = []; window.outcomes = [];
      const transport = {postMessage:message => window.sent.push(typeof message === 'string' ? JSON.parse(message) : message)};
      ${platform === 'ios' ? 'window.webkit = {messageHandlers:{cinegeniusVoice:transport}};' : 'window.cinegeniusVoiceNative = transport;'}
      ${script}
      addEventListener('cinegenius:voice-state', event => window.states.push(event.detail));
      // This call really occurs before a trusted browser input event.
      window.CineGeniusVoice.start({locale:'de'}).catch(error => window.automaticError = error.code);
      document.addEventListener('DOMContentLoaded', () => {
        document.querySelector('#start').onclick = () => window.CineGeniusVoice.start({locale:'de'}).then(
          result => window.outcomes.push(result), error => window.outcomes.push({code:error.code}));
        document.querySelector('#cancel').onclick = () => window.CineGeniusVoice.cancel();
      });
    `});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/voice-fixture');
    await page.waitForFunction(() => window.automaticError === 'gesture-required');
    assert.equal(await page.evaluate(() => window.sent.length), 0); passed++;
    await page.locator('#start').click();
    const request = await page.evaluate(() => window.sent[0]);
    assert.equal(request.action, 'start');
    await page.evaluate(({platform,request}) => {
      const response = {...request, type:'result', result:{text:'Kamera in München'}};
      if (platform === 'ios') window.__cinegeniusVoiceReceive(response);
      else window.cinegeniusVoiceNative.onmessage({data:JSON.stringify(response)});
    }, {platform,request});
    await page.waitForFunction(() => window.outcomes[0]?.text === 'Kamera in München'); passed++;
    await page.locator('#start').click();
    await page.locator('#cancel').click();
    await page.waitForFunction(() => window.outcomes.at(-1)?.code === 'cancelled'); passed++;
    await page.locator('#start').click();
    await page.evaluate(() => history.pushState({}, '', '/sign-in'));
    await page.waitForFunction(() => window.outcomes.at(-1)?.code === 'interrupted'); passed++;
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`${passed} browser interaction checks passed; native transport mocked, no device/audio validation.`);
} finally {await browser.close();}
