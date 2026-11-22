import {NextRequest,NextResponse} from 'next/server';
import {getTranslations} from 'next-intl/server';
import {requireAuth} from '@/lib/auth';
import {db} from '@/lib/db';
import {rateLimit} from '@/lib/rateLimit';
import {MESSAGING_HEADERS,messagingAccountId,messagingUuid,messagingRequestKey} from '@/lib/messaging-backend';

async function caller(request:NextRequest) {
  const result=await requireAuth();
  if(result instanceof NextResponse) return result;
  if(request.headers.get('X-Team-Account')!==result.userId) return NextResponse.json({error:(await getTranslations('WorkTeams'))('accountChanged')},{status:403,headers:MESSAGING_HEADERS});
  return result;
}
async function execute(account:string,action:string,p:Record<string,unknown>) {
  const t=await getTranslations('WorkTeams');
  const {data,error}=await db.rpc('workspace_teams_v1',{p_actor:account,p_action:action,p});
  if(error) {
    const status=error.code==='PT404'?404:error.code==='42501'?403:['PT409','55P03'].includes(error.code??'')?409:['22023','22P02'].includes(error.code??'')?400:503;
    const key=error.message==='teams_last_admin'?'lastAdmin':error.message==='teams_full'?'limit':status===409?'changed':status===503?'unavailable':status===400?'invalid':'notAllowed';
    return NextResponse.json({error:t(key),code:status===503?'unavailable':'rejected'},{status,headers:MESSAGING_HEADERS});
  }
  if(!data||typeof data!=='object')return NextResponse.json({error:t('unavailable'),code:'unavailable'},{status:503,headers:MESSAGING_HEADERS});
  return NextResponse.json(data,{headers:MESSAGING_HEADERS});
}
export async function GET(request:NextRequest) {
  const account=await caller(request);if(account instanceof NextResponse)return account;
  const team=request.nextUrl.searchParams.get('team');
  if(team&&!messagingUuid(team))return NextResponse.json({error:(await getTranslations('WorkTeams'))('invalid')},{status:400,headers:MESSAGING_HEADERS});
  return execute(account.userId,team?'team':'list',team?{teamId:team}:{});
}
export async function POST(request:NextRequest) {
  const account=await caller(request);if(account instanceof NextResponse)return account;
  const t=await getTranslations('WorkTeams');
  const invalid=()=>NextResponse.json({error:t('invalid')},{status:400,headers:MESSAGING_HEADERS});
  const body=await request.json().catch(()=>null);
  if(!body||body.accountId!==account.userId)return NextResponse.json({error:t('accountChanged')},{status:403,headers:MESSAGING_HEADERS});
  const {action,p}=body;
  if(!['create_team','invite','accept','decline','leave_team','remove_member','promote','create_channel','configure_channel','set_access','join','leave','preference'].includes(action)
    ||!p||typeof p!=='object'||Array.isArray(p)||JSON.stringify(p).length>16000||!messagingRequestKey(p.key))return invalid();
  if(!['create_team','preference'].includes(action)&&(!messagingUuid(p.teamId)||!Number.isSafeInteger(p.revision)||p.revision<1))return invalid();
  if(['configure_channel','set_access','join','leave'].includes(action)&&!messagingUuid(p.channelId))return invalid();
  if(['invite','remove_member','promote','set_access'].includes(action)&&!messagingAccountId(p.userId))return invalid();
  if(['create_team','create_channel','configure_channel'].includes(action)&&(typeof p.name!=='string'||!p.name.trim()||p.name.trim().length>80))return invalid();
  if(!(await rateLimit(`work-teams:${account.userId}`,60,60)).allowed)return NextResponse.json({error:t('busy')},{status:429,headers:MESSAGING_HEADERS});
  return execute(account.userId,action,p);
}
