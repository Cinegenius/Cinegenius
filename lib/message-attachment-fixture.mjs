import {readFileSync} from 'node:fs';
import ts from 'typescript';
export function attachmentServerFixture(db){
 const source=ts.transpileModule(readFileSync(new URL('./message-attachment-server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',source)(name=>name==='server-only'?{}:name==='@/lib/db'?{db}:(()=>{throw new Error(name)})(),mod,mod.exports);return mod.exports;
}
