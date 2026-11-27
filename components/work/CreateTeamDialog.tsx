'use client';
import {useLayoutEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {useUser} from '@clerk/nextjs';
import {useTranslations} from 'next-intl';
import {ArrowLeft, Loader2, Users} from 'lucide-react';
import MessagingDialog from '@/components/messaging/MessagingDialog';
import PeoplePicker from '@/components/messaging/PeoplePicker';
import FormDraftStatus from '@/components/FormDraftStatus';
import {useFormDraft} from '@/lib/use-form-draft';
import {createTeamWithPeople, emptyTeamCreation, restoreTeamCreation, type TeamCreation, type TeamWrite, type TeamSnapshot} from '@/lib/work-team-create';
import {useTeamContacts} from './useTeamContacts';
import {nativeWorkTeamContainer,nativeWorkTeamLease} from '@/lib/native-work-team-container';

export default function CreateTeamDialog({accountId, onClose, onCreated, api}: {
  accountId: string; onClose: () => void; onCreated: (teamId: string) => void;
  api: (accountId: string, operation?: TeamWrite, team?: string) => Promise<unknown>;
}) {
  const t = useTranslations('WorkTeams'), contactsText = useTranslations('Contacts');
  const {user, isLoaded} = useUser();
  const owner = useRef(user?.id), mounted = useRef(true), pending = useRef(false);
  useLayoutEffect(() => {owner.current = user?.id; mounted.current = true; return () => {owner.current = undefined; mounted.current = false;};}, [user?.id]);
  const [value, setValue] = useState<TeamCreation>(emptyTeamCreation), [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false), [posting, setPosting] = useState(false), [error, setError] = useState('');
  const contacts = useTeamContacts(accountId);
  // Keep the old snapshot field in the recovery schema so mergeFormDraft does
  // not discard a name-only form's unacknowledged create operation on upgrade.
  const draft = useFormDraft({formKey: 'workspace-team:new', value: {...value,pendingAction:null as TeamWrite|null}, enabled: isLoaded && user?.id === accountId, busy: posting,
    restore: saved => {const restored = restoreTeamCreation(saved); setValue(restored); if (restored.name || restored.pending || restored.step) setDetails(true);}});
  const started = !!value.pending || value.step > 0;
  const current = () => mounted.current && owner.current === accountId;
  function edit(patch: Partial<TeamCreation>) {if (started || busy) return; draft.resume(); setValue(previous => ({...previous, ...patch})); setError('');}
  async function create() {
    if (pending.current || !current() || !draft.loaded || !value.name.trim()) return;
    pending.current = true; setBusy(true); setError('');
    const sourceHref=window.location.href, native=nativeWorkTeamContainer(), lease=native?nativeWorkTeamLease(native):null;
    const sameSource=()=>current()&&window.location.href===sourceHref&&document.visibilityState!=='hidden'&&(!native||nativeWorkTeamContainer()===native&&nativeWorkTeamLease(native)===lease);
    try {
      const teamId = await createTeamWithPeople(value, {
        accountId, current:sameSource, key: () => crypto.randomUUID(),
        read: async id => await api(accountId, undefined, id) as TeamSnapshot,
        write: async operation => {flushSync(() => setPosting(true)); try {return await api(accountId, operation) as {teamId?: string; channelId?: string};} finally {if (current()) flushSync(() => setPosting(false));}},
        persist: async next => {
          if (!current()) throw new Error();
          flushSync(() => {setPosting(false); setValue(next);});
          if (!await draft.flush()) throw new Error(t('recoveryError'));
        }
      });
      if (!current()) return;
      await draft.complete();
      if (current()) onCreated(teamId);
    } catch (cause) {if (current()) setError(cause instanceof Error && cause.message && !cause.message.startsWith('team_') ? cause.message : t('unavailable'));}
    finally {pending.current = false; if (current()) {setPosting(false); setBusy(false);}}
  }
  return <MessagingDialog open={user?.id === accountId} title={t(details ? 'teamDetails' : 'chooseContacts')} onClose={onClose} busy={busy} footer={<>
    {details && !started && <button type="button" onClick={() => setDetails(false)} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm"><ArrowLeft size={18}/>{t('back')}</button>}
    <button type="button" onClick={() => details ? void create() : setDetails(true)} disabled={busy || !draft.loaded || (details ? !value.name.trim() : !value.people.length)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary disabled:opacity-40">{busy && <Loader2 size={18} className="animate-spin"/>}{t(details ? started ? 'retry' : 'createTeam' : 'next')}</button>
  </>}>
    {details ? <>
      <div className="flex items-center gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold"><Users size={25}/></span><label className="min-w-0 flex-1 text-sm">{t('name')}<input autoFocus value={value.name} maxLength={80} disabled={busy || started} onChange={event => edit({name: event.target.value})} className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg-secondary px-3 text-base"/></label></div>
      <p className="text-sm text-text-muted">{t('invitationNote')}</p>
      <ul className="divide-y divide-border">{value.people.map((person, index) => <li key={person.id} className="flex min-h-11 items-center gap-3 py-2 text-sm"><span className="min-w-0 flex-1 break-words">{person.name}</span>{value.step > index + 2 && <span className="text-text-muted">{t('invited')}</span>}</li>)}</ul>
      {value.teamId && <p role="status" className="text-sm text-gold">{t('teamCreatedContinue')}</p>}
    </> : <>
      <p className="text-sm text-text-muted">{t('chooseContactsHelp')}</p>
      {contacts.error && <div role="alert" className="text-sm text-red-400"><p>{contactsText('loadError')}</p><button type="button" onClick={() => void contacts.retry()} className="min-h-11 text-gold">{t('retry')}</button></div>}
      <PeoplePicker contacts={contacts.people} selected={value.people} exclude={[accountId]} onChange={people => edit({people})} disabled={busy || !draft.loaded}/>
    </>}
    <FormDraftStatus draft={draft}/>
    {error && <p role="alert" className="break-words text-sm text-red-400">{error}</p>}
    {!busy && value.teamId && <button type="button" onClick={() => onCreated(value.teamId!)} className="min-h-11 rounded-xl border border-border px-3 text-sm">{t('openCreatedTeam')}</button>}
  </MessagingDialog>;
}
