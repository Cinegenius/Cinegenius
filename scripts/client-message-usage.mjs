import {readFileSync, readdirSync, existsSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

// These statically named namespaces contain substantial server-only copy.
// Keep every other namespace intact, including all dynamic taxonomy labels.
const namespaces = ['Ui', 'System', 'Metadata', 'TransactionalEmail', 'NotificationCopy', 'LegalTerms', 'LegalPrivacy', 'LegalOperators'];
export function clientMessageOmissions(root = process.cwd()) {
  const files = new Map();
  const walk = dir => { if (!existsSync(dir)) return; for (const entry of readdirSync(dir, {withFileTypes:true})) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(filename);
    else if (/\.(tsx?|jsx?|json)$/.test(filename) && !/\.(test|d)\./.test(filename)) files.set(filename, ts.createSourceFile(filename, readFileSync(filename,'utf8'), 99, true));
  }};
  for (const dir of ['app','components','contexts','hooks','lib']) walk(path.join(root,dir));
  const seen = new Set(), strings = new Set(), dynamic = new Set();
  let rawMessages = false;
  const visitFile = filename => {
    if (seen.has(filename) || !files.has(filename)) return;
    seen.add(filename);
    const visit = node => {
      if (ts.isStringLiteralLike(node)) strings.add(node.text);
      if (ts.isTemplateExpression(node)) for (const ns of namespaces) if (node.head.text.startsWith(ns+'.')) dynamic.add(ns);
      if (ts.isIdentifier(node) && ['useMessages','getMessages'].includes(node.text)) rawMessages = true;
      const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const value=specifier.text;
        const base=value.startsWith('@/') ? path.join(root,value.slice(2)) : value.startsWith('.') ? path.resolve(path.dirname(filename),value) : null;
        if (base) { const resolved=[base,...['.ts','.tsx','.js','.jsx','.json','/index.ts','/index.tsx','/index.js','/index.jsx'].map(extension=>base+extension)].find(name=>files.has(name)); if(resolved)visitFile(resolved); }
      }
      ts.forEachChild(node,visit);
    };
    visit(files.get(filename));
  };
  for (const [filename,source] of files) if(source.statements.some(node=>ts.isExpressionStatement(node)&&ts.isStringLiteral(node.expression)&&node.expression.text==='use client')) visitFile(filename);
  const catalog=JSON.parse(readFileSync(path.join(root,'messages/de.json'),'utf8'));
  return Object.fromEntries(namespaces.map(ns=>[ns, Object.keys(catalog[ns]??{}).filter(key=>!rawMessages && !dynamic.has(ns) && !strings.has(ns) && !strings.has(ns+'.') && !strings.has(ns+'.'+key) && !strings.has(key)).sort()]));
}
export function checkClientMessageOmissions(root=process.cwd()) {
  const expected=clientMessageOmissions(root);
  const filename=path.join(root,'lib/i18n/client-message-omissions.json');
  if (!existsSync(filename)||JSON.stringify(JSON.parse(readFileSync(filename,'utf8')))!==JSON.stringify(expected)) {
    return 'Client message selection is outdated. Run node scripts/client-message-usage.mjs --write and review the diff.';
  }
  return null;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--write'))writeFileSync('lib/i18n/client-message-omissions.json', JSON.stringify(clientMessageOmissions(),null,2)+'\n');
  else { const error=checkClientMessageOmissions(); if(error){console.error(error);process.exitCode=1;} }
}
