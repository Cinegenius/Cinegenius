import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
import {FILM_DEPARTMENTS} from './filmRoles.ts';
import {taxonomyLabel} from './departments.ts';

const source=readFileSync(new URL('../app/inserat/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('inserat.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const factory=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='getLocalizedGroups');
assert.ok(factory);
const icons=ast.statements.filter(node=>ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='lucide-react').flatMap(node=>node.importClause?.namedBindings?.elements?.map(item=>item.name.text)??[]);
const code=ts.transpile(factory.getText(ast),{target:ts.ScriptTarget.ES2022});
const groups=new Function('FILM_DEPARTMENTS','taxonomyLabel',`const deptMeta={}; const ${icons.map(name=>name+'=null').join(',')}; ${code}; return getLocalizedGroups;`)(FILM_DEPARTMENTS,taxonomyLabel);
const canonical=groups(translatorFor('de')).map(group=>[group.id,group.items.map(item=>[item.id,item.category,item.type])]);
for(const locale of SUPPORTED_LOCALES)test(`offer chooser translates job departments without changing saved categories: ${locale}`,()=>{
 const t=translatorFor(locale), result=groups(t);
 assert.deepEqual(result.map(group=>[group.id,group.items.map(item=>[item.id,item.category,item.type])]),canonical);
 for(const department of FILM_DEPARTMENTS) {
  const item=result.find(group=>group.id==='jobs').items.find(item=>item.id==='job_'+department.id);
  assert.equal(item.label,taxonomyLabel(department.label,t));
  assert.ok(item.label.trim());
 }
 if(locale==='es') {
  const jobs=result.find(group=>group.id==='jobs').items;
  for(const german of ['Vor der Kamera','Regie','Licht','Kostüm','Produktion','Foto-Postproduktion'])assert.ok(!jobs.some(item=>item.label===german),german);
  assert.equal(jobs.find(item=>item.id==='job_licht').label,'Iluminación');
 }
 for(const group of result)for(const item of group.items)assert.ok(item.label.trim());
});
