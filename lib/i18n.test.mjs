import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createTranslator} from 'next-intl';
import {resolveLocale,SUPPORTED_LOCALES} from './i18n/locales.ts';
import {mergeMessages} from './i18n/messages.ts';
import {localizeAuthMessage} from './i18n/auth-messages.ts';
import {flatten,compareCatalogs,responseTextInventory} from '../scripts/check-i18n.mjs';
test('manual locale wins over weighted browser preferences and invalid choices safely fall back',()=>{
 assert.equal(resolveLocale('en','de-DE,de;q=0.9'),'en');
 assert.equal(resolveLocale(null,'fr;q=1,en-GB;q=0.8,de;q=0.5'),'en');
 assert.equal(resolveLocale('invalid','hu-HU'),'hu');
 assert.equal(resolveLocale(null,'en;q=0,de;q=0.4'),'de');
 assert.equal(resolveLocale(null,'fr'),'de');
});
test('nested fallback preserves selected text, restores missing/empty entries, and does not mutate catalogs',()=>{
 const base={common:{yes:'Ja',no:'Nein'}},chosen={common:{yes:'Yes',no:''}};
 assert.deepEqual(mergeMessages(base,chosen),{common:{yes:'Yes',no:'Nein'}});
 assert.equal(chosen.common.no,'');assert.equal(base.common.yes,'Ja');
});
test('catalog gate detects missing and empty text, invalid ICU and changed variables while allowing grammatical plurals',()=>{
 assert.ok(compareCatalogs({a:'Hello {name}'},{a:'Hello {other}'}).some(p=>p.includes('mismatch')));
 assert.ok(compareCatalogs({a:'Hello'},{a:''}).some(p=>p.includes('empty')));
 assert.ok(compareCatalogs({a:'Hello'},{}).length);
 assert.ok(compareCatalogs({a:'Hello'},{a:'{bad'}).some(p=>p.includes('ICU')));
 assert.deepEqual(compareCatalogs({a:'{count, plural, one {item} other {items}}'},{a:'{count} položek'}),[]);
});
test('all supported catalogs have matching nonempty keys and variables, and auth recovery messages never expose identifiers',()=>{
 const catalogs=Object.fromEntries(SUPPORTED_LOCALES.map(l=>[l,JSON.parse(readFileSync(new URL(`../messages/${l}.json`,import.meta.url)))]));
 for(const locale of SUPPORTED_LOCALES){
  assert.deepEqual(compareCatalogs(flatten(catalogs.de),flatten(catalogs[locale])),[],locale);
  const t=createTranslator({locale,messages:catalogs[locale],namespace:'auth'});
  assert.equal(localizeAuthMessage('Die Passwörter stimmen nicht überein.',t),t('mismatch'));
  assert.ok(t('retrySeconds',{seconds:30}).includes('30'));
  assert.ok(!t('neutralReset').includes('{{'));
 }
});
test('locale refresh preserves the active path and does not hard-reload or key forms by locale',()=>{
 const source=readFileSync(new URL('../components/LanguageSwitcher.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('router.refresh()'));assert.ok(!source.includes('location.reload'));
 assert.ok(source.includes('useLocale()'));
 const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
 assert.ok(layout.includes('getLocale()'));assert.ok(!layout.includes('key={locale}'));
});

test('catalog gate preserves rich-text tag names as well as interpolation arguments',()=>{
 assert.ok(compareCatalogs({a:'Read <original>{document}</original>'},{a:'Lire <link>{document}</link>'}).some(p=>p.includes('mismatch')));
 assert.deepEqual(compareCatalogs({a:'Read <original>{document}</original>'},{a:'Lees <original>{document}</original>'}),[]);
});
test('response inventory detects untranslated route/proxy copy and preserves only documented protocol tokens',()=>{
 const root=mkdtempSync(join(tmpdir(),'cinegenius-response-copy-'));
 try {
  const save=(relative,source)=>{const file=join(root,relative);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
  save('app/api/example/route.ts',`NextResponse.json({error: "Fehler beim Speichern"}); Response.json({message: "Please try again"}); NextResponse.json({error: "load"}); NextResponse.json({error: "invalid_request"}); NextResponse.json({error: t("translated")});`);
  save('app/api/organizations/route.ts',`NextResponse.json({error: "load"}); NextResponse.json({error: "Neue Meldung"});`);
  save('proxy.ts',`NextResponse.json({error: "No access"});`);
  const texts=responseTextInventory(root).map(entry=>entry.text).sort();
  assert.deepEqual(texts,['Fehler beim Speichern','Neue Meldung','No access','Please try again','load'].sort());
 } finally {rmSync(root,{recursive:true,force:true});}
});
