import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('prepared remote sign-in entry satisfies the native local-start-file requirement', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'cinegenius-preview-start-'));
  try {
    const repository = new URL('../../', import.meta.url);
    await mkdir(join(fixture, 'mobile'), { recursive: true });
    await mkdir(join(fixture, 'lib/i18n'), { recursive: true });
    await cp(new URL('mobile/scripts', repository), join(fixture, 'mobile/scripts'), { recursive: true });
    await cp(new URL('mobile/src', repository), join(fixture, 'mobile/src'), { recursive: true });
    await cp(new URL('messages', repository), join(fixture, 'messages'), { recursive: true });
    await cp(new URL('lib/i18n/locales.ts', repository), join(fixture, 'lib/i18n/locales.ts'));
    execFileSync(process.execPath, [join(fixture, 'mobile/scripts/prepare-preview.mjs')], { stdio: 'pipe' });
    const config = JSON.parse(await readFile(join(fixture, 'mobile/capacitor.config.json'), 'utf8'));
    assert.equal(new URL(config.server.appStartPath, config.server.url).pathname, '/sign-in');
    // Capacitor's loadWebView checks this local file before loading the remote URL.
    const entry = join(fixture, 'mobile/www', config.server.appStartPath);
    assert.equal((await stat(entry)).isFile(), true);
    assert.equal(await readFile(entry, 'utf8'), await readFile(join(fixture, 'mobile/www/offline.html'), 'utf8'));
    const viewportAdapter = await readFile(join(fixture, 'mobile/www/app-viewport.js'), 'utf8');
    assert.ok(viewportAdapter.includes(JSON.stringify({
      origin: new URL(config.server.url).origin,
      css: `${await readFile(join(fixture, 'mobile/src/app-viewport.css'), 'utf8')}\n${await readFile(join(fixture, 'mobile/src/app-presentation.css'), 'utf8')}`,
      styleId: 'cinegenius-app-viewport',
    })), 'the native bundle must include the exact configured origin and viewport styles');
    assert.equal(config.ios.contentInset, 'never', 'CSS must be the only safe-area inset owner');
    assert.ok((await readFile(join(fixture, 'mobile/www/app-presentation.js'), 'utf8')).includes('data-home-app-notice'));
    const resume = await readFile(join(fixture, 'mobile/www/app-resume.js'), 'utf8');
    assert.ok(resume.includes(JSON.stringify(new URL(config.server.url).origin)));
    assert.ok(resume.includes("new Event('cinegenius:app-resume')"));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
