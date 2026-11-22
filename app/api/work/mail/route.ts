import {NextRequest,NextResponse} from 'next/server';
import {rateLimit} from '@/lib/rateLimit';
import {WorkMailError,workMailAlias,workMailDomain,workMailHash,workMailRequestJSON,workMailUuid} from '@/lib/work-mail';
import {workMailCaller,workMailFailure,workMailJSON} from '@/lib/work-mail-route';
import {workMailRPC} from '@/lib/work-mail-store';
import {workMailCapabilities,workMailDisconnect,workMailImportProvider,workMailItem,workMailListProvider} from '@/lib/work-mail-service';
import {createWorkMailAuthorization} from '@/lib/work-mail-oauth';

export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:NextRequest) {
 try {
  const actor=await workMailCaller(request);if(actor instanceof NextResponse)return actor;
  let status:Record<string,unknown>;
  try{status=await workMailRPC(actor.userId,'status');}catch{return workMailJSON({accountId:actor.userId,capabilities:workMailCapabilities(false),alias:null,connections:[],items:[]});}
  const capabilities=workMailCapabilities(status.version===1);
  const connection=request.nextUrl.searchParams.get('connection'),item=request.nextUrl.searchParams.get('item'),cursor=request.nextUrl.searchParams.get('cursor');
  if(connection){if(!workMailUuid(connection)||cursor&&cursor.length>2048)throw new WorkMailError('invalid',400);if(!(await rateLimit(`work-mail-list:${actor.userId}`,30,60)).allowed)throw new WorkMailError('busy',429);return workMailJSON(await workMailListProvider(actor.userId,connection,cursor??undefined));}
  if(item){if(!workMailUuid(item))throw new WorkMailError('invalid',400);return workMailJSON(await workMailItem(actor.userId,item));}
  let before:string|undefined,beforeId:string|undefined;
  if(cursor){try{const value=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));if(typeof value.at!=='string'||Number.isNaN(Date.parse(value.at))||!workMailUuid(value.id))throw Error();before=value.at;beforeId=value.id;}catch{throw new WorkMailError('invalid',400);}}
  const listed=await workMailRPC<{items:Array<{id:string;createdAt:string}>}>(actor.userId,'list',{before,beforeId});
  const more=listed.items.length>25,items=listed.items.slice(0,25),last=items.at(-1);
  const alias=status.alias as {localPart:string;enabled:boolean}|null;
  return workMailJSON({accountId:actor.userId,capabilities,alias:alias?{address:workMailDomain()?`${alias.localPart}@${workMailDomain()}`:null,enabled:alias.enabled}:null,connections:status.connections,items,cursor:more&&last?Buffer.from(JSON.stringify({at:last.createdAt,id:last.id})).toString('base64url'):null});
 }catch(cause){return workMailFailure(cause);}
}
export async function POST(request:NextRequest) {
 try {
  const actor=await workMailCaller(request,true);if(actor instanceof NextResponse)return actor;
  const body=await workMailRequestJSON(request);if(body.accountId!==actor.userId)throw new WorkMailError('accountChanged',403);
  if(!(await rateLimit(`work-mail-write:${actor.userId}`,30,60)).allowed)throw new WorkMailError('busy',429);
  const status=await workMailRPC(actor.userId,'status'),capabilities=workMailCapabilities(status.version===1);
  if(body.action==='alias_create'||body.action==='alias_rotate'){
   if(!capabilities.forwarding)throw new WorkMailError();return workMailJSON(await workMailRPC(actor.userId,body.action,{localPart:workMailAlias()}));
  }
  if(body.action==='alias_toggle'){
   if(typeof body.enabled!=='boolean'||body.enabled&&!capabilities.forwarding)throw new WorkMailError('invalid',400);
   return workMailJSON(await workMailRPC(actor.userId,'alias_toggle',{enabled:body.enabled}));
  }
  if(body.action==='connect'){
   if(body.provider!=='gmail'&&body.provider!=='microsoft')throw new WorkMailError('invalid',400);
   if(!capabilities[body.provider])throw new WorkMailError();
   const value=createWorkMailAuthorization({provider:body.provider,accountId:actor.userId,sessionId:actor.sessionId,connectionId:crypto.randomUUID()});
   await workMailRPC(actor.userId,'oauth_start',{stateHash:value.stateHash,sessionHash:workMailHash(actor.sessionId),provider:body.provider,connectionId:value.connectionId});
   const response=workMailJSON({url:value.url});response.cookies.set('__Host-work-mail-oauth',value.stateCookie,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});return response;
  }
  if(body.action==='disconnect'){
   if(!workMailUuid(body.connectionId))throw new WorkMailError('invalid',400);return workMailJSON(await workMailDisconnect(actor.userId,body.connectionId));
  }
  if(body.action==='import_provider'){
   if(!workMailUuid(body.connectionId)||typeof body.messageId!=='string'||body.messageId.length<1||body.messageId.length>2048||/[\u0000-\u001f]/.test(body.messageId))throw new WorkMailError('invalid',400);
   return workMailJSON(await workMailImportProvider(actor.userId,body.connectionId,body.messageId));
  }
  if(body.action==='import_inbound'){
   if(!workMailUuid(body.itemId))throw new WorkMailError('invalid',400);return workMailJSON(await workMailRPC(actor.userId,'item_import',{itemId:body.itemId}));
  }
  throw new WorkMailError('invalid',400);
 }catch(cause){return workMailFailure(cause);}
}
export const dynamic='force-dynamic';
