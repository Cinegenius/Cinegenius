"use client";
import {useLayoutEffect, useRef, useState} from "react";
import {flushSync} from "react-dom";
import {useUser} from "@clerk/nextjs";
import {useTranslations} from "next-intl";
import {ArrowLeft, ChevronRight, Loader2, MessageCircle, Users} from "lucide-react";
import MessagingDialog from "./MessagingDialog";
import PeoplePicker from "./PeoplePicker";
import {useFormDraft} from "@/lib/use-form-draft";
import FormDraftStatus from "@/components/FormDraftStatus";
import {restoredPeople, validConversationId, suggestedGroupName, validMessageRequestKey, type MessagePerson, type MessageDestination} from "@/lib/messaging-ui";
import {uiErrorMessage} from "@/lib/ui-error-message";

type NewValue = {name: string; selected: MessagePerson[]; requestKey: string; mode: "" | "direct" | "group"};
export default function NewMessageDialog({open, accountId, contacts, onClose, onOpen, onContacts, contactsError = false, onRetryContacts, forceGroup = false}: {onContacts?:()=>void;contactsError?:boolean;onRetryContacts?:()=>void;forceGroup?:boolean;open:boolean; accountId:string; contacts:MessagePerson[]; onClose:()=>void; onOpen:(destination:MessageDestination, commit:()=>void)=>void}) {
  const t = useTranslations("Messaging");
  const contactsText = useTranslations("Contacts");
  const {user, isLoaded} = useUser();
  const [value,setValue] = useState<NewValue>({name:"",selected:[],requestKey:"",mode:""});
  const [details,setDetails] = useState(false);
  const [phase,setPhase] = useState<"idle"|"saving"|"posting">("idle");
  const [error,setError] = useState("");
  const pending = useRef(false), owner = useRef(user?.id), visible = useRef(open);
  useLayoutEffect(() => {visible.current = open; return () => {visible.current = false;};}, [open]);
  useLayoutEffect(() => {owner.current=user?.id; return () => {owner.current=undefined;};},[user?.id]);
  const sameAccount = isLoaded && user?.id===accountId;
  const draft = useFormDraft({formKey:"messages:new",value,enabled:sameAccount,busy:phase==="posting",restore:saved=>{const selected=restoredPeople(saved.selected);setValue({name:typeof saved.name==="string"?saved.name.slice(0,80):"",selected,requestKey:validMessageRequestKey(saved.requestKey)?saved.requestKey:"",mode:saved.mode==="direct"||saved.mode==="group"?saved.mode:selected.length>1?"group":selected.length?"direct":""});}});
  const mode = forceGroup ? "group" : value.mode;
  const suggestion = suggestedGroupName(value.selected,t("groupFallback"));
  function edit(update:Partial<NewValue>) {draft.resume();setValue(current=>{const next={...current,...update};const unchanged=next.name.trim()===current.name.trim()&&JSON.stringify(next.selected)===JSON.stringify(current.selected)&&next.mode===current.mode;return {...next,requestKey:unchanged?current.requestKey:crypto.randomUUID()};});setError("");}
  function reset() {void draft.complete();setValue({name:"",selected:[],requestKey:"",mode:""});setDetails(false);}
  async function start() {
    if(pending.current||!sameAccount||!draft.loaded||!mode||!value.selected.length||mode==="direct"&&value.selected.length!==1)return;
    pending.current=true;setPhase("saving");setError("");
    const sourceHref=window.location.href;
    const snapshot=value, idempotencyKey=validMessageRequestKey(value.requestKey)?value.requestKey:crypto.randomUUID();
    try {
      if(idempotencyKey!==value.requestKey)flushSync(()=>setValue(current=>({...current,requestKey:idempotencyKey})));
      if(!await draft.flush())throw new Error(t("recoveryError"));
      if(owner.current!==accountId || !visible.current || window.location.href!==sourceHref)return;
      setPhase("posting");
      if(mode==="direct"){
        const recipientId=snapshot.selected[0].id;
        const response=await fetch(`/api/conversations?with_user=${encodeURIComponent(recipientId)}`,{cache:"no-store",signal:AbortSignal.timeout(20_000)});
        const payload=await response.json();
        if(owner.current!==accountId || !visible.current || window.location.href!==sourceHref)return;
        if(!response.ok || payload.conversationId !== null && !validConversationId(payload.conversationId))throw new Error(payload.error??t("openError"));
        // The request is confirmed before navigation checks other private drafts.
        flushSync(()=>setPhase("idle"));
        onOpen(payload.conversationId?{conversationId:payload.conversationId}:{recipientId},reset);
      } else {
        const response=await fetch("/api/conversations/groups",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(20_000),body:JSON.stringify({name:snapshot.name.trim()||suggestedGroupName(snapshot.selected,t("groupFallback")),member_ids:snapshot.selected.map(person=>person.id),idempotencyKey,accountId})});
        const payload=await response.json().catch(()=>({}));
        if(owner.current!==accountId || !visible.current || window.location.href!==sourceHref)return;
        if(!response.ok||!validConversationId(payload.conversationId))throw new Error(payload.error??t("createError"));
        flushSync(()=>setPhase("idle"));
        onOpen({conversationId:payload.conversationId},reset);
      }
    } catch(cause){if(owner.current===accountId)setError(uiErrorMessage(cause,t("createError")));}
    finally{pending.current=false;if(owner.current===accountId)setPhase("idle");}
  }
  return <MessagingDialog compact={!mode} open={open&&sameAccount} title={t(mode === "group" ? "createGroup" : mode === "direct" ? "newChat" : "newMessage")} onClose={onClose} busy={phase!=="idle"} footer={mode ? <>
    <button type="button" disabled={phase!=="idle"} onClick={()=>details?setDetails(false):forceGroup?onClose():edit({mode:""})} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm"><ArrowLeft size={18}/>{t("back")}</button>
    <button type="button" onClick={()=>mode==="group"&&!details?setDetails(true):void start()} disabled={phase!=="idle"||!draft.loaded||!value.selected.length} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary disabled:opacity-40">{phase!=="idle"&&<Loader2 size={17} className="animate-spin"/>}{t(mode==="group"?details?"createGroup":"next":"openChat")}</button>
  </> : undefined}>
    {!mode ? <div className="divide-y divide-border rounded-2xl border border-border bg-bg-secondary">
      {([{id:"direct",label:t("newChat"),Icon:MessageCircle},{id:"group",label:t("createGroup"),Icon:Users}] as const).map(({id,label,Icon})=><button key={id} type="button" disabled={!draft.loaded} onClick={()=>{edit({mode:id,selected:id==="direct"?value.selected.slice(0,1):value.selected});setDetails(false);}} className="flex min-h-16 w-full items-center gap-3 p-4 text-left disabled:opacity-40"><Icon size={23} className="shrink-0 text-gold"/><span className="min-w-0 flex-1 break-words text-sm font-semibold">{label}</span><ChevronRight size={18} className="shrink-0 text-text-muted"/></button>)}
    </div> : details&&mode==="group" ? <>
      <label className="block text-sm text-text-secondary">{t("groupNameOptional")}<input autoFocus value={value.name} disabled={phase!=="idle"||!draft.loaded} maxLength={80} onChange={event=>edit({name:event.target.value})} placeholder={suggestion} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg-secondary px-3 text-base text-text-primary"/><span className="mt-2 block break-words text-xs text-text-muted">{t("groupNameSuggestion",{name:suggestion})}</span></label>
      <ul className="divide-y divide-border">{value.selected.map(person=><li key={person.id} className="min-h-11 break-words py-3 text-sm">{person.name}</li>)}</ul>
    </> : <>
      <p className="text-sm text-text-secondary">{t(mode==="group" ? "chooseGroupPeople" : "choosePeople")}</p>
      {onContacts && <button type="button" onClick={onContacts} disabled={phase!=="idle"||!draft.loaded} className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg-elevated disabled:opacity-40">{contactsText("title")}</button>}
      {contactsError && <div role="alert" className="text-sm text-red-400 [[data-theme=light]_&]:text-red-700"><p>{contactsText("loadError")}</p>{onRetryContacts && <button type="button" onClick={onRetryContacts} disabled={phase!=="idle"} className="min-h-11 text-gold">{contactsText("retry")}</button>}</div>}
      <PeoplePicker contacts={contacts} selected={value.selected} exclude={[accountId]} onChange={selected=>edit({selected})} maxSelection={mode==="direct"?1:49} disabled={phase!=="idle"||!draft.loaded}/>
    </>}
    <FormDraftStatus draft={draft}/>
    {error&&<p role="alert" className="break-words text-sm text-red-400 [[data-theme=light]_&]:text-red-700">{error}</p>}
  </MessagingDialog>;
}
