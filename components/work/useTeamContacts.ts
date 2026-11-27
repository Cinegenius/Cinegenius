'use client';
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useUser} from '@clerk/nextjs';
import {type MessagePerson} from '@/lib/messaging-ui';

/** Existing accepted CineGenius contacts; no device address-book permission. */
export function useTeamContacts(accountId: string) {
  const {user} = useUser();
  const owner = useRef(user?.id), sequence = useRef(0);
  const [state, setState] = useState<{account: string; people: MessagePerson[]; error: boolean} | null>(null);
  useLayoutEffect(() => {owner.current = user?.id; const requests=sequence; return () => {owner.current = undefined; requests.current++;};}, [user?.id]);
  const load = useCallback(async () => {
    if (owner.current !== accountId) return;
    const request = ++sequence.current;
    try {
      const response = await fetch('/api/friendships', {cache: 'no-store', headers: {'X-Contact-Account': accountId}, signal: AbortSignal.timeout(20_000)});
      const result = await response.json();
      if (owner.current !== accountId || request !== sequence.current) return;
      if (!response.ok || !Array.isArray(result.friends)) throw new Error();
      const people: MessagePerson[] = [...new Map((result.friends as {user_id: string; display_name: string}[])
        .filter(person => typeof person.user_id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(person.user_id)
          && person.user_id !== accountId && typeof person.display_name === 'string' && person.display_name.length <= 200)
        .map(person => [person.user_id, {id: person.user_id, name: person.display_name}])).values()];
      setState({account: accountId, people, error: false});
    } catch {if (owner.current === accountId && request === sequence.current) setState({account: accountId, people: [], error: true});}
  }, [accountId]);
  useEffect(() => {let active = true; const requests=sequence; queueMicrotask(() => {if (active) void load();}); return () => {active = false; requests.current++;};}, [load]);
  return {people: state?.account === accountId ? state.people : [], error: state?.account === accountId && state.error, retry: load};
}
