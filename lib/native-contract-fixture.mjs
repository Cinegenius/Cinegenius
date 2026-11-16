import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as backend from './messaging-backend.ts';
import * as connections from './contact-connections.ts';
import * as crew from './crew-occupations.ts';
import * as occupations from './primary-occupation.ts';

const require = createRequire(import.meta.url);
export function nativeFixtureLoader(overrides = {}) {
  const cache = new Map();
  const mocks = {'server-only': {}, '@/lib/messaging-backend': backend,
    '@/lib/contact-connections': connections, '@/lib/crew-occupations': crew,
    '@/lib/primary-occupation': occupations, ...overrides};
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const code = ts.transpileModule(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
    }).outputText;
    const mod = {exports: {}};
    new Function('require', 'module', 'exports', code)(name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/lib/native-') || name.startsWith('@/app/api/conversations/')) return load(name.slice(2) + '.ts');
      if (name.startsWith('@/')) throw new Error('Unmocked dependency: ' + name);
      return require(name);
    }, mod, mod.exports);
    cache.set(file, mod.exports);
    return mod.exports;
  }
  return load;
}
export const nativeContractFixture = nativeFixtureLoader()('lib/native-contact-contract.ts');
export const nativeFriendsFixture = db => nativeFixtureLoader({'@/lib/db': {db}})('lib/native-friends.ts');
