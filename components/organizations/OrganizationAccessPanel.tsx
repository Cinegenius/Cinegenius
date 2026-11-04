'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
type LinkRow={id:string;organization_id?:string;company_id?:string;status:string;company?:{name:string};organization?:{name:string}};
type Access={owner?:boolean;userId?:string;members?:{user_id:string;role:string;public_profile?:boolean;name?:string}[];invites?:{id:string;created_at:string;expires_at:string;recipient_email?:string}[];links:LinkRow[]};
const button='min-h-11 rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-50';
const input='min-h-11 w-full rounded-xl border border-border bg-bg-primary px-3 py-2';
export default function OrganizationAccessPanel({organizationId,companyId,onLeave}:{organizationId?:string;companyId?:string;onLeave?:(organizationId:string)=>void}) {
 const t=useTranslations('OrganizationAccess');const format=useFormatter();const [data,setData]=useState<Access|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const pending=useRef(false);
 const [email,setEmail]=useState('');const [companySlug,setCompanySlug]=useState('');const [invitePath,setInvitePath]=useState('');
 const endpoint=`/api/organizations/access?${companyId?`companyId=${companyId}`:`organizationId=${organizationId}`}`;
 const refresh=useCallback(async(signal?:AbortSignal)=>{const response=await fetch(endpoint,{cache:'no-store',signal});if(!response.ok)throw new Error('load');setData(await response.json());},[endpoint]);
 useEffect(()=>{const controller=new AbortController();setData(null);setInvitePath('');setMessage('');void refresh(controller.signal).catch(()=>{if(!controller.signal.aborted)setMessage('error');});return()=>controller.abort();},[refresh]);
 async function change(action:string,target='',org=organizationId,visible?:boolean) {
  if(pending.current)return;pending.current=true;setBusy(true);setMessage('');
  try {
   const response=await fetch('/api/organizations/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,target,organizationId:org,email,companySlug,visible})});const result=await response.json();
   if(!response.ok){setMessage(result.error==='unavailable'?'unavailable':result.error==='forbidden'?'forbidden':'error');return;}
   setInvitePath(result.invitationPath?`${window.location.origin}${result.invitationPath}`:'');setMessage('saved');setEmail('');setCompanySlug('');
   if(action==='leave'){setData(null);setMessage('left');if(org)onLeave?.(org);return;}
   await refresh();
  }catch{setMessage('error');}finally{pending.current=false;setBusy(false);}
 }
 return <section className="mt-8 space-y-4 rounded-2xl border border-border bg-bg-secondary p-5 sm:p-6"><h2 className="font-serif text-2xl">{t(companyId?'companyLinks':'title')}</h2><p className="text-sm text-text-secondary">{t(companyId?'linkNotice':'rightsNotice')}</p>
 {message&&<p role="status" className="break-words text-sm text-gold">{t(message)}</p>}{!data&&!message&&<p role="status">{t('loading')}</p>}
 {data&&<fieldset disabled={busy} className="min-w-0 space-y-6">
 {!companyId&&<><label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={Boolean(data.members?.find(member=>member.user_id===data.userId)?.public_profile)} onChange={event=>void change('public_profile','',organizationId,event.target.checked)}/><span>{t('publicProfile')}</span></label><div><h3 className="mb-3 font-semibold">{t('members')}</h3><ul className="space-y-3">{data.members?.map(member=><li key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div className="min-w-0 max-w-full break-words"><p>{member.name||member.user_id}</p><p className="text-sm text-text-muted">{t(member.role==='owner'?'owner':'admin')}</p></div>{member.role!=='owner'&&(data.owner||member.user_id===data.userId)&&<button className={button} onClick={()=>{if(window.confirm(t('removeConfirm')))void change(data.owner?'remove_member':'leave',member.user_id);}}>{t(member.user_id===data.userId?'leave':'remove')}</button>}</li>)}</ul></div>
 {data.owner&&<><form className="space-y-3" onSubmit={event=>{event.preventDefault();void change('invite');}}><h3 className="font-semibold">{t('invite')}</h3><label className="block text-sm">{t('email')}<input className={`${input} mt-2`} type="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label><p className="text-sm text-text-muted">{t('shareNotice')}</p><button className={button}>{t('createInvite')}</button></form>
 {invitePath&&<label className="block text-sm">{t('inviteLink')}<input className={`${input} mt-2`} readOnly value={invitePath} onFocus={event=>event.target.select()}/></label>}
 <div><h3 className="mb-3 font-semibold">{t('pendingInvites')}</h3>{!data.invites?.length&&<p className="text-sm text-text-muted">{t('empty')}</p>}{data.invites?.map(item=><div className="mb-2 flex flex-wrap items-center justify-between gap-2" key={item.id}><span className="min-w-0 break-words text-sm">{item.recipient_email&&<span className="block">{item.recipient_email}</span>}{t('expires',{date:format.dateTime(new Date(item.expires_at),{dateStyle:'medium'})})}</span><button className={button} onClick={()=>void change('revoke_invite',item.id)}>{t('withdraw')}</button></div>)}</div></>}
 </>}
 <div className="space-y-3"><h3 className="font-semibold">{t('companyLinks')}</h3>{!data.links.length&&<p className="text-sm text-text-muted">{t('empty')}</p>}{data.links.map(item=><div key={item.id} className="space-y-3 rounded-xl border border-border p-4"><p className="break-words">{item.company?.name||item.organization?.name}</p><p className="text-sm text-text-muted">{t(item.status==='accepted'?'linked':'pending')}</p><div className="flex flex-wrap gap-2">{companyId&&item.status==='pending'&&<><button className={button} onClick={()=>void change('accept_link',item.id,item.organization_id)}>{t('accept')}</button><button className={button} onClick={()=>void change('decline_link',item.id,item.organization_id)}>{t('decline')}</button></>}{(companyId||data.owner)&&<button className={button} onClick={()=>{if(window.confirm(t('unlinkConfirm')))void change('revoke_link',item.id,item.organization_id||organizationId);}}>{t(item.status==='accepted'?'unlink':'withdraw')}</button>}</div></div>)}
 {!companyId&&data.owner&&!data.links.length&&<form className="space-y-3" onSubmit={event=>{event.preventDefault();void change('request_link');}}><label className="block text-sm">{t('companyAddress')}<input required className={`${input} mt-2`} value={companySlug} onChange={event=>setCompanySlug(event.target.value)} maxLength={300}/></label><p className="text-sm text-text-muted">{t('linkNotice')}</p><button className={button}>{t('requestLink')}</button></form>}</div>
 </fieldset>}</section>;
}
