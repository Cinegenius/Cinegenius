import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { trustedMutationOrigin } from "@/lib/request-origin";
import { validateUpload } from "@/lib/uploadGuard";
import { SHOTS_CONTRACT, SHOT_LIFETIME_MS, SHOT_MAX_PHOTO_BYTES, SHOT_MAX_EDGE, SHOT_PAGE_SIZE, isShotId, readShotMetadata, shotMediaPath, type Shot, type ShotVariant, type ShotsErrorCode } from "./shots";

export const SHOTS_BUCKET = "shots-ephemeral-v1";
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" };
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export class ShotFailure extends Error { constructor(public code: ShotsErrorCode, public status = 503) { super(code); } }
function iso(value: unknown) { if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new ShotFailure("unavailable");return new Date(value).toISOString(); }
export function shotJson(body: Record<string, unknown>, accountId: string | null, status = 200, time?: unknown) {
  return Response.json({ contract: SHOTS_CONTRACT, accountId, serverNow: time ? iso(time) : new Date().toISOString(), capabilities: { read: status < 400, publish: false, homiesRead: status < 400 }, ...body }, { status, headers });
}
export async function shotRpc(action: string, actor: string | null, input: Record<string, unknown> = {}) {
  const result = await db.rpc("shots_v1", { p_action: action, p_actor: actor, p: input }).abortSignal(AbortSignal.timeout(12_000));
  if (result.error || !object(result.data) || typeof result.data.status !== "string" || !result.data.serverNow) throw new ShotFailure("unavailable");
  iso(result.data.serverNow);
  return result.data;
}
function success(result: Record<string, unknown>, accepted: string[] = ["ok"]) {
  if (accepted.includes(String(result.status))) return;
  const errors: Record<string, [ShotsErrorCode, number]> = { unavailable: ["unavailable",503], invalid: ["invalid",400], conflict: ["conflict",409], capacity: ["capacity",409], missing: ["not_found",404], expired: ["expired",410] };
  const mapped = errors[String(result.status)] ?? ["unavailable",503];throw new ShotFailure(mapped[0],mapped[1]);
}
export function readShotDto(value: unknown): Shot {
  if (!object(value)) throw new ShotFailure("unavailable");const metadata = readShotMetadata(value);
  const createdAt=iso(value.createdAt),expiresAt=iso(value.expiresAt);
  if (!metadata || !isShotId(value.id) || typeof value.isMine !== "boolean" || (value.isMine ? !isShotId(value.requestId) : value.requestId !== null)
    || Date.parse(expiresAt)-Date.parse(createdAt)!==SHOT_LIFETIME_MS || !Number.isInteger(value.width) || !Number.isInteger(value.height)
    || Number(value.width)<1 || Number(value.height)<1 || Number(value.width)>SHOT_MAX_EDGE || Number(value.height)>SHOT_MAX_EDGE) throw new ShotFailure("unavailable");
  return {...metadata,id:value.id,requestId:value.requestId as string|null,createdAt,expiresAt,isMine:value.isMine,width:Number(value.width),height:Number(value.height),media:{full:shotMediaPath(value.id,"full"),thumbnail:shotMediaPath(value.id,"thumbnail")}};
}
async function execute(request: Request, mutation: boolean, handler: (actor: string)=>Promise<Response>, media=false) {
  let actor: string|null=null;
  try {
    actor=(await getCurrentUser())?.userId ?? null;if(!actor)throw new ShotFailure("unauthorized",401);
    const contract=request.headers.get("X-CineGenius-Shots-Contract"),expected=request.headers.get("X-Shots-Account");
    if((!media&&contract!==SHOTS_CONTRACT)||(contract!==null&&contract!==SHOTS_CONTRACT))throw new ShotFailure("invalid",400);
    if((!media&&expected!==actor)||(expected!==null&&expected!==actor))throw new ShotFailure("account_changed",409);
    if(mutation&&!trustedMutationOrigin({requestUrl:request.url,origin:request.headers.get("origin"),referer:request.headers.get("referer"),development:process.env.NODE_ENV!=="production",deploymentHost:process.env.VERCEL_URL}))throw new ShotFailure("invalid",403);
    if(!(await rateLimit(`shots:${mutation?'write':'read'}:${actor}`,mutation?12:300,60)).allowed)throw new ShotFailure("rate_limited",429);
    return await handler(actor);
  }catch(error){const failure=error instanceof ShotFailure?error:new ShotFailure("unavailable");return shotJson({error:{code:failure.code}},actor,failure.status)}
}
function readCursor(value: string|null) {
  if(!value)return{};if(value.length>256||!/^[A-Za-z0-9_-]+$/.test(value))throw new ShotFailure("invalid",400);
  try {const v=JSON.parse(Buffer.from(value,"base64url").toString());if(!object(v)||Object.keys(v).length!==2||!isShotId(v.id))throw new Error();return{beforeId:v.id,beforeAt:iso(v.createdAt)}}catch{throw new ShotFailure("invalid",400)}
}
export const shotsFeedRoute=(request:Request)=>execute(request,false,async actor=>{
  const params=new URL(request.url).searchParams;if([...params.keys()].some(key=>!['audience','cursor'].includes(key))||params.getAll('audience').length!==1||params.getAll('cursor').length>1)throw new ShotFailure("invalid",400);
  const audience=params.get('audience');if(audience!=='community'&&audience!=='homies')throw new ShotFailure("invalid",400);
  const result=await shotRpc('feed',actor,{audience,...readCursor(params.get('cursor'))});success(result);
  if(!Array.isArray(result.items)||result.items.length>SHOT_PAGE_SIZE)throw new ShotFailure('unavailable');
  const items=result.items.map(readShotDto);if(items.some(item=>item.audience!==audience||Date.parse(item.expiresAt)<=Date.parse(iso(result.serverNow))))throw new ShotFailure('unavailable');
  let nextCursor:string|null=null;if(result.next!==null&&result.next!==undefined){if(!object(result.next)||!isShotId(result.next.id))throw new ShotFailure('unavailable');nextCursor=Buffer.from(JSON.stringify({id:result.next.id,createdAt:iso(result.next.createdAt)})).toString('base64url')}
  return shotJson({items,nextCursor,capabilities:{read:true,publish:result.publishAllowed===true,homiesRead:true}},actor,200,result.serverNow);
});
export const shotsDetailRoute=(request:Request,id:string)=>execute(request,false,async actor=>{if(!isShotId(id))throw new ShotFailure('not_found',404);const result=await shotRpc('get',actor,{id});success(result);return shotJson({item:readShotDto(result.item)},actor,200,result.serverNow)});
export const shotsRequestRoute=(request:Request,requestId:string)=>execute(request,false,async actor=>{
  if(!isShotId(requestId))throw new ShotFailure('invalid',400);const result=await shotRpc('request',actor,{requestId,requestScope:hash(JSON.stringify([actor,requestId.toLowerCase()]))});success(result,['absent','pending','published','expired','deleted']);
  const item=result.status==='published'?readShotDto(result.item):null;if(item&&(!item.isMine||item.requestId!==requestId))throw new ShotFailure('unavailable');
  if(typeof result.retryAllowed!=='boolean')throw new ShotFailure('unavailable');return shotJson({status:result.status,requestId,item,retryAllowed:result.retryAllowed},actor,200,result.serverNow);
});
export const shotsDeleteRoute=(request:Request,id:string)=>execute(request,true,async actor=>{
  if(!isShotId(id))throw new ShotFailure('not_found',404);const result=await shotRpc('delete',actor,{id});success(result,['deleted']);if(typeof result.purgePending!=='boolean')throw new ShotFailure('unavailable');return shotJson({id,deleted:true,purgePending:result.purgePending},actor,200,result.serverNow);
});
async function boundedForm(request:Request){
  const type=request.headers.get('content-type')??'';if(!type.startsWith('multipart/form-data;')||!request.body)throw new ShotFailure('invalid',400);
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>SHOT_MAX_PHOTO_BYTES+65536){await reader.cancel();throw new ShotFailure('invalid',413)}chunks.push(value)}}finally{reader.releaseLock()}
  return new Response(Buffer.concat(chunks),{headers:{'content-type':type}}).formData();
}
export async function normalizeShotPhoto(file:File){
  const validation=await validateUpload(file,{maxBytes:SHOT_MAX_PHOTO_BYTES,allowedMimeTypes:new Set(['image/jpeg','image/png','image/webp']),emptyMessage:'invalid',tooLargeMessage:'invalid',unsupportedTypeMessage:'invalid'});
  if('error'in validation)throw new ShotFailure('invalid',validation.status);
  const full=await sharp(validation.buffer,{limitInputPixels:40_000_000}).rotate().resize({width:SHOT_MAX_EDGE,height:SHOT_MAX_EDGE,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
  const thumbnail=await sharp(full.data).resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
  if(full.data.length>SHOT_MAX_PHOTO_BYTES||thumbnail.length>SHOT_MAX_PHOTO_BYTES)throw new ShotFailure('invalid',413);
  return{width:full.info.width,height:full.info.height,variants:{full:full.data,thumbnail}};
}
export function validShotObjectKey(id:string,variant:unknown,key:unknown):key is string{return isShotId(id)&&(variant==='full'||variant==='thumbnail')&&key===`${id}/${variant}.webp`}
async function confirmUploaded(key:string,bytes:Buffer){
  const bucket=db.storage.from(SHOTS_BUCKET);const result=await bucket.upload(key,bytes,{contentType:'image/webp',upsert:false,cacheControl:'0'});
  if(!result.error&&result.data?.path===key)return;
  // An upload timeout/conflict is an unknown ACK. Confirm identical immutable bytes.
  const confirmed=await bucket.download(key,{}, {cache:'no-store',signal:AbortSignal.timeout(12_000)});
  if(confirmed.error||!confirmed.data||confirmed.data.size!==bytes.length||hash(new Uint8Array(await confirmed.data.arrayBuffer()))!==hash(bytes))throw new ShotFailure('unavailable');
}
export const shotsPublishRoute=(request:Request)=>execute(request,true,async actor=>{
  const availability=await shotRpc('capabilities',actor);success(availability);if(availability.publishAllowed!==true)throw new ShotFailure('unavailable',503);
  const form=await boundedForm(request),keys=[...form.keys()],allowed=['requestId','photo','audience','format','look','grain'];
  if(keys.length!==allowed.length||new Set(keys).size!==allowed.length||keys.some(key=>!allowed.includes(key)))throw new ShotFailure('invalid',400);
  const requestId=form.get('requestId'),file=form.get('photo'),grain=form.get('grain');
  if(!isShotId(requestId)||!(file instanceof File)||typeof grain!=='string'||!/^\d{1,3}$/.test(grain))throw new ShotFailure('invalid',400);
  const metadata=readShotMetadata({audience:form.get('audience'),format:form.get('format'),look:form.get('look'),grain:Number(grain)});if(!metadata)throw new ShotFailure('invalid',400);
  const normalized=await normalizeShotPhoto(file),payloadHash=hash(Buffer.concat([normalized.variants.full,Buffer.from(JSON.stringify(metadata))]));
  const assets=Object.entries(normalized.variants).map(([variant,bytes])=>({variant,bytes:bytes.length,sha256:hash(bytes)}));
  const prepared=await shotRpc('prepare',actor,{requestId,requestScope:hash(JSON.stringify([actor,requestId.toLowerCase()])),payloadHash,...metadata,width:normalized.width,height:normalized.height,assets});
  if(prepared.status==='published')return shotJson({status:'published',requestId,item:readShotDto(prepared.item),capabilities:{read:true,publish:true,homiesRead:true}},actor,200,prepared.serverNow);
  if(prepared.status==='pending')return shotJson({status:'pending',requestId,item:null},actor,202,prepared.serverNow);
  success(prepared,['prepared']);
  if(!isShotId(prepared.id)||!isShotId(prepared.token)||!Array.isArray(prepared.assets)||prepared.assets.length!==2)throw new ShotFailure('unavailable');
  const id=prepared.id,token=prepared.token;
  try{
    for(const entry of prepared.assets){if(!object(entry)||!validShotObjectKey(id,entry.variant,entry.key))throw new ShotFailure('unavailable');const bytes=normalized.variants[entry.variant as ShotVariant];if(!bytes||entry.sha256!==hash(bytes)||entry.bytes!==bytes.length)throw new ShotFailure('conflict',409);await confirmUploaded(entry.key,bytes);success(await shotRpc('uploaded',actor,{id,token,variant:entry.variant,sha256:hash(bytes)}))}
    const result=await shotRpc('publish',actor,{id,token});success(result,['published']);const item=readShotDto(result.item);if(item.requestId!==requestId||!item.isMine)throw new ShotFailure('unavailable');return shotJson({status:'published',requestId,item,capabilities:{read:true,publish:true,homiesRead:true}},actor,201,result.serverNow);
  }catch(error){if(error instanceof ShotFailure&&error.status<500)throw error;return shotJson({status:'pending',requestId,item:null},actor,202);}
});
export const shotsMediaRoute=(request:Request,id:string,variant:string)=>execute(request,false,async actor=>{
  if(!isShotId(id)||(variant!=='full'&&variant!=='thumbnail'))throw new ShotFailure('not_found',404);
  const first=await shotRpc('media',actor,{id,variant});success(first);if(!validShotObjectKey(id,variant,first.key))throw new ShotFailure('unavailable');
  const file=await db.storage.from(SHOTS_BUCKET).download(first.key,{}, {cache:'no-store',signal:AbortSignal.timeout(12_000)});
  if(file.error||!file.data||file.data.size!==first.bytes)throw new ShotFailure('unavailable');const bytes=new Uint8Array(await file.data.arrayBuffer());if(hash(bytes)!==first.sha256)throw new ShotFailure('unavailable');
  // Expiry, deletion, Ghost and revoked Homies are checked again after I/O.
  const last=await shotRpc('media',actor,{id,variant});success(last);if(last.key!==first.key||last.sha256!==first.sha256)throw new ShotFailure('not_found',404);
  return new Response(bytes,{headers:{...headers,'Content-Type':'image/webp','Content-Length':String(bytes.length),'Content-Security-Policy':"default-src 'none'; sandbox"}});
},true);
