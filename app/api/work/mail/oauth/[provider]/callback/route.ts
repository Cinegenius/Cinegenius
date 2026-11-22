import {NextRequest,NextResponse} from 'next/server';
import {WORK_MAIL_HEADERS,WorkMailError,workMailHash,workMailOrigin} from '@/lib/work-mail';
import {workMailCaller,workMailFailure} from '@/lib/work-mail-route';
import {workMailRPC} from '@/lib/work-mail-store';
import {workMailCapabilities} from '@/lib/work-mail-service';
import {verifyWorkMailAuthorization,exchangeWorkMailCode,sealWorkMailToken} from '@/lib/work-mail-oauth';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{provider:string}>}) {
 try {
  const actor=await workMailCaller(request,false,false);if(actor instanceof NextResponse)return actor;
  const {provider}=await params;if(provider!=='gmail'&&provider!=='microsoft')throw new WorkMailError('invalid',400);
  if(!workMailCapabilities(true)[provider])throw new WorkMailError();
  const stateToken=request.nextUrl.searchParams.get('state'),code=request.nextUrl.searchParams.get('code'),stateCookie=request.cookies.get('__Host-work-mail-oauth')?.value;
  if(!stateToken||!stateCookie||stateToken.length>2048||!code||code.length>4096||request.nextUrl.searchParams.has('error'))throw new WorkMailError('oauthFailed',400);
  const authorization=verifyWorkMailAuthorization({provider,accountId:actor.userId,sessionId:actor.sessionId,stateCookie,stateToken});
  await workMailRPC(actor.userId,'oauth_consume',{stateHash:authorization.stateHash,sessionHash:workMailHash(actor.sessionId),provider,connectionId:authorization.connectionId});
  const tokens=await exchangeWorkMailCode({authorization,code});
  const encryptedTokens=sealWorkMailToken(tokens,{accountId:actor.userId,provider,connectionId:authorization.connectionId});
  await workMailRPC(actor.userId,'connection_save',{connectionId:authorization.connectionId,provider,encryptedTokens,expiresAt:new Date(tokens.expiresAt).toISOString()});
  const response=NextResponse.redirect(new URL('/work/mail?connected=1',workMailOrigin()));for(const [key,value] of Object.entries(WORK_MAIL_HEADERS))response.headers.set(key,value);
  response.cookies.set('__Host-work-mail-oauth','',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});return response;
 }catch(cause){return workMailFailure(cause);}
}
