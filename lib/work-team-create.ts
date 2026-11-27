import {restoredPeople, validConversationId, validMessageRequestKey, type MessagePerson} from './messaging-ui';

export type TeamWrite = {action: string; p: Record<string, unknown>};
export type TeamCreation = {
  name: string;
  people: MessagePerson[];
  step: number;
  teamId: string | null;
  pending: TeamWrite | null;
};
export const emptyTeamCreation = (): TeamCreation => ({name: '', people: [], step: 0, teamId: null, pending: null});

export function restoreTeamCreation(saved: Record<string, unknown>): TeamCreation {
  const name = typeof saved.name === 'string' ? saved.name.slice(0, 80) : '';
  const people = restoredPeople(saved.people);
  const teamId = validConversationId(saved.teamId) ? saved.teamId : null;
  const step = Number.isInteger(saved.step) && Number(saved.step) >= 0 && Number(saved.step) <= people.length + 2 ? Number(saved.step) : 0;
  // Retain a previously submitted name-only form's exact operation key too.
  const raw = saved.pending ?? saved.pendingAction;
  let pending: TeamWrite | null = null;
  if (raw && typeof raw === 'object') {
    const op = raw as TeamWrite;
    const action = step === 0 ? 'create_team' : step === 1 ? 'create_channel' : 'invite';
    if (op.action === action && op.p && validMessageRequestKey(op.p.key)
      && (step === 0 ? op.p.name === name : op.p.teamId === teamId && Number.isSafeInteger(op.p.revision) && Number(op.p.revision) >= 1
        && (step === 1 ? op.p.name === name && op.p.visibility === 'team' : op.p.userId === people[step - 2]?.id))) {
      pending = {action, p: {...op.p}};
    }
  }
  if (step > 0 && !teamId) return {...emptyTeamCreation(), name, people};
  return {name, people, step, teamId, pending};
}

export type TeamSnapshot = {accountId: string; id: string; revision: number; role: string; members: {userId: string; status: string}[]};
type Ports = {
  accountId: string;
  current: () => boolean;
  read: (teamId: string) => Promise<TeamSnapshot>;
  write: (operation: TeamWrite) => Promise<{teamId?: string; channelId?: string}>;
  persist: (value: TeamCreation) => Promise<void>;
  key: () => string;
};

/** Each exact operation is durably saved before sending. Explicit retry replays
 * uncertain acknowledgements; a confirmed rejection gets fresh rights/revision.
 * Invitations stay invitations: acceptance and history rights remain server-owned.
 */
export async function createTeamWithPeople(initial: TeamCreation, ports: Ports): Promise<string> {
  let value = initial;
  const check = () => {if (!ports.current()) throw new Error('team_session_changed');};
  const save = async (next: TeamCreation) => {check(); await ports.persist(next); check(); value = next;};
  if (!value.name.trim() || value.name.trim().length > 80 || value.people.some(person => person.id === ports.accountId)) throw new Error('team_invalid');
  // A previous save failure may have left the pending operation only in memory.
  await save(value);
  while (value.step < value.people.length + 2) {
    check();
    if (!value.pending) {
      let operation: TeamWrite;
      if (value.step === 0) operation = {action: 'create_team', p: {name: value.name, key: ports.key()}};
      else {
        const team = await ports.read(value.teamId!); check();
        if (team.accountId !== ports.accountId || team.id !== value.teamId || team.role !== 'admin'
          || !Number.isSafeInteger(team.revision) || team.revision < 1
          || !team.members.some(member => member.userId === ports.accountId && member.status === 'active')) throw new Error('team_session_changed');
        const person = value.people[value.step - 2];
        // Someone may already have been invited by another administrator.
        if (value.step > 1 && team.members.some(member => member.userId === person.id && ['active', 'invited'].includes(member.status))) {
          await save({...value, step: value.step + 1}); continue;
        }
        operation = {action: value.step === 1 ? 'create_channel' : 'invite', p: {
          teamId: team.id, revision: team.revision, key: ports.key(),
          ...(value.step === 1 ? {name: value.name, visibility: 'team'} : {userId: person.id})
        }};
      }
      await save({...value, pending: operation});
    }
    check();
    let result: {teamId?: string; channelId?: string};
    try {result = await ports.write(value.pending!); check();}
    catch (cause) {
      check();
      const status = (cause as {status?: number})?.status;
      if (status && status >= 400 && status < 500) await save({...value, pending: null});
      throw cause;
    }
    if (!validConversationId(result.teamId) || value.step > 0 && result.teamId !== value.teamId
      || value.step === 1 && !validConversationId(result.channelId)) throw new Error('team_invalid_response');
    await save({...value, teamId: result.teamId, step: value.step + 1, pending: null});
  }
  check();
  return value.teamId!;
}
