/** Explicit, one-time staged build job. Never run during normal publication or navigation.
 * The already approved API key remains in Vercel. Only UI catalogs and usage totals
 * become downloadable artifacts, so local review needs no exported credential.
 */
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
if(process.env.CG_PREPARE_LOCALES !== '1') process.exit(0);
if(process.env.VERCEL !== '1') throw new Error('Language preparation is restricted to the explicit staged build.');
const output=resolve('public/help/_language-drafts');
const cache=resolve('.next/cache/cinegenius-language-drafts');
await mkdir(cache,{recursive:true});
await mkdir(output,{recursive:true});
const allowed=['fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'];
let locales=[...allowed];
try { const plan=JSON.parse(await readFile('scripts/localization/pending-locales.json','utf8')); if(!Array.isArray(plan)||plan.some(locale=>!allowed.includes(locale)))throw new Error('Invalid preparation locale plan'); locales=[...new Set(plan)]; } catch(error) { if(error.code!=='ENOENT')throw error; }
// Optional public-UI-only checkpoint from an earlier timed preparation.
// Contains no credentials or member content and never activates a locale.
try {
 const seeds=JSON.parse(gunzipSync(await readFile('scripts/localization/seed.json.gz'),{maxOutputLength:50*1024*1024}));
 for(const locale of locales)if(seeds[locale]&&typeof seeds[locale].sourceHash==='string'&&seeds[locale].values)await writeFile(`${output}/${locale}.progress.json`,JSON.stringify(seeds[locale]),{mode:0o600});
} catch(error) { if(error.code!=='ENOENT')throw error; }
for(const locale of locales){
 try { const checkpoint=await readFile(`${cache}/${locale}.progress.json`);await writeFile(`${output}/${locale}.progress.json`,checkpoint); } catch(error) { if(error.code!=='ENOENT')throw error; }
}
const statuses=[];
await writeFile(output+'/status.json',JSON.stringify({statuses,activated:false,exportReady:true},null,2));
// Eight independent locales, bounded below the host build timeout.
// Only valid fragments already persisted by the worker are kept on interruption.
async function worker(){
 while(locales.length){
  const locale=locales.shift();
  const code=await new Promise(resolveExit=>{
   const child=spawn(process.execPath,['scripts/localization/translate-catalogs.mjs',locale],{
    env:{...process.env,CG_TRANSLATION_OUTPUT:output,CG_TRANSLATION_CACHE:cache,CG_TRANSLATION_CONCURRENCY:'2',CG_TRANSLATION_MAX_REQUESTS:'180'},stdio:'inherit',
   });
   const timer=setTimeout(()=>child.kill('SIGTERM'),37*60*1000);
   child.on('error',()=>{clearTimeout(timer);resolveExit(1);});child.on('exit',code=>{clearTimeout(timer);resolveExit(code??1);});
  });
  statuses.push({locale,complete:code===0});
  await writeFile(output+'/status.json',JSON.stringify({statuses,activated:false},null,2));
 }
}
await Promise.all(Array.from({length:Math.min(8,locales.length)},()=>worker()));
// A failed batch retains its completed progress for review and bounded resumption.
// These files are never imported by the application's enabled locale resolver.
