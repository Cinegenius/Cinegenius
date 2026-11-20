import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {orderHomeCrew} from './home-crew-selection.ts';
import {collectFacetRows} from './browse-facets.ts';
import {projectProfilePrivacy} from './profile-privacy.ts';
import {isPeopleDirectoryProfile} from './profile-provider-filters.ts';
export function homeCrewFixture(db, profileAccessFor) {
 const source=ts.transpileModule(readFileSync(new URL('./home-crew.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const deps={'server-only':{},'@/lib/db':{db},'@/lib/browse-facets':{collectFacetRows},'@/lib/home-crew-selection':{orderHomeCrew},'@/lib/profile-privacy-server':{profileAccessFor},'@/lib/profile-privacy':{projectProfilePrivacy},'@/lib/profile-provider-filters':{isPeopleDirectoryProfile}},mod={exports:{}};
 new Function('require','module','exports',source)(name=>{if(!(name in deps))throw new Error(name);return deps[name]},mod,mod.exports);
 return mod.exports;
}
