import {requireAuth} from '@/lib/auth';
import {NextResponse} from 'next/server';
import {getTranslations} from 'next-intl/server';
import {ERASURE_HEADERS,erasureSummary} from '@/lib/account-erasure';
import {ErasureError,erasureRPC,requestErasure} from '@/lib/account-erasure-server';

async function failure(cause: unknown) {
  const t=await getTranslations('System');
  return NextResponse.json({error:t('requestFailed')},{status:cause instanceof ErasureError?cause.status:503,headers:ERASURE_HEADERS});
}
export async function GET() {
  try {
    const actor=await requireAuth();
    if(actor instanceof NextResponse) {for(const [key,value] of Object.entries(ERASURE_HEADERS))actor.headers.set(key,value);return actor;}
    const request=await erasureRPC(actor.userId,'read_own');
    if(request!==null && !erasureSummary(request))throw new ErasureError();
    return NextResponse.json({accountId:actor.userId,request},{headers:ERASURE_HEADERS});
  }catch(cause){return failure(cause);}
}
// Acceptance is not completion: no content or identity is deleted by this route.
export async function DELETE(request: Request) {
  try {
    const actor=await requireAuth();
    if(actor instanceof NextResponse) {for(const [key,value] of Object.entries(ERASURE_HEADERS))actor.headers.set(key,value);return actor;}
    if(request.headers.get('X-Account-Id')!==actor.userId)return failure(new ErasureError(409));
    const receipt=await requestErasure(actor.userId);
    return NextResponse.json({accepted:true,accountId:actor.userId,request:receipt},{status:202,headers:ERASURE_HEADERS});
  }catch(cause){return failure(cause);}
}
