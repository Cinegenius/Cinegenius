
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTranslator} from 'use-intl/core';
import {departments,getDepartmentRoleFormLabels} from './departments.ts';
import {wishSearchTerms} from './unified-search-matching.ts';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
const lighting=departments.find(item=>item.id==='licht');
const gaffer=lighting.roles.find(role=>role==='Gaffer (Oberbeleuchter)');
assert.ok(gaffer);
for (const locale of SUPPORTED_LOCALES) test(`${locale}: unified search maps each selected wording to the same canonical occupation`,()=>{
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const taxonomy=createTranslator({locale,messages,namespace:'Taxonomy',onError(error){throw error;}});
 const forms=getDepartmentRoleFormLabels('licht',gaffer,locale,undefined,taxonomy);
 for (const query of forms) {
  const wish={area:'crew',query,department:'licht',places:[]};
  const terms=wishSearchTerms(wish,locale,taxonomy);
  assert.ok(terms.includes(gaffer),query);
  assert.ok(!terms.includes('Produktionsassistent/in'),query);
 }
});
