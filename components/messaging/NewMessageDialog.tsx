"use client";
import {useLayoutEffect, useRef, useState} from "react";
import {flushSync} from "react-dom";
import {useUser} from "@clerk/nextjs";
import {useTranslations} from "next-intl";
import {Loader2} from "lucide-react";
import MessagingDialog from "./MessagingDialog";
import PeoplePicker from "./PeoplePicker";
import {useFormDraft} from "@/lib/use-form-draft";
import FormDraftStatus from "@/components/FormDraftStatus";
import {restoredPeople, validConversationId, suggestedGroupName, validMessageRequestKey, type MessagePerson, type MessageDestination} from "@/lib/messaging-ui";
import {uiErrorMessage} from "@/lib/ui-error-message";

type NewValue = {name: string; selected: MessagePerson[]; requestKey: string};
export default function NewMessageDialog({open, accountId, contacts, onClose, onOpen}: {open:boolean; accountId:string; contacts:MessagePerson[]; onClose:()=>void; onOpen:(destination:MessageDestination, commit:()=>void)=>void}) {
  const t = useTranslations("Messaging");
  const {user, isLoaded} = useUser();
  const [value,setValue] = useState<NewValue>({name:"",selected:[],requestKey:""});
  const [phase,setPhase] = useState<"idle"|"saving"|"posting">("idle");
  const [error,setError] = useState("");
  const pending = useRef(false), owner = useRef(user?.id), visible = useRef(open);
  useLayoutEffect(() => {visible.current = open; return () => {visible.current = false;};}, [open]);
  useLayoutEffect(() => {owner.current=user?.id; return () => {owner.current=undefined;};},[user?.id]);
  const sameAccount = isLoaded && user?.id===accountId;
  const draft = useFormDraft({formKey:"messages:new",value,enabled:sameAccount,busy:phase==="posting",restore:saved=>setValue({name:typeof saved.name==="string"?saved.name.slice(0,80):"",selected:restoredPeople(saved.selected),requestKey:validMessageRequestKey(saved.requestKey)?saved.requestKey:""})});
  const suggestion = suggestedGroupName(value.selected,t("groupFallback"));
  function edit(update:Partial<NewValue>) {draft.resume();setValue(current=>{const next={...current,...update};const unchanged=next.name.trim()===current.name.trim()&&JSON.stringify(next.selected)===JSON.stringify(current.selected);return {...next,requestKey:unchanged?current.requestKey:crypto.randomUUID()};});setError("");}
  function reset() {void draft.complete();setValue({name:"",selected:[],requestKey:""});}
  async function start() {
    if(pending.current||!sameAccount||!draft.loaded||!value.selected.length)return;
    pending.current=true;setPhase("saving");setError("");
    const sourceHref=window.location.href;
    const snapshot=value, idempotencyKey=validMessageRequestKey(value.requestKey)?value.requestKey:crypto.randomUUID();
    try {
      if(idempotencyKey!==value.requestKey)flushSync(()=>setValue(current=>({...current,requestKey:idempotencyKey})));
      if(!await draft.flush())throw new Error(t("recoveryError"));
      if(owner.current!==accountId || !visible.current || window.location.href!==sourceHref)return;
      setPhase("posting");
      if(snapshot.selected.length===1){
        const recipientId=snapshot.selected[0].id;
        const response=await fetch(`/api/conversations?with_user=${encodeURIComponent(recipientId)}`,{cache:"no-store",signal:AbortSignal.timeout(20_000)});
        const payload=await response.json();
        if(owner.current!==accountId || !visible.current || window.location.href!==sourceHref)return;
        if(!response.ok || payload.conversationId !== null && !validConversationId(payload.conversationId))throw new Error(payload.error??t("openError"));
        onOpen(payload.conversationId?{conversationId:payload.conversationId}:{recipientId},reset);
      } else {
        const response=await fetch("/api/conversations/groups",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(20_000),body:JSON.stringify({name:snapshot.name.trim()||suggestedGroupName(snapshot.selected,t("groupFallback")),member_ids:snapshot.selected.map(person=>person.id),idempotencyKey,accountId})});
        const payload=await response.json().catch(()=>({}));
        if(owner.current!==accountId || !visible.current || window.location.href!==sourceHref)return;
        if(!response.ok||!validConversationId(payload.conversationId))throw new Error(payload.error??t("createError"));
        onOpen({conversationId:payload.conversationId},reset);
      }
    } catch(cause){if(owner.current===accountId)setError(uiErrorMessage(cause,t("createError")));}
    finally{pending.current=false;if(owner.current===accountId)setPhase("idle");}
  }
  return <MessagingDialog open={open&&sameAccount} title={t("newMessage")} onClose={onClose} busy={phase!=="idle"} footer={<button type="button" onClick={()=>void start()} disabled={phase!=="idle"||!draft.loaded||!value.selected.length} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary disabled:opacity-40">{phase!=="idle"&&<Loader2 size={17} className="animate-spin"/>}{t(value.selected.length>1?"createGroup":"openChat")}</button>}>
    <p className="text-sm text-text-secondary">{t("choosePeople")}</p>
    <PeoplePicker contacts={contacts} selected={value.selected} onChange={selected=>edit({selected})} disabled={phase!=="idle"||!draft.loaded}/>
    {value.selected.length>1&&<label className="block text-sm text-text-secondary">{t("groupNameOptional")}<input value={value.name} disabled={phase!=="idle"||!draft.loaded} maxLength={80} onChange={event=>edit({name:event.target.value})} placeholder={suggestion} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg-secondary px-3 text-base text-text-primary"/><span className="mt-2 block break-words text-xs text-text-muted">{t("groupNameSuggestion",{name:suggestion})}</span></label>}
    <FormDraftStatus draft={draft}/>
    {error&&<p role="alert" className="break-words text-sm text-red-400 [[data-theme=light]_&]:text-red-700">{error}</p>}
  </MessagingDialog>;
}
