import {requireAdmin} from '@/lib/auth';
import {NextResponse} from 'next/server';
import {getTranslations} from 'next-intl/server';
import {ERASURE_HEADERS,erasureId} from '@/lib/account-erasure';
import {ErasureError,erasureRPC} from '@/lib/account-erasure-server';

const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:ERASURE_HEADERS});
const privateResponse=(response:NextResponse)=>{for(const [key,value] of Object.entries(ERASURE_HEADERS))response.headers.set(key,value);return response;};
async function fail(cause:unknown) {return json({error:(await getTranslations('System'))('requestFailed')},cause instanceof ErasureError?cause.status:503);}
export async function GET(request:Request) {
 try {
  const actor=await requireAdmin();if(actor instanceof NextResponse)return privateResponse(actor);
  const params=new URL(request.url).searchParams,id=params.get('id'),after=params.get('after');
  if(id&&!erasureId(id)||after&&!erasureId(after))throw new ErasureError(400);
  if(id)return json({accountId:actor.userId,request:await erasureRPC(actor.userId,'admin_read',id)});
  const rows=await erasureRPC(actor.userId,'list',after);
  if(!Array.isArray(rows))throw new ErasureError();
  return json({accountId:actor.userId,requests:rows.slice(0,50),nextCursor:rows.length>50?rows[49].id:null,policy:await erasureRPC(actor.userId,'policy_read')});
 }catch(cause){return fail(cause);}
}
export async function POST(request:Request) {
 try {
  const actor=await requireAdmin();if(actor instanceof NextResponse)return privateResponse(actor);
  if(request.headers.get('X-Account-Id')!==actor.userId)return fail(new ErasureError(409));
  const raw=await request.text();if(raw.length>6000)throw new ErasureError(400);
  let body;try{body=JSON.parse(raw);}catch{throw new ErasureError(400);}
  if(!body||typeof body!=='object'||!Number.isSafeInteger(body.revision)||body.revision<1)throw new ErasureError(400);
  if(body.action==='policy') {
   if(typeof body.enabled!=='boolean'||typeof body.evidence!=='string'||body.evidence.trim().length<20||body.evidence.length>1000
    ||typeof body.validUntil!=='string'||!Number.isFinite(Date.parse(body.validUntil))
    ||![body.backupDays,body.providerDays,body.receiptDays].every(v=>Number.isInteger(v)&&v>=0&&v<=365)||body.receiptDays<1)throw new ErasureError(400);
   return json({accountId:actor.userId,policy:await erasureRPC(actor.userId,'policy_save',null,{revision:body.revision,enabled:body.enabled,evidence:body.evidence.trim(),validUntil:body.validUntil,backupDays:body.backupDays,providerDays:body.providerDays,receiptDays:body.receiptDays})});
  }
  if(body.action!=='retry'||!erasureId(body.id))throw new ErasureError(400);
  return json({accountId:actor.userId,result:await erasureRPC(actor.userId,'retry',body.id,{revision:body.revision})});
 }catch(cause){return fail(cause);}
}
