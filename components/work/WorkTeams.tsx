'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {Plus,MoreHorizontal,MessageCircle} from 'lucide-react';
import {useUser} from '@clerk/nextjs';
import {useRouter,useSearchParams} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {useFormDraft} from '@/lib/use-form-draft';
import {useFormNavigation} from '@/contexts/FormDraftContext';
import FormDraftStatus from '@/components/FormDraftStatus';
import PeoplePicker from '@/components/messaging/PeoplePicker';
import {type MessagePerson} from '@/lib/messaging-ui';
import MessagesContent from '@/components/messaging/MessagesContent';
import {nativeWorkTeamContainer,nativeWorkTeamContainerAvailable,nativeWorkTeamContainerServer,nativeWorkTeamContainerSubscribe,nativeWorkTeamLeaveRequest,nativeWorkTeamLease,postNativeWorkTeamContainer} from '@/lib/native-work-team-container';

type Member={userId:string;name:string;role:'admin'|'member';status:'active'|'invited'};
type Access={userId:string;canSee:boolean|null;canJoin:boolean|null;canWrite:boolean|null;denied:boolean};
type Channel={id:string;conversationId:string;name:string;visibility:'team'|'selected';defaultJoin:boolean;defaultWrite:boolean;joined:boolean;canSee:boolean;canJoin:boolean;canWrite:boolean;access:Access[]};
type Team={id:string;name:string;revision:number;role:'admin'|'member';status:'active'|'invited';members:Member[];channels:Channel[]};
type Action={action:string;p:Record<string,unknown>};
const control='min-h-11 min-w-11 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-sm disabled:opacity-40';
const field='mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-secondary px-3 text-base';

