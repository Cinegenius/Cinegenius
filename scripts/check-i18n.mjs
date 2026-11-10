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
  const visit=nodes=>{for(const node of nodes){if([1,2,3,4,5,6].includes(node.type)) result.add(node.value);if(node.type===8)result.add('<'+node.value+'>');if(node.options)for(const option of Object.values(node.options)) visit(option.value);if(node.children)visit(node.children);}};
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
// Brands, standard units, protocols and example addresses are intentionally language-independent.
const neutralText = /^(?:CineGenius|Cine|Genius|IMDb|Instagram|WhatsApp|Facebook|YouTube|TikTok|LinkedIn|X|PDF|GPS|IBAN|BIC|SEPA|EUR|USD|CHF|km|cm|kg|GB|MB|KB|px|m²|m2|m|h|h\/d|HEIC|HEIF|JPG|JPEG|PNG|WEBP|SVG|HTTPS|HTTP|www\.[^\s]+|https?:\/\/[^\s]+|[^\s@]+@[^\s@]+\.[^\s@]+)$/i;
const neutralCss = /^(?:(?:text|bg|border|shadow|ring|hover|focus|from|to|via|rounded|font|line|flex|grid|col|row|p|m|w|h)-[^\s]+\s*)+$/;
const neutralCode = /^(?:⌘[A-Z]|\/(?:profile|locations|creators|props|jobs|companies|projects)\/)$/;
const copyProps = new Set(['aria-label','aria-description','aria-roledescription','title','placeholder','alt','label','description','heading','subheading','subtitle','submitLabel','cancelLabel','emptyTitle','emptyDescription','loadingText','errorMessage','successMessage','helpText','hint','caption','message','text','name','buttonLabel']);
export function sourceTextInventory(root) {
  const found=[];
  const walkDirectory=directory=>{for(const item of readdirSync(directory,{withFileTypes:true})){
    const name=path.join(directory,item.name);if(item.isDirectory())walkDirectory(name);else if(/\.tsx$/.test(name)){
      const content=readFileSync(name,'utf8'),file=ts.createSourceFile(name,content,99,true,4);
      const add=(node,value)=>{value=value.trim().replace(/\s+/g,' ');if(value && /[A-Za-zÄÖÜäöüß]/.test(value) && value.length>1 && !/^[|·—]?\s*CineGenius(?: Jobs)?$/.test(value) && !/^\d+\s*\/\s*[A-Z]+$/.test(value) && !neutralText.test(value) && !neutralCss.test(value) && !neutralCode.test(value))found.push({file:path.relative(root,name).split(path.sep).join('/'),text:value,line:file.getLineAndCharacterOfPosition(node.getStart(file)).line+1});};
      const displayExpression=node=>{
        if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))add(node,node.text);
        else if(ts.isTemplateExpression(node)){add(node,node.head.text);for(const span of node.templateSpans)add(span.literal,span.literal.text);}
        else if(ts.isConditionalExpression(node)){displayExpression(node.whenTrue);displayExpression(node.whenFalse);}
        else if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)){displayExpression(node.left);displayExpression(node.right);}
        else if(ts.isParenthesizedExpression(node))displayExpression(node.expression);
        else if(ts.isArrayLiteralExpression(node))for(const element of node.elements)displayExpression(element);
        else if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['join','filter'].includes(node.expression.name.text))displayExpression(node.expression.expression);
      };
      const visit=node=>{
        if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(file)==='style')return;
        if(ts.isJsxText(node))add(node,node.text);
        else if(ts.isJsxAttribute(node)&&(copyProps.has(node.name.getText(file))&&node.name.getText(file)!=='name'||node.name.getText(file)==='value'&&(ts.isJsxOpeningElement(node.parent)||ts.isJsxSelfClosingElement(node.parent))&&/^[A-Z]/.test(node.parent.tagName.getText(file)))&&node.initializer){if(ts.isStringLiteral(node.initializer))add(node.initializer,node.initializer.text);else if(ts.isJsxExpression(node.initializer)&&node.initializer.expression)displayExpression(node.initializer.expression);}
        else if(ts.isJsxExpression(node)&&node.parent&&!ts.isJsxAttribute(node.parent)&&node.expression)displayExpression(node.expression);
        else if(ts.isPropertyAssignment(node)&&copyProps.has(node.name.getText(file).replace(/^['"]|['"]$/g,''))){displayExpression(node.initializer);}
        else if(ts.isCallExpression(node)&&/^(?:alert|confirm|setError|setSuccess|showToast|toast\.(?:error|success|info))$/.test(node.expression.getText(file))&&node.arguments[0])displayExpression(node.arguments[0]);
        ts.forEachChild(node,visit);
      };visit(file);
    }
  }};
  for(const dir of ['app','components'])walkDirectory(path.join(root,dir));return found;
}
/** User-visible API copy includes route handlers and the request proxy. Protocol codes remain stable. */
export function responseTextInventory(root) {
  const found=[];
  const read=filename=>{
    const file=ts.createSourceFile(filename,readFileSync(filename,'utf8'),99,true,3);
    const add=node=>{
      if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||[ts.SyntaxKind.TemplateHead,ts.SyntaxKind.TemplateMiddle,ts.SyntaxKind.TemplateTail].includes(node.kind)) {
        const text=node.text.trim();
        // Existing API contracts return these stable tokens; their clients select native messages.
        const relative=path.relative(root,filename).split(path.sep).join('/');
        const organizationCode=/^app\/api\/(?:admin\/)?organizations(?:\/|$)/.test(relative)&&['load','required','conflict','audit','save','forbidden','url','date','media','name','website','contact'].includes(text);
        const placeCode=relative==='app/api/places/route.ts'&&text==='locale';
        const mediaCode=relative==='app/api/admin/reviews/[kind]/[id]/media/route.ts'&&text==='mediaError';
        if(organizationCode||placeCode||mediaCode)return;
        if(text && /[a-zA-ZÄÖÜäöüß]/.test(text) && !/^[a-zA-Z0-9]+(?:[_-][a-zA-Z0-9]+)+$/.test(text))found.push({file:path.relative(root,filename).split(path.sep).join('/'),text,line:file.getLineAndCharacterOfPosition(node.getStart(file)).line+1});
      } else if(ts.isTemplateExpression(node)){add(node.head);for(const span of node.templateSpans)add(span.literal);}
      else if(ts.isConditionalExpression(node)){add(node.whenTrue);add(node.whenFalse);}
      else if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)){add(node.left);add(node.right);}
      else if(ts.isParenthesizedExpression(node))add(node.expression);
    };
    const visit=node=>{
      if(ts.isCallExpression(node)&&/^(?:NextResponse|Response)\.json$/.test(node.expression.getText(file))&&node.arguments[0]&&ts.isObjectLiteralExpression(node.arguments[0])){
        for(const property of node.arguments[0].properties)if(ts.isPropertyAssignment(property)&&['error','message','title','body'].includes(property.name.getText(file).replace(/^['"]|['"]$/g,'')))add(property.initializer);
      }
      ts.forEachChild(node,visit);
    };visit(file);
  };
  const walk=directory=>{if(!existsSync(directory))return;for(const entry of readdirSync(directory,{withFileTypes:true})){
    const filename=path.join(directory,entry.name);if(entry.isDirectory())walk(filename);else if(/\.ts$/.test(filename))read(filename);
  }};
  walk(path.join(root,'app/api'));
  if(existsSync(path.join(root,'proxy.ts')))read(path.join(root,'proxy.ts'));
  return found;
}

export function main(root=process.cwd()) {
  const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
  const catalogs=Object.fromEntries(locales.map(locale=>[locale,flatten(JSON.parse(readFileSync(path.join(root,'messages',locale+'.json'),'utf8')))]));
  const problems=[];for(const locale of locales) problems.push(...compareCatalogs(catalogs.de,catalogs[locale]).map(message=>locale+': '+message));
  for (const reference of translationKeyReferences(root)) {
    if (!reference.candidates.some(key => key in catalogs.de)) problems.push(`Unknown translation reference: ${reference.file}: ${reference.key}`);
  }
  const inventory=[...sourceTextInventory(root),...responseTextInventory(root)],baselinePath=path.join(root,'scripts/i18n-legacy-texts.json');
  const baseline=new Set(existsSync(baselinePath)?JSON.parse(readFileSync(baselinePath,'utf8')):[]);
  for(const entry of inventory)if(!baseline.has(entry.file+'\t'+entry.text))problems.push(`New untranslated UI text: ${entry.file}:${entry.line}: ${entry.text}`);
  if(problems.length){console.error(problems.join('\n'));return 1;}
  console.log(`Translation checks passed: ${locales.length} catalogs, ${Object.keys(catalogs.de).length} keys; ${inventory.length} source literals require review.`);return 0;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main();

/** Check literal translator calls against existing namespaces, including server translations. */
export function translationKeyReferences(root) {
  const references=[];
  function scan(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){
    const filename=path.join(directory,entry.name);if(entry.isDirectory()){scan(filename);continue;}if(!/\.tsx?$/.test(filename))continue;
    const file=ts.createSourceFile(filename,readFileSync(filename,'utf8'),99,true,filename.endsWith('x')?4:3),namespaces=new Map(),factories=new Set(['useTranslations','getTranslations']);
    for(const statement of file.statements)if(ts.isImportDeclaration(statement)&&/^next-intl(?:\/server)?$/.test(statement.moduleSpecifier.text)){for(const item of statement.importClause?.namedBindings?.elements??[]){if(['useTranslations','getTranslations'].includes(item.propertyName?.text??item.name.text))factories.add(item.name.text);}}
    function collect(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)){
      const initial=node.initializer && ts.isAwaitExpression(node.initializer)?node.initializer.expression:node.initializer;
      if(initial&&ts.isCallExpression(initial)&&ts.isIdentifier(initial.expression)&&factories.has(initial.expression.text)){
        const arg=initial.arguments[0];const ns=arg&&ts.isObjectLiteralExpression(arg)?arg.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(file)==='namespace')?.initializer:arg;if(!ns||ts.isStringLiteral(ns)){const list=namespaces.get(node.name.text)??[];list.push(ns?.text??'');namespaces.set(node.name.text,list);}
      }
    }ts.forEachChild(node,collect);}collect(file);
    function calls(node){if(ts.isCallExpression(node)){
      const name=ts.isIdentifier(node.expression)?node.expression.text:ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)&&['rich','markup','raw'].includes(node.expression.name.text)?node.expression.expression.text:null;
      const arg=node.arguments[0];if(name&&namespaces.has(name)&&arg&&ts.isStringLiteral(arg))references.push({file:path.relative(root,filename),key:arg.text,candidates:namespaces.get(name).map(namespace=>namespace?namespace+'.'+arg.text:arg.text)});
    }ts.forEachChild(node,calls);}calls(file);
  }}
  for(const directory of ['app','components','lib','contexts'])scan(path.join(root,directory));return references;
}
