import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

/** This is an operator-only migration, never an endpoint accepting member IDs. */
export function reviewedPrivateSource(asset) {
 const parents=new Map(asset.sources.map(source=>[`${source.kind}:${source.id}`,source]));
 if(asset.bucket!=='listing-images'||parents.size!==1||asset.sources.some(source=>!source.private))throw Error('Ambiguous or public source; manual review required');
 const source=[...parents.values()][0];
 if(!['company','project_draft'].includes(source.kind)||!source.owner||!/^[A-Za-z0-9_-]{1,128}$/.test(source.owner))throw Error('Unsupported legacy source; manual review required');
 if(!asset.path||asset.path.startsWith('/')||asset.path.split('/').some(part=>part==='..')||/[\u0000-\u001f]/.test(asset.path))throw Error('Invalid legacy path');
 return {...source,references:[...new Set(asset.sources.map(item=>item.reference))]};
}

/** Preserve the original bytes, update the parent atomically, then retire only
 * the verified old PUBLIC COPY. All originals remain in private storage.
 * Any uncertain step stops before retiring the original; retries use the journal.
 */
export async function cutoverPrivateMedia(db,asset) {
 const source=reviewedPrivateSource(asset);
 const lookup=await db.from('media_assets').select('storage_path,reference_url,owner_user_id,mime_type,source_type,source_id,legacy_sha256,legacy_retired_at').eq('legacy_bucket',asset.bucket).eq('legacy_path',asset.path).maybeSingle();
 if(lookup.error)throw Error('Migration journal unavailable');
 let saved=lookup.data;
 if(saved?.legacy_retired_at)return {changed:false};
 if(saved&&(saved.owner_user_id!==source.owner||(saved.source_type&&(saved.source_type!==source.kind||saved.source_id!==source.id))))throw Error('Source ownership changed; review required');
 const old=await db.storage.from(asset.bucket).download(asset.path);
 let original=old.data&&!old.error?Buffer.from(await old.data.arrayBuffer()):null;
 if(!saved) {
  if(!original)throw Error('Original unavailable; nothing changed');
  const metadata=await sharp(original,{limitInputPixels:40_000_000,animated:false}).metadata();
  const ext={jpeg:'jpg',png:'png',webp:'webp'}[metadata.format];
  if(!ext||(metadata.pages??1)>1||original.length>4194304)throw Error('Legacy file requires separate review; original retained');
  const path=`${source.owner}/${randomUUID().replaceAll('-','')}.${ext}`;
  const mime=`image/${metadata.format}`;
  const copied=await db.storage.from('protected-media').upload(path,original,{contentType:mime,upsert:false,cacheControl:'0'});
  if(copied.error)throw Error('Private copy failed; original retained');
  const row={storage_path:path,reference_url:'/api/media/'+path,owner_user_id:source.owner,mime_type:mime,legacy_bucket:asset.bucket,legacy_path:asset.path,legacy_reference:source.references[0],legacy_sha256:digest(original),content_sha256:digest(original)};
  const inserted=await db.from('media_assets').insert(row);
  if(inserted.error)throw Error('Migration journal could not be confirmed; original retained');
  saved=row;
 }
 const privateFile=await db.storage.from('protected-media').download(saved.storage_path);
 if(privateFile.error||!privateFile.data)throw Error('Private copy unavailable; public copy retained');
 const privateBytes=Buffer.from(await privateFile.data.arrayBuffer());
 if(!saved.legacy_sha256||digest(privateBytes)!==saved.legacy_sha256||(original&&digest(original)!==saved.legacy_sha256))throw Error('File verification failed; public copy retained');
 const replaced=await db.rpc('replace_private_media_reference',{p_source_type:source.kind,p_source_id:source.id,p_owner:source.owner,p_old_refs:source.references,p_new_ref:saved.reference_url});
 if(replaced.error||replaced.data!==true)throw Error('Parent update not confirmed; public copy retained');
 const [owner,guest]=await Promise.all([db.rpc('readable_media_asset',{p_key:saved.storage_path,p_viewer:source.owner}),db.rpc('readable_media_asset',{p_key:saved.storage_path,p_viewer:null})]);
 if(owner.error||guest.error||!owner.data?.length||guest.data?.length)throw Error('Private permissions not confirmed; public copy retained');
 const retired=await db.storage.from(asset.bucket).remove([asset.path]);
 if(retired.error)throw Error('Old public copy remains; private original is safe, retry required');
 const recorded=await db.from('media_assets').update({legacy_retired_at:new Date().toISOString()}).eq('storage_path',saved.storage_path).eq('legacy_sha256',saved.legacy_sha256).select('storage_path').maybeSingle();
 if(recorded.error||!recorded.data)throw Error('Retirement journal needs confirmation; private original is safe');
 return {changed:true};
}
