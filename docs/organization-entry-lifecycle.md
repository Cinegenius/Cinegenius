# Organisation entries: reversible withdrawal and trash

Implementation: 17 November 2026. Not deployed. No hosted migration applied and no real entry withdrawn during this implementation.

## Behaviour

Organization owners and active organization owner/admin members can withdraw entries they manage. This does not require global administrator access. Profiles/organizations, other content types and original media are outside this feature.

- **Hide**: saved entry becomes `hidden` and disappears from the public lists, organization detail, news detail and protected public media reads. Unsaved editorial input is flushed only to the existing private recovery service, never written to public content by this action.
- **Delete**: saved entry becomes `deleted`, disappears publicly and moves into the dashboard's separate trash list. It remains in the same organization workspace for restore and source/URL deduplication. No physical row, image or history deletion, purge endpoint or automatic expiry is provided.
- **Restore**: same ID, URL slug, image and content; a previously approved/submitted entry returns to private `draft`. It requires normal submission and explicit administrator approval again. Previous administrator `hidden`, `rejected` or `changes_requested` restrictions survive trash/restore. Administrators cannot approve a record while it is in trash; a manager must restore it first.
- Every action requires a 5–1000 character reason and a current exact revision. A separate inline confirmation names the saved entry and describes the consequence. New controls wrap, have at least 44 CSS px touch targets and do not add navigation history entries or modal/keyboard overlays.

## Web/native API contract

`PATCH /api/organizations/entries/lifecycle`

```json
{
  "id": "entry UUID",
  "expectedUpdatedAt": "exact updated_at returned by workspace",
  "action": "hide | delete | restore",
  "reason": "plain reason, 5–1000 characters"
}
```

Authentication is the existing server session; the client cannot supply an actor. Success returns `{entry: <current private workspace row>}` with `Cache-Control: private, no-store`. The row includes its new exact `updated_at`, `moderation_status` and private `owner_withdrawn_from` restore marker. Workspace includes trash deliberately. Do not remove trash from importer deduplication.

401: signed out. 403: no current management grant (including unknown record). 400: invalid arguments. 409: stale revision or inapplicable transition. 503: unavailable storage/function/history. Network failure is not success; reload the workspace before another decision. No unchecked retries or fallback writes. Existing content PATCH refuses deleted records. Administrator PATCH refuses deleted records and clears any owner-restore marker on an explicit moderation decision.

`deleted` is a new **private management** moderation status. Native clients must support it, label it as trash, suppress publication/edit actions and provide the explicit restore flow. Do not treat an unknown status as approved. Public projections continue to allow only `approved`/`ended` with an approved parent. `ended` alone is still publicly visible.

## Persistence and authorization

Apply `20261117081457_organization_entry_lifecycle.sql` before deploying dependent routes. It adds the private restoration marker and `deleted` constraint/history values. The service-only, security-invoker function locks the entry and management grant in the same transaction as the update. Permission revocation, exact revision comparison, transition validation, content status and existing actor/reason/revision history are checked or written atomically. Audit/history failure rolls back the withdrawal.

`anon`/`authenticated` receive no database/table/function grants. No new service key, access role or exposed storage bucket. New function calls use the existing `lib/db.ts` wrapper. No new provider or paid resource. Protected image access still checks current parent visibility before serving; legacy public originals/downloaded copies are not recalled.

Rollback: revert dependent web code before considering schema rollback. Never remove the `deleted` constraint value or restore-marker column while trash rows still exist. Keep records private; do not bulk-restore or republish as rollback.

## Privacy/legal delta

The privacy notice adds a clearly marked authoritative German original describing withdrawal, stored actor/reason/revision, restoration and retention limits. Existing legal drafts and operator declarations are preserved. Trash is content recovery, not GDPR erasure. An actual erasure request must follow the existing support process and purpose/retention review; no invented legal retention period or unconditional indefinite-retention entitlement is claimed. Do not put unnecessary personal details in action reasons.

Reviewed against [European Commission: individual rights](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en), especially transparency and erasure; [Supabase triggers](https://supabase.com/docs/guides/database/postgres/triggers) and [mutation filters/returned rows](https://supabase.com/docs/reference/javascript/update). EUR-Lex text fetch was blocked by its browser challenge; no new legal interpretation or legal approval is claimed.

## Verification and release limits

- 38 real PostgreSQL/PGlite and route-handler tests pass: private/save/review flow, management grants/revocation, invalid/stale requests, atomic history failure, trash publication/edit rejection, public detail/list/media withdrawal, restoration and preserved administrator restrictions, existing organization collaboration/discovery.
- Standalone TypeScript and changed-file ESLint pass.
- `npm run check:i18n`: 17 complete catalogs, 8109 keys, no new source literals. All changed interface/status strings are translated; the legal addition remains explicitly German original, not a reviewed legal translation.
- `NODE_OPTIONS=--max-old-space-size=4096 npm run build` passes. This isolated checkout had no hosted Supabase credentials: build-time public recommendations/projects logged unavailable fallbacks. The real database flow was verified in PGlite, not against production.
- Separate Safari fixture, actual lifecycle component, synthetic entry and simulated transport, 320 CSS px content width: hide -> hidden, delete -> deleted, restore -> draft visibly verified. Reason validation, disabled/loading state and wrapping checked. Fixture is not a signed-in end-to-end test of the dashboard or hosted API. No native app/device, software-keyboard/safe-area, all-locale visual or full keyboard/screen-reader validation claimed. Those remain release/device checks.
- No real user content changed; AG DOK's cancelled Pitching workshop is still pending the existing authorized hide action after the feature is actually released (or via an authorized administrator).

Before production: review/merge, apply and verify migration through the normal controlled process, refresh clean main exactly at origin/main, verify project identity, then use only `npm run deploy:production` with the required separate operator release approval. Smoke-test the real support dashboard and guest detail/media denial after an explicitly authorized withdrawal. Do not selfapprove new news.