async function api(accountId:string,operation?:Action,team?:string) {
 const response=await fetch('/api/work/teams'+(team?'?team='+encodeURIComponent(team):''),{cache:'no-store',signal:AbortSignal.timeout(20000),headers:{'X-Team-Account':accountId,...(operation?{'Content-Type':'application/json'}:{})},...(operation?{method:'POST',body:JSON.stringify({accountId,...operation})}:{})});
 const value=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(value.error),{status:response.status});
 return value;
}
/** Explicit actions retain the same key after an uncertain response. No automatic retry. */
function useOperation(accountId:string,onSaved:()=>Promise<void>) {
 const t=useTranslations('WorkTeams');const {user}=useUser();const owner=useRef(user?.id);const pending=useRef(false);
 useLayoutEffect(()=>{owner.current=user?.id;return()=>{owner.current=undefined;};},[user?.id]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState<Action|null>(null);
 async function run(action:string,p:Record<string,unknown>,saved?:Action) {
  if(pending.current||owner.current!==accountId)return false;
  const operation=saved??{action,p:{...p,key:crypto.randomUUID()}};
  pending.current=true;setBusy(true);setError('');setRetry(operation);
  try{await api(accountId,operation);if(owner.current!==accountId)return false;setRetry(null);await onSaved();return owner.current===accountId;}
  catch(cause){if(owner.current===accountId){setError(cause instanceof Error&&cause.message?cause.message:t('unavailable'));if((cause as {status?:number}).status&&((cause as {status:number}).status<500)){setRetry(null);await onSaved();}}}
  finally{pending.current=false;if(owner.current===accountId)setBusy(false);}
  return false;
 }
 return {run,busy,error,retry,node:<>{error&&<p role="alert" className="text-sm text-red-400">{error}</p>}{retry&&!busy&&<button className={control} onClick={()=>void run(retry.action,retry.p,retry)}>{t('retry')}</button>}</>};
}
/** Private text/admin recovery preserves the operation key BEFORE a write. */
function RecoveryForm({accountId,formKey,initial,operation,onSaved,onCommitted,submit,children}:{accountId:string;formKey:string;initial:Record<string,unknown>;operation:(value:Record<string,unknown>)=>Action;onSaved:()=>Promise<void>;onCommitted?:()=>void;submit:string;children:(value:Record<string,unknown>,edit:(patch:Record<string,unknown>)=>void,busy:boolean)=>ReactNode}) {
 const t=useTranslations('WorkTeams');const {user,isLoaded}=useUser();const owner=useRef(user?.id),pending=useRef(false);
 useLayoutEffect(()=>{owner.current=user?.id;return()=>{owner.current=undefined;};},[user?.id]);
 const [value,setValue]=useState<Record<string,unknown>>({...initial,pendingAction:null}),[busy,setBusy]=useState(false),[posting,setPosting]=useState(false),[error,setError]=useState('');
 const draft=useFormDraft({formKey,value,enabled:isLoaded&&user?.id===accountId,busy:posting,restore:saved=>setValue({...initial,...saved})});
 function edit(patch:Record<string,unknown>){draft.resume();setValue(current=>({...current,...patch}));}
 async function send(){
  if(pending.current||owner.current!==accountId||!draft.loaded)return;
  pending.current=true;setBusy(true);setError('');
  try{
   const saved=value.pendingAction as Action|null;
   const next=saved&&typeof saved.action==='string'&&saved.p? saved : (()=>{const request=operation(value);return {...request,p:{...request.p,key:crypto.randomUUID()}};})();
   flushSync(()=>setValue(current=>({...current,pendingAction:next})));
   if(!await draft.flush())throw new Error(t('recoveryError'));
   if(owner.current!==accountId)return;setPosting(true);
   await api(accountId,next);if(owner.current!==accountId)return;
   await draft.complete();if(owner.current!==accountId)return;flushSync(()=>{setValue({...initial,pendingAction:null});setPosting(false);});draft.resume();await onSaved();if(owner.current===accountId)onCommitted?.();
  }catch(cause){if(owner.current===accountId){setError(cause instanceof Error&&cause.message?cause.message:t('unavailable'));if((cause as {status?:number}).status&&((cause as {status:number}).status<500)){setValue(current=>({...current,pendingAction:null}));await onSaved();}}}
  finally{pending.current=false;if(owner.current===accountId){setBusy(false);setPosting(false);}}
 }
 return <form onSubmit={event=>{event.preventDefault();void send();}} className="space-y-3 rounded-2xl border border-border bg-bg-primary p-4"><fieldset disabled={busy||!!value.pendingAction} className="min-w-0 space-y-3">{children(value,edit,busy)}</fieldset><FormDraftStatus draft={draft}/>{error&&<p role="alert" className="text-sm text-red-400">{error}</p>}<button className={control} disabled={busy||!draft.loaded}>{value.pendingAction?t('retry'):submit}</button></form>;
}

export default function WorkTeams({accountId,accountMatches}:{accountId:string;accountMatches:boolean}) {
 const t=useTranslations('WorkTeams'),router=useRouter(),params=useSearchParams();const {leave}=useFormNavigation();const {user,isLoaded}=useUser();
 const nativeAvailable=useSyncExternalStore(nativeWorkTeamContainerSubscribe,nativeWorkTeamContainerAvailable,nativeWorkTeamContainerServer);
 const native=nativeAvailable?nativeWorkTeamContainer():null;
 const selected=params.get('team'),conversation=params.get('channel');const owner=useRef(user?.id),sequence=useRef(0),verifiedRead=useRef<{request:number;account:string;team:string|null}|null>(null),nativeResumeRead=useRef<Promise<void>|null>(null);useLayoutEffect(()=>{owner.current=user?.id;return()=>{owner.current=undefined;};},[user?.id]);
 const linkingRequest=useRef(false);const [linkingTeam,setLinkingTeam]=useState<string|null>(null);
 const [state,setState]=useState<{owner:string;teams:Team[];showInInbox:boolean;team:Team|null}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const requestAllowed=accountMatches&&(!native||native.accountId===accountId&&(!native.teamId||native.teamId===selected));
 const same=requestAllowed&&isLoaded&&user?.id===accountId;
 const load=useCallback(async(forceNativeResume=false)=>{
  if(native&&nativeResumeRead.current&&!forceNativeResume){await nativeResumeRead.current;return;}
  if(owner.current!==accountId||!requestAllowed)return;
  const request=++sequence.current;
  try{
   const [list,team]=await Promise.all([api(accountId),selected?api(accountId,undefined,selected):Promise.resolve(null)]);
   if(owner.current!==accountId||request!==sequence.current)return;
   if(list.accountId!==accountId||team&&team.accountId!==accountId)throw Object.assign(new Error(t('accountChanged')),{status:403});
   verifiedRead.current={request,account:accountId,team:selected};setState({owner:accountId,teams:list.teams,showInInbox:list.showInInbox,team});setError('');
  }catch(cause){if(owner.current===accountId&&request===sequence.current){verifiedRead.current=null;const status=(cause as {status?:number}).status;if(native&&[401,403,404].includes(status??0)){setState(null);postNativeWorkTeamContainer(native,'cover');}else if(!native)setState(null);setError(cause instanceof Error&&cause.message?cause.message:t('unavailable'));}}
  finally{if(owner.current===accountId&&request===sequence.current)setLoading(false);}
 },[accountId,requestAllowed,selected,t,native]);
 useEffect(()=>{let active=true;if(native&&!isLoaded)return()=>{active=false;sequence.current+=1;};queueMicrotask(()=>{if(active){if(!native)setState(null);setLoading(true);void load();}});return()=>{active=false;sequence.current+=1;};},[load,same,native,isLoaded]);
 useEffect(()=>{if(!same)return;const refreshed=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('focus',refreshed);document.addEventListener('visibilitychange',refreshed);return()=>{window.removeEventListener('focus',refreshed);document.removeEventListener('visibilitychange',refreshed);};},[same,load]);
 const action=useOperation(accountId,load);
 const visible=same&&state?.owner===accountId&&(!selected||state.team?.id===selected)?state:null;
 useEffect(()=>{
  if(!native||!isLoaded)return;
  if(!same||native.accountId!==accountId){postNativeWorkTeamContainer(native,'cover');return;}
  const request=(event:Event)=>{const requestId=nativeWorkTeamLeaveRequest(event,native);if(!requestId)return;const leaseId=nativeWorkTeamLease(native);const accepted=leave(()=>postNativeWorkTeamContainer(native,'leaveGranted',{requestId,leaseId}),{onStay:()=>postNativeWorkTeamContainer(native,'leaveStayed',{requestId,leaseId})});if(!accepted)postNativeWorkTeamContainer(native,'leaveStayed',{requestId});};
  const resume=(event:Event)=>{const requestId=nativeWorkTeamLeaveRequest(event,native);if(!requestId)return;const before=sequence.current,leaseId=nativeWorkTeamLease(native),job=load(true);nativeResumeRead.current=job;void job.then(()=>{const proof=verifiedRead.current;if(owner.current===accountId&&proof&&proof.account===accountId&&proof.team===selected&&proof.request>before&&proof.request===sequence.current)postNativeWorkTeamContainer(native,'ready',{requestId,leaseId});else postNativeWorkTeamContainer(native,'resumeFailed',{requestId,leaseId});}).finally(()=>{if(nativeResumeRead.current===job)nativeResumeRead.current=null;});};
  window.addEventListener('cinegenius:work-team-leave-request',request);window.addEventListener('cinegenius:work-team-resume-request',resume);
  return()=>{window.removeEventListener('cinegenius:work-team-leave-request',request);window.removeEventListener('cinegenius:work-team-resume-request',resume);};
 },[native,same,isLoaded,accountId,selected,load,leave]);
 useEffect(()=>{if(native&&same&&native.accountId===accountId&&!loading&&(visible||error)&&document.querySelector('[data-native-work-team-container="v1"]'))postNativeWorkTeamContainer(native,'ready');},[native,same,accountId,loading,visible,error]);
 const closeNative=()=>{if(native){const leaseId=nativeWorkTeamLease(native);leave(()=>postNativeWorkTeamContainer(native,'close',{leaseId}));}};
 async function connectTeam(teamId:string) {
  if(!native?.linking||!same||owner.current!==accountId||linkingRequest.current)return;
  const leaseId=nativeWorkTeamLease(native);
  linkingRequest.current=true;setLinkingTeam(teamId);setError('');
  try{
   // A list entry or local label is not membership proof. Re-check the selected
   // online team on the server after this explicit click, then retain its lease.
   const team=await api(accountId,undefined,teamId);
   if(owner.current!==accountId||nativeWorkTeamContainer()!==native||nativeWorkTeamLease(native)!==leaseId)return;
   if(team.accountId!==accountId||team.id!==teamId||!team.members?.some((member:Member)=>member.userId===accountId&&member.status==='active'))throw new Error(t('notAllowed'));
   postNativeWorkTeamContainer(native,'link',{teamId,leaseId});
  }catch(cause){if(owner.current===accountId)setError(cause instanceof Error&&cause.message?cause.message:t('unavailable'));}
  finally{linkingRequest.current=false;if(owner.current===accountId)setLinkingTeam(null);}
 }
 const nativeHeader=native?<div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2"><button type="button" className={control} onClick={closeNative}>{t('back')}</button><span className="min-w-0 flex-1 break-words text-sm font-semibold">{t('groupsTitle')}</span>{native.linking&&visible?.team&&<button type="button" className={control} disabled={!!linkingTeam} onClick={()=>leave(()=>void connectTeam(visible.team!.id))}>{t('linkLocalTeam')}</button>}</div>:null;
 function go(team?:string,channel?:string){if(native?.teamId&&team!==native.teamId){closeNative();return;}leave(()=>{const query=new URLSearchParams();query.set('account',accountId);if(team)query.set('team',team);if(channel)query.set('channel',channel);router.push('/work/teams?'+query);});}
 if(!same)return <main className="site-container py-8"><p role="alert">{t('accountChanged')}</p></main>;
 const currentChannel=visible?.team?.channels.find(c=>c.conversationId===conversation&&c.joined&&c.canSee);
 if(currentChannel&&visible?.team)return <>{nativeHeader}<main className={native?'flex min-h-0 min-w-0 flex-1 flex-col px-3 py-2':'site-container flex min-h-[70dvh] min-w-0 flex-col py-3'}><p className="mb-2 text-sm text-text-muted">{visible.team.name} · {currentChannel.name}</p><MessagesContent key={accountId+currentChannel.id} embedded={{destination:{conversationId:currentChannel.conversationId},onDestination:()=>{},onBack:()=>go(visible.team!.id),onClose:()=>go(visible.team!.id)}}/></main></>;
 return <>{nativeHeader}<main className={native?'min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto px-4 py-4':'site-container max-w-3xl space-y-5 py-6 pb-[calc(var(--mobile-nav-clearance,80px)+24px)]'}>
  <header className="space-y-2">{selected&&!native&&<button className={control} onClick={()=>go()}>{t('back')}</button>}<h1 className="break-words font-display text-2xl font-bold">{visible?.team?.name??t(native?.linking?'linkTitle':'title')}</h1>{!selected&&<p className="text-sm text-text-muted">{t(native?.linking?'linkHelp':'separate')}</p>}</header>
  {loading&&<p role="status">{t('loading')}</p>}
  {error&&<div role="alert" className="space-y-3 rounded-2xl border border-border bg-bg-primary p-4"><p>{error}</p><button className={control} onClick={()=>void load()}>{t('retry')}</button></div>}
  {visible&&!selected&&<>
   <ul className="divide-y divide-border rounded-2xl border border-border bg-bg-primary">{visible.teams.map(team=><li key={team.id} className="flex min-w-0 flex-wrap items-center gap-3 p-4"><span className="min-w-0 flex-1 break-words font-medium">{team.name}</span>{team.status==='invited'?<><button className={control} disabled={action.busy} onClick={()=>void action.run('accept',{teamId:team.id,revision:team.revision})}>{t('accept')}</button><button className={control} disabled={action.busy} onClick={()=>void action.run('decline',{teamId:team.id,revision:team.revision})}>{t('decline')}</button></>:<button className={control} disabled={!!linkingTeam} onClick={()=>native?.linking?leave(()=>void connectTeam(team.id)):go(team.id)}>{linkingTeam===team.id?t('connecting'):t(native?.linking?'linkAction':'open')}</button>}</li>)}</ul>
   {!visible.teams.length&&<p className="text-sm text-text-muted">{t('empty')}</p>}
   <details><summary className="min-h-11 cursor-pointer py-3">{t('createTeam')}</summary><RecoveryForm accountId={accountId} formKey="workspace-team:new" initial={{name:''}} operation={value=>({action:'create_team',p:{name:value.name}})} onSaved={load} submit={t('createTeam')}>{(value,edit)=><label className="block text-sm">{t('name')}<input required maxLength={80} value={String(value.name)} onChange={event=>edit({name:event.target.value})} className={field}/></label>}</RecoveryForm></details>
   {!native?.linking&&<details><summary className="min-h-11 cursor-pointer py-3">{t('teamSettings')}</summary><label className="flex min-h-11 items-start gap-3 rounded-2xl border border-border bg-bg-primary p-4"><input type="checkbox" checked={visible.showInInbox} disabled={action.busy} onChange={event=>void action.run('preference',{showInInbox:event.target.checked})} className="mt-1 size-5 shrink-0"/><span><strong className="block text-sm">{t('inbox')}</strong><span className="text-xs text-text-muted">{t('inboxHelp')}</span></span></label></details>}
  </>}
  {visible?.team&&<TeamPanel key={accountId+visible.team.id} accountId={accountId} team={visible.team} onSaved={load} openChannel={id=>go(visible.team!.id,id)} leaveTeam={async()=>{await load();go();}}/>}
  {action.node}
 </main></>;
}
function TeamPanel({accountId,team,onSaved,openChannel,leaveTeam}:{accountId:string;team:Team;onSaved:()=>Promise<void>;openChannel:(id:string)=>void;leaveTeam:()=>Promise<void>}) {
 const t=useTranslations('WorkTeams');const {leave}=useFormNavigation();
 const action=useOperation(accountId,onSaved),isAdmin=team.role==='admin',base={teamId:team.id,revision:team.revision};
 const [creating,setCreating]=useState(false),[optionsId,setOptionsId]=useState<string|null>(null);
 const plus=useRef<HTMLButtonElement>(null);
 const options=team.channels.find(channel=>channel.id===optionsId);
 const closeCreate=()=>leave(()=>{setCreating(false);plus.current?.focus();});
 return <section className="min-w-0 space-y-4" aria-labelledby="work-team-groups-title">
  <div className="flex min-w-0 items-center gap-3">
   <h2 id="work-team-groups-title" className="min-w-0 flex-1 break-words text-lg font-semibold">{t('groupsTitle')}</h2>
   {isAdmin&&<button ref={plus} type="button" className={control+' shrink-0'} aria-label={t('newGroup')} aria-expanded={creating} aria-controls="work-team-new-group" onClick={()=>creating?closeCreate():setCreating(true)}><Plus size={22} aria-hidden="true"/></button>}
  </div>
  {isAdmin&&creating&&<div id="work-team-new-group" className="space-y-2">
   <RecoveryForm accountId={accountId} formKey={'workspace-team:'+team.id} initial={{name:'',visibility:'team'}} operation={value=>({action:'create_channel',p:{...base,name:value.name,visibility:value.visibility}})} onSaved={onSaved} onCommitted={()=>{setCreating(false);plus.current?.focus();}} submit={t('newGroup')}>
    {(value,edit)=><><label className="block text-sm">{t('name')}<input autoFocus required maxLength={80} value={String(value.name)} onChange={event=>edit({name:event.target.value})} className={field}/></label>
     <details><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('visibility')}</summary><label className="block text-sm">{t('visibility')}<select value={String(value.visibility)} onChange={event=>edit({visibility:event.target.value})} className={field}><option value="team">{t('teamAccess')}</option><option value="selected">{t('selectedAccess')}</option></select></label></details></>}
   </RecoveryForm>
   <button type="button" className={control} onClick={closeCreate}>{t('cancel')}</button>
  </div>}
  <ul className="min-w-0 divide-y divide-border rounded-2xl border border-border bg-bg-primary">
   {team.channels.map(channel=><li key={channel.id} className="flex min-w-0 items-center gap-2 p-2">
    <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left disabled:opacity-50" disabled={action.busy||!channel.canSee||!channel.joined&&!channel.canJoin} onClick={()=>{if(channel.joined){openChannel(channel.conversationId);return;}void action.run('join',{...base,channelId:channel.id}).then(saved=>{if(saved)openChannel(channel.conversationId);});}}>
     <MessageCircle size={22} className="shrink-0 text-text-muted" aria-hidden="true"/>
     <span className="min-w-0 flex-1 break-words font-medium">{channel.name}{channel.joined&&!channel.canWrite&&<span className="block text-xs font-normal text-text-muted">{t('readOnly')}</span>}{!channel.joined&&!channel.canJoin&&<span className="block text-xs font-normal text-text-muted">{t('joinRestricted')}</span>}</span>
     {(channel.joined||channel.canJoin)&&<span className="min-w-0 max-w-[42%] shrink-0 break-words text-right text-sm text-text-muted">{t(channel.joined?'open':'join')}</span>}
    </button>
    {(isAdmin||channel.joined)&&<button type="button" className={control+' shrink-0'} aria-label={t('groupOptions',{name:channel.name})} aria-expanded={optionsId===channel.id} onClick={()=>leave(()=>setOptionsId(optionsId===channel.id?null:channel.id))}><MoreHorizontal size={20} aria-hidden="true"/></button>}
   </li>)}
  </ul>
  {!team.channels.length&&<p className="text-sm text-text-muted">{t('noChannels')}</p>}
  {action.node}
  {options&&<section aria-label={t('groupOptions',{name:options.name})} className="space-y-3 rounded-2xl border border-border bg-bg-primary p-4">
   <h3 className="break-words font-semibold">{options.name}</h3>
   {isAdmin&&<ChannelAdmin key={options.id} accountId={accountId} team={team} channel={options} onSaved={onSaved}/>}
   {options.joined&&<button className={control} disabled={action.busy} onClick={()=>void action.run('leave',{...base,channelId:options.id}).then(saved=>{if(saved)setOptionsId(null);})}>{t('leaveChannel')}</button>}
   <button type="button" className={control} onClick={()=>leave(()=>setOptionsId(null))}>{t('cancel')}</button>
  </section>}
  <p className="text-xs text-text-muted">{t('historyHelp')}</p>
  <details><summary className="min-h-11 cursor-pointer py-3">{t('teamSettings')}</summary><div className="space-y-4">
   {isAdmin&&<details><summary className="min-h-11 cursor-pointer py-3">{t('invite')}</summary><InviteTeam accountId={accountId} team={team} onSaved={onSaved}/></details>}
   <details><summary className="min-h-11 cursor-pointer py-3">{t('members')}</summary><ul className="divide-y divide-border">{team.members.map(member=><li key={member.userId} className="flex min-w-0 flex-wrap items-center gap-2 py-3"><span className="min-w-0 flex-1 break-words">{member.name}<span className="ml-2 text-xs text-text-muted">{t(member.status==='invited'?'invited':member.role)}</span></span>{isAdmin&&member.userId!==accountId&&<>{member.status==='active'&&member.role!=='admin'&&<button className={control} disabled={action.busy} onClick={()=>void action.run('promote',{...base,userId:member.userId})}>{t('promote')}</button>}<button className={control} disabled={action.busy} onClick={()=>void action.run('remove_member',{...base,userId:member.userId})}>{t('remove')}</button></>}</li>)}</ul></details>
   <details><summary className="min-h-11 cursor-pointer py-3">{t('leaveTeam')}</summary><p className="mb-3 text-sm text-text-muted">{t('leaveTeamHelp')}</p><LeaveTeamButton accountId={accountId} team={team} onSaved={leaveTeam}/></details>
  </div></details>
 </section>;
}
function LeaveTeamButton({accountId,team,onSaved}:{accountId:string;team:Team;onSaved:()=>Promise<void>}) {const t=useTranslations('WorkTeams');const action=useOperation(accountId,onSaved);return <><button className={control} disabled={action.busy} onClick={()=>void action.run('leave_team',{teamId:team.id,revision:team.revision})}>{t('leaveTeam')}</button>{action.node}</>;}
function InviteTeam({accountId,team,onSaved}:{accountId:string;team:Team;onSaved:()=>Promise<void>}) {
 const t=useTranslations('WorkTeams');const [selected,setSelected]=useState<MessagePerson[]>([]);const action=useOperation(accountId,async()=>{setSelected([]);await onSaved();});
 return <div className="space-y-3 rounded-2xl border border-border bg-bg-primary p-4"><p className="text-xs text-text-muted">{t('inviteHelp')}</p><PeoplePicker contacts={[]} selected={selected} onChange={setSelected} exclude={team.members.map(m=>m.userId)} maxSelection={1} disabled={action.busy}/><button className={control} disabled={action.busy||selected.length!==1} onClick={()=>void action.run('invite',{teamId:team.id,revision:team.revision,userId:selected[0].id})}>{t('invite')}</button>{action.node}</div>;
}
function ChannelAdmin({accountId,team,channel,onSaved}:{accountId:string;team:Team;channel:Channel;onSaved:()=>Promise<void>}) {
 const t=useTranslations('WorkTeams');const action=useOperation(accountId,onSaved);const [member,setMember]=useState('');const [access,setAccess]=useState({canSee:'default',canJoin:'default',canWrite:'default',denied:false});
 const nullable=(value:string)=>value==='default'?null:value==='yes';
 function choose(id:string){setMember(id);const a=channel.access.find(a=>a.userId===id);const str=(v:boolean|null|undefined)=>v==null?'default':v?'yes':'no';setAccess({canSee:str(a?.canSee),canJoin:str(a?.canJoin),canWrite:str(a?.canWrite),denied:a?.denied??false});}
 return <details><summary className="min-h-11 cursor-pointer py-3 text-sm">{t('manage')}</summary><div className="space-y-4">
  <RecoveryForm accountId={accountId} formKey={'workspace-channel:'+channel.id} initial={{name:channel.name,visibility:channel.visibility,defaultJoin:channel.defaultJoin,defaultWrite:channel.defaultWrite,archived:false}} operation={value=>({action:'configure_channel',p:{...value,teamId:team.id,channelId:channel.id,revision:team.revision,pendingAction:undefined}})} onSaved={onSaved} submit={t('save')}>{(value,edit)=><><label className="block text-sm">{t('name')}<input required maxLength={80} value={String(value.name)} onChange={event=>edit({name:event.target.value})} className={field}/></label><label className="block text-sm">{t('visibility')}<select className={field} value={String(value.visibility)} onChange={event=>edit({visibility:event.target.value})}><option value="team">{t('teamAccess')}</option><option value="selected">{t('selectedAccess')}</option></select></label>{(['defaultJoin','defaultWrite','archived'] as const).map(key=><label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={value[key]===true} onChange={event=>edit({[key]:event.target.checked})} className="size-5"/>{t(key)}</label>)}</>}</RecoveryForm>
  <fieldset disabled={action.busy} className="min-w-0 space-y-3 rounded-xl border border-border p-3"><label className="block text-sm">{t('memberRights')}<select value={member} onChange={event=>choose(event.target.value)} className={field}><option value="">{t('chooseMember')}</option>{team.members.filter(m=>m.status==='active').map(m=><option key={m.userId} value={m.userId}>{m.name}</option>)}</select></label>{member&&<>{(['canSee','canJoin','canWrite'] as const).map(key=><label key={key} className="block text-sm">{t(key)}<select value={access[key]} onChange={event=>setAccess(current=>({...current,[key]:event.target.value}))} className={field}><option value="default">{t('default')}</option><option value="yes">{t('yes')}</option><option value="no">{t('no')}</option></select></label>)}<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={access.denied} onChange={event=>setAccess(current=>({...current,denied:event.target.checked}))} className="size-5"/>{t('deny')}</label><button className={control} disabled={action.busy} onClick={()=>void action.run('set_access',{teamId:team.id,revision:team.revision,channelId:channel.id,userId:member,canSee:nullable(access.canSee),canJoin:nullable(access.canJoin),canWrite:nullable(access.canWrite),denied:access.denied})}>{t('save')}</button></>}{action.node}</fieldset>
 </div></details>;
}
