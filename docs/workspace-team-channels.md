# Workspace team conversations · prepared contract

**Unpublished contract prototype — do not apply the migration.** HTTP read paths,
native UI and the complete access-regression matrix are not integrated yet.
This document is a reviewable preparation, not an available team-chat feature.

Preparation only, based on shared source
`d8b72d7375aedbc581ac807011bc0969d77a765e`. No production schema, deployment,
native archive or device installation is changed by this work.

## Scope and identities

Server teams are new explicit records. Local Workspace team/folder/archive IDs
are not authorization and are not imported automatically. Free group chats keep
their existing behavior. A team channel is an existing kind=group conversation
with a separate immutable server team association. Messages, attachments, read
receipts reuse the existing infrastructure. Push is not activated; its routing
and delivery checks remain a release dependency.

Three independent states apply:
1. Team membership: invited, active or removed; owner/admin/member roles.
2. Channel eligibility: visibility, join policy and per-person permission.
3. Active conversation participation: explicit join/leave with the existing
   join-time history boundary.

Leaving a channel preserves team membership and permission to rejoin. Rejoining
starts a new history window. Removing team/channel permission closes active
participation in the same transaction. Restoring access never silently rejoins
a person or restores old history. Invitations require acceptance. Only owners
can change admin roles; admins cannot remove owners or other admins. Owners
cannot leave their own team.

## Channel rights

- Visibility: team or restricted; restricted channels require an explicit grant.
  Team admins can inspect configuration without gaining message access.
- Joining: open or invited; invited requires an explicit grant. Admins can join
  unless explicitly denied. Every participant, including an admin, must join.
- Writing: participants or admins, with an additional per-person canWrite=false
  restriction. Explicit access=denied overrides eligibility.
- Pair blocking and recipient restrictions remain effective in sending.
- Ordinary group management cannot add/promote/rename team channel members.
  Its leave action remains a channel leave, not team removal.

Administrative changes require the current team revision. Stable account-scoped
request keys prevent duplicate creation and resetting join history on retries.
Writes and permission changes share bounded transaction locks.

## Separate team history and optional ordinary inbox

Operator clarification relayed by local APP on 22 November 2026 and checked
against its visible user messages: a team needs its own conversation history,
independent of Community. The member can additionally display team conversations
in the ordinary upper inbox. Proposed preference: one private account-wide
`showTeamConversations` boolean, default false. This granularity is a proposal;
there is no UI or implicit opt-in yet.

- Team surface: only that team's currently joined, readable channels, whether or
  not the personal display preference is enabled.
- Community surface: ordinary direct/free-group/support conversations plus
  currently readable joined team channels only after that account opts in.
- Same conversation/message IDs, attachments, history boundary and per-user read
  receipts in both surfaces. No copied histories, duplicate notification rows,
  implicit joining, role changes or new rights from a display choice.
- Opening a surface or changing this preference never marks messages read.
  Actually reading the same message updates its single existing receipt.
- Ordinary header unread follows its own visible feed. Team unread follows the
  team feed independently. Do not sum these overlapping badges into another total.
- Filter scope and current access before limiting/paginating. Channels the user
  may join remain discoverable in team configuration, without message previews.
- Leaving a channel keeps team membership and the private display preference;
  removing permissions removes the channel from both views. Grant restoration
  requires an explicit new join and cannot restore old history.
- Clear account-bound client state on account/session changes. Preferences are
  confirmed only after a successful save; an absent/failed response is not opt-in.

## Prepared database contracts; HTTP integration still missing

All public RPCs require service_role; the private schema has RLS and no client
or service table access. Clerk identity must come from the authenticated HTTP
server, never a client-supplied actor. Local Workspace folder IDs convey no rights.

| RPC | Prepared purpose |
| --- | --- |
| `workspace_teams_v1(actor, action, input)` | List/detail, explicit invitations and acceptance, owner/admin/member changes, channel policies and grants, join/leave. Admin changes require the current team revision; mutations use account-scoped idempotency keys. |
| `workspace_inbox_preference_v1(actor, show?, expected?)` | Missing `show` reads the account's choice, default false/revision 0. Explicit boolean + matching revision changes only that account's preference. Stale writes return PT409; recover an uncertain acknowledgment by reading the current choice. |
| `workspace_conversation_page_v1(actor, surface, team?, after_at?, after_id?, limit?)` | `community` with no team, or `team` with an active team membership. At most 50 IDs plus current history boundaries, team associations, total, unread-by-conversation and a composite activity/ID cursor. Rights and scope precede the limit. |
| `workspace_conversation_access(actor, ids)` | Fresh access check for up to 200 conversation IDs; generic group administration remains unavailable for team channels. |
| `unread_message_counts(actor)` | Prepared replacement uses the ordinary inbox display predicate; the team page obtains its own independent unread counts. |

Example proposed application route family: authenticated `/api/workspace/teams`
for membership/channel operations and private preference GET/PATCH. This route
family **does not exist in this change**. Its final request field whitelist,
account/session guards, bounded input, error mapping, private/no-store responses
and retries must be implemented and tested before activation. Use existing
localized messaging errors where appropriate, add any new UI copy to all 17
catalogs. Team/channel names remain user content.

Required integration before applying the prototype migration:

1. Adapt `/api/conversations` to obtain IDs from the scoped page RPC before loading
   previews; never retrieve 50 mixed conversations then hide team rows afterwards.
   Recheck current rights/history boundaries before serializing list/detail/media.
2. Gate conversation detail, read receipts, draft reads and writes, staged upload
   responses, file downloads and protected images against the current team rights.
   The prototype SQL contains guards, but that is not a complete HTTP review.
3. Provide paginated admin member/grant inspection and finalized role-edit UI.
   Generic free-group endpoints cannot be used to administer team channels.
4. Team push links must open the team conversation, regardless of inbox display
   preference. Existing push only knows messages/notices destinations; routing is
   still missing. No new notices, provider activation, email or actual delivery.
5. Complete the matrix below, including genuine two-session concurrency, optional
   push migration ordering, attachment/draft replay, account switches and real
   browser/native flows. Do not apply this SQL independently of those changes.

## Fixed verification matrix

- anonymous/other-account denial, invitations, acceptance and role boundaries;
- open/restricted/invited channels, explicit denial and read-only participation;
- leave/rejoin versus team removal, history reset and no automatic rejoining;
- generic group bypasses and preserved direct/free group behavior;
- text/attachment send and idempotent replay after permission withdrawal;
- draft read/write, staged/published attachments and protected images;
- list/detail/read receipts/unread and pending/leased push dispatch;
- obsolete admin updates, bounded conflicts, atomicity and rollback;
- service-only grants/RLS, no existing-data rewrite or local archive changes.

## Verification on 22 November 2026

Seven isolated PGlite cases pass in `lib/workspace-team-channels-db.test.mjs`:
service-only boundaries/no backfill; missing/invited actor denial; independent
history and private opt-in; revision conflict/no implicit joining; denial,
leave/rejoin/team removal; filtering before pagination and deduplicated unread;
ordinary management bypass/read-only denial. Synthetic actors and message text
are clearly test data. The migration was parsed/executed only in that ephemeral
fixture, including the supported case where native push is absent.

These seven cases do not complete the matrix above. No production migration,
hosted advisors, API-handler integration tests, real login, browser UI, native
build, iPhone test or actual push delivery were performed for team channels.
No paid calls or changes to local team/folder archives. The current server and
app remain without this new online team-channel feature.
