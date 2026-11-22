import 'server-only';
import {auth} from '@clerk/nextjs/server';
import {NextResponse} from 'next/server';
import {requireAuth} from '@/lib/auth';
import {getTranslations} from 'next-intl/server';
import {WorkMailOAuthError} from './work-mail-oauth';
import {WORK_MAIL_HEADERS,WorkMailError,workMailAccount,workMailSameOrigin} from './work-mail';

export async function workMailCaller(request:Request,mutation=false,header=true) {
 const result=await requireAuth();
 if(result instanceof NextResponse){for(const [key,value] of Object.entries(WORK_MAIL_HEADERS))result.headers.set(key,value);return result;}
 const session=await auth();
 if(!workMailAccount(result.userId)||session.userId!==result.userId||!session.sessionId)return workMailFailure(new WorkMailError('notAllowed',401));
 if(header&&request.headers.get('X-Mail-Account')!==result.userId)return workMailFailure(new WorkMailError('accountChanged',403));
 if(mutation&&!workMailSameOrigin(request))return workMailFailure(new WorkMailError('notAllowed',403));
 return {userId:result.userId,sessionId:session.sessionId};
}
export async function workMailFailure(cause:unknown) {
 const oauth=cause instanceof WorkMailOAuthError?cause.code:null;
 const mapped=oauth==='provider_reauthorization_required'?new WorkMailError('connectionRequired',409):oauth==='message_too_large'||oauth==='attachment_limit'?new WorkMailError('tooLarge',413):oauth?.startsWith('invalid_')?new WorkMailError('oauthFailed',400):new WorkMailError();
 const known=cause instanceof WorkMailError?cause:mapped;
 const t=await getTranslations('WorkMail');
 return NextResponse.json({code:known.code,error:t(known.code)},{status:known.status,headers:WORK_MAIL_HEADERS});
}
export function workMailJSON(value:unknown,status=200){return NextResponse.json(value,{status,headers:WORK_MAIL_HEADERS});}
