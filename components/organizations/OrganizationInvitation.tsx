'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
export default function OrganizationInvitation({token,available,organizationName}:{token:string;available:boolean;organizationName?:string}) {
 const t=useTranslations('OrganizationAccess'); const [state,setState]=useState(available?'ready':'unavailable'); const [busy,setBusy]=useState(false); const pending=useRef(false);
 async function respond(action:string) {
  if(pending.current)return; pending.current=true;setBusy(true);
  try {const response=await fetch('/api/organizations/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token})});const result=await response.json();setState(response.ok?action==='accept_invite'?'accepted':'declined':result.error==='forbidden'?'wrongAccount':'error');}
  catch {setState('error');}finally {pending.current=false;setBusy(false);}
 }
 return <main className="site-container py-10"><section className="mx-auto max-w-xl space-y-5 rounded-2xl border border-border bg-bg-secondary p-6"><h1 className="font-serif text-3xl">{t('invitationTitle')}</h1>{organizationName&&<p className="break-words font-semibold">{organizationName}</p>}<p className="text-text-secondary">{t('invitationNotice')}</p><p role="status">{t(state)}</p>{!['accepted','declined','unavailable'].includes(state)&&<div className="flex flex-wrap gap-3"><button disabled={busy} onClick={()=>void respond('accept_invite')} className="min-h-11 rounded-xl bg-gold px-5 text-black disabled:opacity-50">{t('accept')}</button><button disabled={busy} onClick={()=>void respond('decline_invite')} className="min-h-11 rounded-xl border border-border px-5">{t('decline')}</button></div>}{state==='accepted'&&<Link className="block text-gold" href="/organization-dashboard">{t('openDashboard')}</Link>}</section></main>;
}
