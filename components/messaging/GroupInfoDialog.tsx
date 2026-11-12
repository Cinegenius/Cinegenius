"use client";
import {useLayoutEffect, useRef, useState} from "react";
import {flushSync} from "react-dom";
import {useFormNavigation} from "@/contexts/FormDraftContext";
import {useUser} from "@clerk/nextjs";
import {useTranslations} from "next-intl";
import {Loader2, User} from "lucide-react";
import UnoptimizedImage from "@/components/UnoptimizedImage";
import MessagingDialog from "./MessagingDialog";
import PeoplePicker from "./PeoplePicker";
import {useFormDraft} from "@/lib/use-form-draft";
import FormDraftStatus from "@/components/FormDraftStatus";
import {confirmDialog} from "@/lib/native-dialog";
import {restoredPeople, type MessagePerson} from "@/lib/messaging-ui";
import {uiErrorMessage} from "@/lib/ui-error-message";

type Member={user_id:string;display_name:string;avatar_url:string|null;role:"admin"|"member"};
export type GroupInfo={id:string;group_name?:string|null;otherName?:string;isAdmin?:boolean;members?:Member[]};
export default function GroupInfoDialog({open,accountId,group,contacts,onClose,onRefresh,onLeave,onResume}:{open:boolean;accountId:string;group:GroupInfo;contacts:MessagePerson[];onClose:()=>void;onRefresh:()=>Promise<void>;onLeave:()=>void;onResume:()=>void}) {
 const {leave}=useFormNavigation();
 const t=useTranslations("Messaging"), {user,isLoaded}=useUser();
 const [value,setValue]=useState({name:group.group_name??group.otherName??"",baseName:group.group_name??group.otherName??"",editing:false,selected:[] as MessagePerson[]});
 const [adding,setAdding]=useState(false),[saving,setSaving]=useState(false),[posting,setPosting]=useState(false),[error,setError]=useState("");
 const pending=useRef(false),owner=useRef(user?.id);
 useLayoutEffect(()=>{owner.current=user?.id;return()=>{owner.current=undefined;};},[user?.id]);
 const sameAccount=isLoaded&&user?.id===accountId;
 const draft=useFormDraft({formKey:`message:group:${group.id}`,value,enabled:sameAccount&&!!group.isAdmin,busy:posting,restore:saved=>setValue({name:typeof saved.name==="string"?saved.name.slice(0,80):group.group_name??"",baseName:typeof saved.baseName==="string"?saved.baseName:group.group_name??"",editing:!!saved.editing,selected:restoredPeople(saved.selected)})});
 const members=group.members??[], lastAdmin=!!group.isAdmin&&members.length>1&&members.filter(member=>member.role==="admin").length===1;
 const availablePlaces=Math.max(0,50-members.length);
 const same=()=>owner.current===accountId;
 function edit(update:Partial<typeof value>){draft.resume();setValue(current=>({...current,...update}));setError("");}
 async function request(url:string,body:Record<string,unknown>,method="POST"){
  const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(20_000),body:JSON.stringify({...body,accountId})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok || payload.success !== true)throw new Error(payload.error??t("groupError"));
 }
 async function act(action:"rename"|"add"|"remove"|"leave"|"promote",member?:Member,confirmed=false){
  if(pending.current||!sameAccount)return;
  if(action==="leave"&&lastAdmin){setError(t("lastAdmin"));return;}
  if(!confirmed&&(action==="leave"||action==="remove"||action==="promote")){
   const confirmed=await confirmDialog({message:t(action==="leave"?"leaveConfirm":action==="promote"?"promoteConfirm":"removeConfirm",{name:member?.display_name??""}),confirmLabel:t(action==="leave"?"leaveGroup":action==="promote"?"makeAdmin":"removeMember"),cancelLabel:t("cancel")});
   if(!confirmed||!same())return;
  }
  pending.current=true;setSaving(true);setError("");
  try{
   if(action==="rename"||action==="add"){
    // Recovery must acknowledge the exact editable fields before the mutation.
    if(!await draft.flush())throw new Error(t("recoveryError"));
    if(!same())return;
   }
   setPosting(true);
   if(action==="rename"){
    await request(`/api/conversations/${group.id}/group`,{name:value.name.trim()},"PATCH");
    if(!same())return;flushSync(()=>{setValue(current=>({...current,name:value.name.trim(),baseName:value.name.trim(),editing:false}));setPosting(false);});
    if(!await draft.flush())setError(t("recoveryError"));
   }else if(action==="add"){
    for(const person of value.selected.filter(person=>!members.some(member=>member.user_id===person.id))){
     await request(`/api/conversations/${group.id}/members`,{action:"add",user_id:person.id});
     if(!same())return;setValue(current=>({...current,selected:current.selected.filter(item=>item.id!==person.id)}));
    }
    flushSync(()=>{setValue(current=>({...current,selected:[]}));setAdding(false);setPosting(false);});
    if(!await draft.flush())setError(t("recoveryError"));
   }else{
    await request(`/api/conversations/${group.id}/members`,{action,user_id:member?.user_id});
    if(!same())return;
    if(action==="leave"){await draft.complete();if(same())onLeave();return;}
   }
   if(same())await onRefresh();
  }catch(cause){if(same()){setError(uiErrorMessage(cause,t("groupError")));void onRefresh();}}
  finally{pending.current=false;if(same()){setSaving(false);setPosting(false);}}
 }
 async function requestLeave(){
  if(pending.current||lastAdmin||!sameAccount)return;
  const confirmed=await confirmDialog({message:t("leaveConfirm"),confirmLabel:t("leaveGroup"),cancelLabel:t("cancel")});
  if(!confirmed||!same())return;
  // A native top-layer dialog must close before the shared private-draft guard appears.
  onClose();
  window.setTimeout(()=>leave(()=>{if(!same())return;onResume();void act("leave",undefined,true);}),0);
 }
 return <MessagingDialog open={open&&sameAccount} title={t("groupInfo")} onClose={onClose} busy={saving}>
  <div className="space-y-2"><h3 className="break-words text-lg font-semibold [overflow-wrap:anywhere]">{group.group_name??group.otherName}</h3><p className="text-sm text-text-muted">{t("members",{count:members.length})}</p></div>
  {group.isAdmin&&<div className="flex flex-wrap gap-2"><button type="button" disabled={saving||!draft.loaded} onClick={()=>edit({editing:!value.editing,...(!value.editing&&value.name===value.baseName?{name:group.group_name??group.otherName??"",baseName:group.group_name??group.otherName??""}:{})})} className="min-h-11 rounded-xl border border-border px-3 text-sm">{t("renameGroup")}</button><button type="button" disabled={saving||!draft.loaded} onClick={()=>setAdding(current=>!current)} className="min-h-11 rounded-xl border border-border px-3 text-sm">{t("addPeople")}</button></div>}
  {group.isAdmin&&value.editing&&<div className="rounded-xl border border-border p-3"><label className="block text-sm text-text-secondary">{t("groupName")}<input maxLength={80} value={value.name} disabled={saving} onChange={event=>edit({name:event.target.value})} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg-secondary px-3 text-base text-text-primary"/></label><button type="button" disabled={saving||!value.name.trim()} onClick={()=>void act("rename")} className="mt-3 min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary disabled:opacity-40">{t("saveName")}</button></div>}
  {group.isAdmin&&adding&&<div className="rounded-xl border border-border p-3"><p className="mb-3 text-xs text-text-muted">{t("availablePlaces",{count:availablePlaces})}</p><PeoplePicker contacts={contacts} selected={value.selected} onChange={selected=>edit({selected})} exclude={members.map(member=>member.user_id)} maxSelection={availablePlaces} disabled={saving||!draft.loaded}/><button type="button" disabled={saving||!value.selected.length||value.selected.length>availablePlaces} onClick={()=>void act("add")} className="mt-3 min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary disabled:opacity-40">{t("addSelected")}</button></div>}
  <ul className="divide-y divide-border">{members.map(member=><li key={member.user_id} className="flex min-w-0 flex-wrap items-center gap-3 py-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated">{member.avatar_url?<UnoptimizedImage src={member.avatar_url} alt="" className="h-full w-full object-cover"/>:<User size={18} className="text-text-muted"/>}</span><span className="min-w-0 flex-1"><span className="block break-words text-sm [overflow-wrap:anywhere]">{member.display_name}{member.user_id===accountId?` · ${t("you")}`:""}</span><span className="text-xs text-text-muted">{t(member.role==="admin"?"admin":"member")}</span></span>{group.isAdmin&&member.user_id!==accountId&&<details className="w-full pl-0 sm:pl-12"><summary className="flex min-h-11 cursor-pointer items-center text-sm text-text-muted">{t("memberActions")}</summary><div className="flex flex-wrap gap-2">{member.role!=="admin"&&<button type="button" disabled={saving} onClick={()=>void act("promote",member)} className="min-h-11 rounded-xl border border-border px-3 text-sm text-gold">{t("makeAdmin")}</button>}<button type="button" disabled={saving} onClick={()=>void act("remove",member)} className="min-h-11 rounded-xl border border-border px-3 text-sm text-red-400 [[data-theme=light]_&]:text-red-700">{t("removeMember")}</button></div></details>}</li>)}</ul>
  <p className="text-xs leading-5 text-text-muted">{t("historyBoundary")}</p>
  {group.isAdmin&&(value.editing||value.selected.length>0||draft.status==="error")&&<FormDraftStatus draft={draft}/>}
  {lastAdmin&&<p className="text-xs leading-5 text-text-muted">{t("lastAdmin")}</p>}
  {error&&<p role="alert" className="break-words text-sm text-red-400 [[data-theme=light]_&]:text-red-700">{error}</p>}
  <button type="button" disabled={saving||lastAdmin} onClick={()=>void requestLeave()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-crimson/30 px-4 text-sm text-red-400 [[data-theme=light]_&]:text-red-700 disabled:opacity-50">{saving&&<Loader2 size={16} className="animate-spin"/>}{t("leaveGroup")}</button>
 </MessagingDialog>;
}
