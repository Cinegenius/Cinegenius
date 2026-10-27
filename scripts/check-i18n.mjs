import {readFileSync, readdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {parse} from '@formatjs/icu-messageformat-parser';
export function flatten(value, prefix='', output={}) {
  for (const [key,item] of Object.entries(value)) {
    const id=prefix+key;
    if(typeof item==='string') output[id]=item;
    else if(item && typeof item==='object' && !Array.isArray(item)) flatten(item,id+'.',output);
    else throw Error(`Invalid translation value: ${id}`);
  }
  return output;
}
export function placeholders(message) {
  const result=new Set();
  const visit=nodes=>{for(const node of nodes){if([1,2,3,4,5,6].includes(node.type)) result.add(node.value);if(node.options)for(const option of Object.values(node.options)) visit(option.value);if(node.children)visit(node.children);}};
  visit(parse(message));return [...result].sort();
}
export function compareCatalogs(reference, selected) {
  const problems=[];
  for(const [key,value]of Object.entries(reference)) {
    if(!selected[key]?.trim()){problems.push(`Missing or empty: ${key}`);continue;}
    try {if(JSON.stringify(placeholders(value))!==JSON.stringify(placeholders(selected[key]))) problems.push(`Placeholder mismatch: ${key}`);}
    catch {problems.push(`Invalid ICU message: ${key}`);}
  }
  for(const key of Object.keys(selected)) if(!(key in reference))problems.push(`Unknown key: ${key}`);
  return problems;
}
export function sourceTextInventory(root) {
  const found=[];
  const walkDirectory=directory=>{for(const item of readdirSync(directory,{withFileTypes:true})){
    const name=path.join(directory,item.name);if(item.isDirectory())walkDirectory(name);else if(/\.tsx$/.test(name)){
      const content=readFileSync(name,'utf8'),file=ts.createSourceFile(name,content,99,true,4);
      const add=(node,value)=>{value=value.trim().replace(/\s+/g,' ');if(value && /[A-Za-zÄÖÜäöüß]/.test(value) && value.length>1)found.push({file:path.relative(root,name).split(path.sep).join('/'),text:value,line:file.getLineAndCharacterOfPosition(node.getStart(file)).line+1});};
      const visit=node=>{if(ts.isJsxText(node)) add(node,node.text);else if(ts.isJsxAttribute(node)&&['aria-label','title','placeholder','alt'].includes(node.name.getText(file))&&node.initializer&&ts.isStringLiteral(node.initializer))add(node,node.initializer.text);ts.forEachChild(node,visit);};visit(file);
    }
  }};
  for(const dir of ['app','components'])walkDirectory(path.join(root,dir));return found;
}
export function main(root=process.cwd()) {
  const locales=['de','en','es','it','cs','hu'];
  const catalogs=Object.fromEntries(locales.map(locale=>[locale,flatten(JSON.parse(readFileSync(path.join(root,'messages',locale+'.json'),'utf8')))]));
  const problems=[];for(const locale of locales) problems.push(...compareCatalogs(catalogs.de,catalogs[locale]).map(message=>locale+': '+message));
  for (const reference of translationKeyReferences(root)) {
    if (!reference.candidates.some(key => key in catalogs.de)) problems.push(`Unknown translation reference: ${reference.file}: ${reference.key}`);
  }
  const inventory=sourceTextInventory(root),baselinePath=path.join(root,'scripts/i18n-legacy-texts.json');
  const baseline=new Set(existsSync(baselinePath)?JSON.parse(readFileSync(baselinePath,'utf8')):[]);
  for(const entry of inventory)if(!baseline.has(entry.file+'\t'+entry.text))problems.push(`New untranslated UI text: ${entry.file}:${entry.line}: ${entry.text}`);
  if(problems.length){console.error(problems.join('\n'));return 1;}
  console.log(`Translation checks passed: ${locales.length} catalogs, ${Object.keys(catalogs.de).length} keys; no new unlocalized UI literals. Legacy backlog: ${inventory.length} occurrences.`);return 0;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main();

/** Check literal translator calls against existing namespaces, including server translations. */
export function translationKeyReferences(root) {
  const references=[];
  function scan(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){
    const filename=path.join(directory,entry.name);if(entry.isDirectory()){scan(filename);continue;}if(!/\.tsx?$/.test(filename))continue;
    const file=ts.createSourceFile(filename,readFileSync(filename,'utf8'),99,true,filename.endsWith('x')?4:3),namespaces=new Map();
    function collect(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)){
      const initial=node.initializer && ts.isAwaitExpression(node.initializer)?node.initializer.expression:node.initializer;
      if(initial&&ts.isCallExpression(initial)&&ts.isIdentifier(initial.expression)&&['useTranslations','getTranslations'].includes(initial.expression.text)){
        const arg=initial.arguments[0];if(!arg||ts.isStringLiteral(arg)){const list=namespaces.get(node.name.text)??[];list.push(arg?.text??'');namespaces.set(node.name.text,list);}
      }
    }ts.forEachChild(node,collect);}collect(file);
    function calls(node){if(ts.isCallExpression(node)){
      const name=ts.isIdentifier(node.expression)?node.expression.text:ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)&&['rich','markup','raw'].includes(node.expression.name.text)?node.expression.expression.text:null;
      const arg=node.arguments[0];if(name&&namespaces.has(name)&&arg&&ts.isStringLiteral(arg))references.push({file:path.relative(root,filename),key:arg.text,candidates:namespaces.get(name).map(namespace=>namespace?namespace+'.'+arg.text:arg.text)});
    }ts.forEachChild(node,calls);}calls(file);
  }}
  for(const directory of ['app','components'])scan(path.join(root,directory));return references;
}
