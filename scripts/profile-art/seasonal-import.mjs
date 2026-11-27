/** Explicit operator import. Default is offline validation only; never runs SQL. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {prepareProfileArtImage} from '../../lib/profile-art-image-preparation.ts';
import {createProfileArtStorage,artBytesSHA256} from '../../lib/profile-art-storage.ts';
import {renderSeasonalImportSql} from './seasonal-import-sql.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const directory=resolve(root,'design/profile-art-seasonal-20261127');
const catalog=JSON.parse(readFileSync(resolve(directory,'catalog.json'),'utf8'));
const upload=process.argv.includes('--verify-upload');
const checkCatalog=upload||process.argv.includes('--check-catalog');
const output=resolve(root,'work/seasonal-avatars-20261127/import');mkdirSync(output,{recursive:true});
if(process.argv.slice(2).some(a=>!['--verify-upload','--check-catalog'].includes(a)))throw new Error('Use --check-catalog for read-only comparison or --verify-upload for the explicit private import. Default is offline validation.');
const expected=['nikolaus','reindeer-mosaic','reindeer-woodcut','reindeer-doodle','helper-riso','helper-pastel','helper-doodle','winter-chalk','winter-penguin','winter-owl'];
if(catalog.entries.length!==10||catalog.entries.some((a,i)=>a.name!==expected[i]||a.edition!==(i<7?'nikolaus-2026':'winter-2026')||a.slot!==(i<7?i+1:null)))throw new Error('Unexpected seasonal manifest');
let db,storage,snapshot={revision:0,comparisons:{scope:'all-catalog-art',complete:true,snapshotID:'offline_new_assets_only',entries:[]}};
if(checkCatalog){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Existing server Supabase configuration required; never paste secrets into chat.');
 db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 if(upload)storage=createProfileArtStorage(db.storage);
 const result=await db.rpc('profile_art_catalog_snapshot').abortSignal(AbortSignal.timeout(8000));
 if(result.error||!Number.isSafeInteger(result.data?.revision)||result.data?.comparisons?.complete!==true)throw new Error('Complete catalogue snapshot unavailable');
 snapshot=result.data;
}
const comparisons={...snapshot.comparisons,entries:[...snapshot.comparisons.entries]};
const imports=[];
for(const a of catalog.entries){
 const svg=readFileSync(resolve(directory,a.source)),webp=readFileSync(resolve(directory,a.file));
 if(artBytesSHA256(svg)!==a.sourceSHA256||artBytesSHA256(webp)!==a.byteSHA256||webp.length!==a.byteLength)throw new Error('Local asset changed: '+a.name);
 // Never skip another illustration or legacy fingerprint. Only the exact own ID
 // is omitted to allow a safe repeat after a completed transaction.
 const previous=comparisons.entries.find(e=>e.artworkID==='art_'+a.artworkId);
 if(previous && JSON.stringify(previous.fingerprint)!==JSON.stringify(a.fingerprint)){
  if(Object.keys(a.fingerprint).some(k=>previous.fingerprint[k]!==a.fingerprint[k]))throw new Error('Existing ID mismatch');
 }
 const png=await sharp(svg).resize(800,800).png().toBuffer();
 const prepared=await prepareProfileArtImage({kind:'avatar',bytes:png},{...comparisons,entries:comparisons.entries.filter(e=>e.artworkID!=='art_'+a.artworkId)});
 if(!prepared.ok)throw new Error('Catalogue comparison failed for '+a.name+': '+prepared.code);
 if(prepared.image.byteSHA256!==a.byteSHA256)throw new Error('Rendering mismatch: '+a.name);
 if(!previous)comparisons.entries.push({artworkID:'art_'+a.artworkId,fingerprint:a.fingerprint});
 if(upload){
  // Upload is immutable. A previous upload is accepted only after exact readback.
  let bytes;try{bytes=await storage.read('avatar',a.mediaKey);}catch{await storage.putVerified('avatar',a.mediaKey,webp);bytes=await storage.read('avatar',a.mediaKey);}
  if(artBytesSHA256(bytes)!==a.byteSHA256||bytes.length!==a.byteLength)throw new Error('Private storage mismatch');
 }
 imports.push({...a,candidate:{sourceSHA256:a.sourceSHA256,byteSHA256:a.byteSHA256,verifiedSHA256:a.byteSHA256,byteLength:a.byteLength,fingerprint:a.fingerprint}});
}
const receipt={mode:upload?'private_storage_verified_SQL_not_applied':checkCatalog?'live_catalog_read_only':'offline_new_assets_only',catalogRevision:checkCatalog?snapshot.revision:null,comparedCatalogEntries:checkCatalog?snapshot.comparisons.entries.length:0,assets:imports.map(a=>({name:a.name,artworkId:a.artworkId,sha256:a.byteSHA256,bytes:a.byteLength})),createdAt:new Date().toISOString()};
writeFileSync(resolve(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
if(upload){
 const sql=renderSeasonalImportSql(imports,snapshot.revision);
 writeFileSync(resolve(output,'reviewed-import.sql'),sql);
}
console.log(JSON.stringify({mode:receipt.mode,assets:imports.length,output,sqlExecuted:false,providerCalls:0}));
