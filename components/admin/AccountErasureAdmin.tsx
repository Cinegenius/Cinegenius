'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@clerk/nextjs';
import {useFormatter,useTranslations} from 'next-intl';
import type {ErasureState} from '@/lib/account-erasure';
type Policy={revision:number;enabled:boolean;evidence:string|null;valid_until:string|null;backup_days:number|null;provider_days:number|null;receipt_days:number|null};
type Row={id:string;owner_id:string;state:ErasureState;revision:number;requested_at:string;response_due_at:string;reason:string|null};
type Inventory={schema:string;table:string;matchingRows:number};
export default function AccountErasureAdmin(){
 const {userId}=useAuth();
 return <AccountErasureAdminContent key={userId??'signed-out'} userId={userId??null}/>;
}
function AccountErasureAdminContent({userId}:{userId:string|null}){
 const t=useTranslations('AccountErasure'),fmt=useFormatter();
 const current=useRef<string|null>(userId);const generation=useRef(0),lock=useRef(false);
 const [data,setData]=useState<{account:string;requests:Row[];policy:Policy;nextCursor:string|null}|null>(null);
 const [policy,setPolicy]=useState<Policy|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const [inventory,setInventory]=useState<{id:string;rows:Inventory[]}|null>(null);
 const load=useCallback(async(after?:string)=>{
  if(!userId)return;const account=userId,version=++generation.current;
  try{const response=await fetch('/api/admin/privacy-requests'+(after?'?after='+encodeURIComponent(after):''),{cache:'no-store'});const body=await response.json();
   if(current.current!==account||version!==generation.current)return;
   if(!response.ok||body.accountId!==account||!Array.isArray(body.requests)||!body.policy)throw new Error();
   setError(false);setData({account,...body});setPolicy(old=>old??body.policy);
  }catch{if(current.current===account&&version===generation.current)setError(true);}
 },[userId]);
 useEffect(()=>{current.current=userId;const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);current.current=null;};},[load,userId]);
 async function submit(body:Record<string,unknown>){
  if(!userId||lock.current||data?.account!==userId)return;const account=userId,version=++generation.current;lock.current=true;setBusy(true);setError(false);
  try{const response=await fetch('/api/admin/privacy-requests',{method:'POST',headers:{'Content-Type':'application/json','X-Account-Id':account},body:JSON.stringify(body)}),value=await response.json();
   if(current.current!==account||version!==generation.current)return;
   if(!response.ok||value.accountId!==account)throw new Error();
   if(value.policy)setPolicy(value.policy);
   await load();
  }catch{if(current.current===account)setError(true);}
  finally{if(current.current===account){lock.current=false;setBusy(false);}}
 }
 async function inspect(id:string){
  if(!userId)return;const account=userId,version=++generation.current;setInventory(null);
  try{const response=await fetch('/api/admin/privacy-requests?id='+encodeURIComponent(id),{cache:'no-store'}),body=await response.json();
   if(current.current!==account||version!==generation.current)return;
   if(!response.ok||body.accountId!==account||!Array.isArray(body.request?.inventory))throw new Error();
   setInventory({id,rows:body.request.inventory});
  }catch{if(current.current===account&&version===generation.current)setError(true);}
 }
 const rows=data&&data.account===userId?data.requests:[];
 return <main className="site-container min-w-0 [overflow-wrap:anywhere] space-y-5 pt-24 pb-[calc(7rem+env(safe-area-inset-bottom))]">
  <Link href="/admin" className="inline-flex min-h-11 items-center underline">{t('back')}</Link>
  <h1 className="text-2xl font-semibold">{t('adminTitle')}</h1><p className="max-w-3xl text-sm text-text-muted">{t('adminIntro')}</p>
  {error&&<p role="alert">{t('error')}</p>}
  <button className="min-h-11 rounded-lg border border-border px-4" disabled={busy} onClick={()=>void load()}>{t('refresh')}</button>
  {!data&&!error&&<p role="status">{t('loading')}</p>}
  {data?.account===userId&&policy&&<details className="rounded-xl border border-border p-4"><summary className="min-h-11 cursor-pointer font-semibold">{t('policyTitle')} · {t(policy.enabled?'enabled':'disabled')}</summary>
   <form className="mt-3 grid max-w-3xl gap-4" onSubmit={event=>{event.preventDefault();if(!window.confirm(t('policyConfirm')))return;void submit({action:'policy',revision:policy.revision,enabled:policy.enabled,evidence:policy.evidence??'',validUntil:policy.valid_until,backupDays:policy.backup_days,providerDays:policy.provider_days,receiptDays:policy.receipt_days});}}>
    <p className="text-sm text-text-muted">{t('policyIntro')}</p>
    <label className="grid gap-2">{t('evidence')}<textarea required minLength={20} maxLength={1000} value={policy.evidence??''} onChange={e=>setPolicy({...policy,evidence:e.target.value})} className="min-h-28 w-full rounded-lg border border-border bg-bg-secondary p-3"/></label>
    <div className="grid gap-4 sm:grid-cols-3">{(['backup_days','provider_days','receipt_days'] as const).map(field=><label key={field} className="grid min-w-0 gap-2">{t(field)}<input type="number" required min={field==='receipt_days'?1:0} max={365} value={policy[field]??''} onChange={e=>setPolicy({...policy,[field]:e.target.value===''?null:Number(e.target.value)})} className="min-h-11 w-full rounded-lg border border-border bg-bg-secondary px-3"/></label>)}</div>
    <label className="grid gap-2">{t('validUntil')}<input type="date" required value={policy.valid_until?.slice(0,10)??''} onChange={e=>setPolicy({...policy,valid_until:e.target.value?e.target.value+'T23:59:59Z':null})} className="min-h-11 min-w-0 rounded-lg border border-border bg-bg-secondary px-3"/></label>
    <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})} className="h-5 w-5"/>{t('enabled')}</label>
    <button type="submit" disabled={busy} className="min-h-11 rounded-lg border border-border px-4 disabled:opacity-50">{t('save')}</button>
   </form></details>}
  {data&&rows.length===0&&<p>{t('empty')}</p>}
  {rows.map(row=><section key={row.id} className="min-w-0 space-y-3 rounded-xl border border-border p-4 text-sm [overflow-wrap:anywhere]">
   <p className="font-semibold">{t('states.'+row.state)}</p><p>{t('receipt',{id:row.id})}</p><p>{row.owner_id}</p>
   <p>{t('deadline',{date:fmt.dateTime(new Date(row.response_due_at),{dateStyle:'medium',timeZone:'Europe/Berlin'})})}</p>
   {row.reason&&<p>{t('reasons.'+(['worker_unavailable','account_data_remaining','legacy_media','schema_changed','provider_review'].includes(row.reason)?row.reason:'worker_unavailable'))}</p>}
   <div className="flex flex-wrap gap-3"><button className="min-h-11 rounded-lg border border-border px-4" onClick={()=>void inspect(row.id)}>{t('inspect')}</button>
    {['pending','needs_review'].includes(row.state)&&<button className="min-h-11 rounded-lg border border-border px-4" disabled={busy} onClick={()=>void submit({action:'retry',id:row.id,revision:row.revision})}>{t('retry')}</button>}</div>
   {inventory?.id===row.id&&<ul className="list-inside list-disc">{inventory.rows.map(item=><li key={item.schema+'.'+item.table}>{item.schema}.{item.table}: {fmt.number(item.matchingRows)}</li>)}</ul>}
  </section>)}
  {data?.nextCursor&&<button className="min-h-11 rounded-lg border border-border px-4" onClick={()=>void load(data.nextCursor!)}>{t('more')}</button>}
 </main>;
}
