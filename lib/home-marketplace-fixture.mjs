import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {selectHomeMarketplace} from './home-marketplace-selection.ts';
import {collectFacetRows} from './browse-facets.ts';
export function marketplaceFixture(db) {
  const source=ts.transpileModule(readFileSync(new URL('./home-marketplace.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const deps={'server-only':{},'@/lib/db':{db},'@/lib/browse-facets':{collectFacetRows},'@/lib/home-marketplace-selection':{selectHomeMarketplace}},mod={exports:{}};
  new Function('require','module','exports',source)(name=>{if(!(name in deps))throw new Error(name);return deps[name]},mod,mod.exports);
  return mod.exports;
}
