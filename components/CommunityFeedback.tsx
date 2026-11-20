'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import BrowseSelect from '@/components/BrowseSelect';
import FormDraftStatus from '@/components/FormDraftStatus';
import GenieVoiceControls from '@/components/GenieVoiceControls';
import { useFormDraft } from '@/lib/use-form-draft';
import { COUNTRY_CODES } from '@/lib/places/countries';
import { LANGUAGE_OPTIONS, isAppLocale } from '@/lib/i18n/locales';
import { FEEDBACK_DRAFT_KEY, FEEDBACK_UUID, readFeedbackInput, readFeedbackAdvice, readFeedbackSubmission,
  type FeedbackAdvice, type FeedbackMessage, type FeedbackSubmission } from '@/lib/community-feedback';

type Draft = { text: string; country: string; language: string; history: FeedbackMessage[]; advice: FeedbackAdvice | null; pendingSubmission: FeedbackSubmission | null };
const empty = (language: string): Draft => ({text:'',country:'',language,history:[],advice:null,pendingSubmission:null});
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-gold';

export default function CommunityFeedback({accountId,initialCountry='',initialLanguage,initialOpening}: {accountId:string;initialCountry?:string;initialLanguage?:string;initialOpening?:string}) {
  const locale = useLocale(), t = useTranslations('Feedback'), g = useTranslations('Genie'), s = useTranslations('SupportContact');
  const {userId,isLoaded} = useAuth();
  const sameAccount = isLoaded && userId === accountId;
  const account = useRef<string | null | undefined>(userId);
  const request = useRef<AbortController | null>(null), locked = useRef(false);
  useLayoutEffect(() => { account.current = userId; return () => { account.current = undefined; request.current?.abort(); }; },[userId]);
  const [value,setValue] = useState<Draft>(() => ({...empty(initialLanguage || locale),country:initialCountry}));
  const [opening,setOpening] = useState({language:initialLanguage || locale,text:initialOpening || t('opening')});
  const [openingError,setOpeningError] = useState(false), [openingAttempt,setOpeningAttempt] = useState(0);
  useEffect(()=>{
    if(!sameAccount || opening.language === value.language) return;
    const controller=new AbortController();setOpeningError(false);
    void fetch('/api/feedback?lang='+encodeURIComponent(value.language),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])})
      .then(async response=>{const result=await response.json();if(!response.ok || result.locale!==value.language || typeof result.opening!=='string')throw Error();return result.opening;})
      .then(text=>{if(!controller.signal.aborted && account.current===accountId)setOpening({language:value.language,text});})
      .catch(()=>{if(!controller.signal.aborted && account.current===accountId)setOpeningError(true);});
    return ()=>controller.abort();
  },[sameAccount,accountId,opening.language,value.language,openingAttempt]);
  const [phase,setPhase] = useState<'idle'|'saving'|'discuss'|'submit'>('idle');
  const [error,setError] = useState('');
  const [conversation,setConversation] = useState('');
  const [german,setGerman] = useState(false);
  const [confirmed,setConfirmed] = useState(false);
  const restore = useCallback((saved: Draft) => {
    const next = empty(isAppLocale(saved.language) ? saved.language : locale);
    next.text = typeof saved.text === 'string' ? saved.text : '';
    next.country = (COUNTRY_CODES as readonly string[]).includes(saved.country) ? saved.country : '';
    if (Array.isArray(saved.history) && saved.history.length > 1 && saved.history.length % 2 === 0) {
      const input = readFeedbackInput({locale:next.language,country:next.country,messages:saved.history.slice(0,-1)});
      const advice = input && readFeedbackAdvice(saved.advice,input.messages);
      if (input && advice && saved.history.at(-1)?.role === 'assistant' && saved.history.at(-1)?.content === advice.reply) {
        next.history = [...input.messages,{role:'assistant',content:advice.reply}]; next.advice = advice;
      }
    }
    next.pendingSubmission = readFeedbackSubmission(saved.pendingSubmission);
    setValue(next); setConfirmed(!!next.pendingSubmission);
  },[locale]);
  const draft = useFormDraft({formKey:FEEDBACK_DRAFT_KEY,value,restore,enabled:sameAccount,busy:phase === 'submit' || phase === 'discuss'});
  const busy = phase !== 'idle', frozen = !!value.pendingSubmission;
  const options = useMemo(() => {
    const names = new Intl.DisplayNames([locale],{type:'region'});
    return [{value:'',label:t('countryNone')},...COUNTRY_CODES.map(value => ({value,label:names.of(value) || value})).sort((a,b)=>a.label.localeCompare(b.label,locale))];
  },[locale,t]);

  function change(patch: Partial<Draft>) { if (locked.current || frozen) return; draft.resume(); setValue(v=>({...v,...patch})); setError(''); }
  function errorText(code?: string) {
    if (code === 'unauthorized' || code === 'account_changed') return s('accountChanged');
    if (code === 'rate_limited') return g('errorRateLimited');
    if (code === 'invalid_request' || code === 'unsafe_input') return g(code === 'unsafe_input' ? 'errorUnsafe' : 'errorInvalid');
    if (code === 'timeout') return g('errorTimeout');
    return g('errorUnavailable');
  }
  async function post(action: string, input: unknown) {
    const controller = new AbortController(); request.current = controller;
    const timer = window.setTimeout(()=>controller.abort(),32_000);
    try {
      const response = await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',signal:controller.signal,
        body:JSON.stringify({action,input,accountId})});
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(errorText(data.error));
      return data;
    } finally { window.clearTimeout(timer); if (request.current === controller) request.current = null; }
  }
  async function discuss(event: FormEvent) {
    event.preventDefault();
    if (locked.current || frozen || !sameAccount || !draft.loaded || !value.text.trim()) return;
    const input = readFeedbackInput({locale:value.language,country:value.country,messages:[...value.history,{role:'user',content:value.text}]});
    if (!input) { setError(t('batchLimit')); return; }
    locked.current = true; setPhase('saving'); setError('');
    try {
      if (!await draft.flush()) throw new Error(s('recoveryError'));
      if (account.current !== accountId) return;
      setPhase('discuss');
      const data = await post('discuss',input);
      if (account.current !== accountId) return;
      const advice = readFeedbackAdvice(data.advice,input.messages);
      if (!advice) throw new Error(g('errorFailed'));
      setConfirmed(false);
      setValue(v=>({...v,text:'',history:[...input.messages,{role:'assistant',content:advice.reply}],advice}));
    } catch (cause) { if (account.current === accountId) setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : g('errorNetwork')); }
    finally { locked.current = false; if (account.current === accountId) setPhase('idle'); }
  }
  async function submit() {
    if (locked.current || !sameAccount || !draft.loaded || value.text.trim() || !value.advice?.items.length || !confirmed) return;
    const snapshot = value.pendingSubmission ?? readFeedbackSubmission({locale:value.language,country:value.country,messages:value.history.slice(0,-1),advice:value.advice,requestKey:crypto.randomUUID(),confirmed:true});
    if (!snapshot) { setError(g('errorInvalid')); return; }
    locked.current = true; setPhase('saving'); setError('');
    try {
      // Save the frozen exact payload and retry key before the first possible write.
      if (!value.pendingSubmission) flushSync(()=>setValue(v=>({...v,pendingSubmission:snapshot})));
      if (!await draft.flush()) throw new Error(s('recoveryError'));
      if (account.current !== accountId) return;
      setPhase('submit');
      const data = await post('submit',snapshot);
      if (account.current !== accountId) return;
      if (!FEEDBACK_UUID.test(data.conversationId ?? '')) throw new Error(s('sendError'));
      setConversation(data.conversationId);
      await draft.complete();
    } catch { if (account.current === accountId) setError(s('sendError')); }
    finally { locked.current = false; if (account.current === accountId) setPhase('idle'); }
  }

  if (!sameAccount) return <p role="status">{s(isLoaded ? 'accountChanged' : 'loading')}</p>;
  return <section className="mx-auto max-w-3xl min-w-0 space-y-5" data-feedback>
    <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 text-sm text-text-muted hover:text-gold"><ArrowLeft size={16} aria-hidden="true" />{t('back')}</Link>
    {conversation ? <div className="rounded-2xl border border-border bg-bg-secondary p-5 space-y-4">
      <p role="status">{t('sent')}</p><p className="text-sm text-text-muted">{t('screenshots')}</p>
      <Link href={`/messages?conv=${encodeURIComponent(conversation)}`} className={`${button} text-gold`}>{s('openConversation')}</Link>
      <button type="button" className={`${button} ml-2`} onClick={()=>{draft.resume();setValue({...empty(value.language),country:value.country});setConversation('');setError('');}}>{t('new')}</button>
    </div> : <>
      <p className="text-sm leading-6 text-text-muted">{t('privacy')}</p>
      <details className="text-sm text-text-muted"><summary className="min-h-11 cursor-pointer py-3">{t('preferences')}</summary><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><p className="mb-2 text-xs text-text-muted">{t('language')}</p><BrowseSelect label={t('language')} value={value.language} options={LANGUAGE_OPTIONS.map(l=>({value:l.code,label:l.label}))} disabled={busy || frozen || !!value.history.length} onChange={language=>change({language})} /></div>
        <div><p className="mb-2 text-xs text-text-muted">{t('country')}</p><BrowseSelect label={t('country')} value={value.country} options={options} disabled={busy || frozen || !!value.history.length} onChange={country=>change({country})} /></div>
      </div></details>
      <Link href="/creators" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-text-muted hover:text-gold">{t('checkSite')}</Link>
      <div className="space-y-3" aria-label={t('conversation')}>
        {!value.history.length && <p className="rounded-2xl border border-border bg-bg-secondary p-4 text-sm leading-6">{opening.language===value.language?opening.text:s('loading')}</p>}
        {value.history.map((message,i)=><article key={i} className={`min-w-0 rounded-2xl border border-border p-4 ${message.role === 'user' ? 'bg-bg-elevated' : 'bg-bg-secondary'}`}>
          <p className="mb-1 text-xs text-text-muted">{g(message.role === 'user' ? 'you' : 'assistant')}</p><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
        </article>)}
      </div>
      {openingError && <div role="alert" className="text-sm text-text-secondary">{s('sendError')}<button type="button" className={button} onClick={()=>setOpeningAttempt(n=>n+1)}>{t('refresh')}</button></div>}
      {!frozen && <form onSubmit={event=>void discuss(event)} className="space-y-3">
        <label htmlFor="feedback-input" className="text-sm">{g('inputLabel')}</label>
        <textarea id="feedback-input" rows={3} maxLength={2000} value={value.text} disabled={busy || !draft.loaded} aria-describedby="feedback-privacy-voice"
          onChange={event=>change({text:event.target.value})} className="w-full min-w-0 min-h-28 resize-y rounded-xl border border-border bg-bg-secondary p-3 text-base leading-6 focus-visible:outline-2 focus-visible:outline-gold" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GenieVoiceControls active={sameAccount && draft.loaded && !frozen} pending={busy} locale={value.language} resetKey={value.history.length}
            onText={text=>{ if(account.current===accountId) change({text:[value.text,text].filter(Boolean).join('\n')}); }}
            onUnauthorized={()=>setError(s('accountChanged'))} reply={null} noticeId="feedback-privacy-voice" />
          <button type="submit" disabled={busy || !draft.loaded || !value.text.trim()} className={`${button} bg-gold text-bg-primary`}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}{g(phase === 'discuss' ? 'sending' : 'send')}
          </button>
        </div>
        <p id="feedback-privacy-voice" className="text-xs leading-5 text-text-muted">{t('voiceNotice')}</p>
      </form>}
      <FormDraftStatus draft={draft} />
      {error && <p role="alert" className="text-sm text-crimson-light">{error}</p>}
      {frozen && <p role="status" className="text-sm text-text-muted">{t('retryNotice')}</p>}
      {!!value.advice?.items.length && <section className="space-y-3 border-t border-border pt-5" aria-label={t('plan')}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{t('plan')}</h2>
          {value.language !== 'de' && <button type="button" aria-pressed={german} className={`${button} text-text-muted`} onClick={()=>setGerman(v=>!v)}>{t(german ? 'original' : 'german')}</button>}
        </div>
        <p className="text-sm text-text-muted">{t('review')}</p>
        {value.advice.items.map((item,i)=><article key={i} className="rounded-xl border border-border bg-bg-secondary p-4 space-y-2">
          <p className="text-xs text-text-muted">{t(`priority.${item.priority}`)}</p><h3 className="break-words font-medium">{german ? item.titleDe : item.title}</h3>
          <p className="break-words text-sm text-text-secondary">{german ? item.problemDe : item.problem}</p>
          <p className="break-words text-sm">{german ? item.suggestionDe : item.suggestion}</p>
          <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-text-muted">{t('evidence')}</summary><blockquote className="break-words text-sm text-text-muted">{item.quote}</blockquote></details>
        </article>)}
        <p className="text-xs leading-5 text-text-muted">{t('screenshots')}</p>
        <label className="flex min-h-11 items-start gap-3 py-2 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-gold" checked={confirmed} disabled={busy || frozen} onChange={e=>setConfirmed(e.target.checked)} />{t('confirm')}</label>
        {value.text.trim() && <p className="text-xs text-text-muted">{t('unsent')}</p>}
        <button type="button" onClick={()=>void submit()} disabled={busy || !draft.loaded || !!value.text.trim() || !confirmed} className={`${button} text-gold`}>{t(frozen ? 'retry' : 'submit')}</button>
      </section>}
    </>}
  </section>;
}
