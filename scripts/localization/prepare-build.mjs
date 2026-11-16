/** Explicit, one-time staged build job. Never run during normal publication or navigation.
 * The already approved API key remains in Vercel. Only UI catalogs and usage totals
 * become downloadable artifacts, so local review needs no exported credential.
 */
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
if(process.env.CG_PREPARE_LOCALES !== '1') process.exit(0);
if(process.env.VERCEL !== '1') throw new Error('Language preparation is restricted to the explicit staged build.');
const output=resolve('public/_language-drafts');
await mkdir(output,{recursive:true});
const locales=['fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'];
const statuses=[];
// Four bounded workers; no key/response body is ever written to a report.
async function worker(){
 while(locales.length){
  const locale=locales.shift();
  const code=await new Promise(resolveExit=>{
   const child=spawn(process.execPath,['scripts/localization/translate-catalogs.mjs',locale],{
    env:{...process.env,CG_TRANSLATION_OUTPUT:output,CG_TRANSLATION_MAX_REQUESTS:'180'},stdio:'inherit',
   });
   child.on('error',()=>resolveExit(1));child.on('exit',code=>resolveExit(code??1));
  });
  statuses.push({locale,complete:code===0});
  await writeFile(output+'/status.json',JSON.stringify({statuses,activated:false},null,2));
 }
}
await Promise.all([worker(),worker(),worker(),worker()]);
// A failed batch retains its completed progress for review and bounded resumption.
// These files are never imported by the application's enabled locale resolver.
