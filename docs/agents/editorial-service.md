# CineGenius Redaktion — delegated newsroom service

Release candidate, 20 November 2026. Markus explicitly authorized this release.
Actual deployment, cutover and worker activation are recorded separately in
`/srv/cinegenius/handoffs/20261120-newsroom-release/receipt.json`.
This replaces the account-bound publisher proposal; no Support session is used.

## Operator decision

News should be researched and maintained by the server, independent of a laptop
or Support login. The publishing identity is **CineGenius Redaktion**, internally
`cinegenius-editorial`, not a Clerk user, site admin, company, or new organization.
The existing Film Newsroom becomes the single publisher, CineGenius Redaktion.
The reviewed eight own newsrooms and their 17 approved articles are consolidated
atomically; real source organizations remain unchanged. Article IDs, authors,
country fields, approval and canonical media parents stay intact. Old routes
redirect only after checking the current entry and publisher approval. The
original newsroom records remain hidden and recoverable, not deleted. The
cutover refuses stale revisions, new/private entries, different owners or
unreviewed memberships. No legacy author becomes the machine identity.

An actual site administrator explicitly enables each approved organization under
Admin → Organizations → Grant editorial authority and can revoke it there.
The grant authorizes service-created contributions only. Neither the owner,
Support nor organization members inherit this authority. Creating/approving an
organization, managing memberships/accounts, and deleting records are excluded.
No grants are created by the migration; existing content is not adopted.

## Machine interface and controls

Server environment, never NEXT_PUBLIC:

- `CINEGENIUS_EDITORIAL_ENABLED=true` explicitly enables machine authentication.
- `CINEGENIUS_EDITORIAL_TOKEN_SHA256` contains the SHA-256 hex digest of a dedicated
  random token with format `cge_` plus 64 lowercase hexadecimal characters.
- The server worker holds the original token in a private mode-0600 credential
  file, preferably exposed to its service by systemd LoadCredential. No token in
  arguments, URLs, prompts, research jobs, logs, Git, browser storage or receipts.
  Enrollment is an operator step outside Git; no real token is stored in this patch.

The proxy and every endpoint verify the bearer credential independently. Exact
routes only, no Clerk/Support cookie fallback. The proxy bypasses cookie CSRF
only after validating this dedicated credential; all other routes retain the
existing authentication and origin protections. Requests have a durable shared
120/minute limit which fails closed when unavailable. Private responses are
no-store. API error tokens prefixed `editorial_` are machine protocol codes,
not end-user UI copy. Human grant controls cover all seventeen locales.

- `GET /api/editorial/organizations`: enabled, approved organizations only.
- `GET /api/editorial/entries?organizationId=...&page=...`: service-authored entries
  only, including hidden; 100 per page, explicit hasMore. Optional id readback.
- `POST /api/editorial/upload`: organizationId, file and stable upload_id. Uses
  existing magic-byte validation, private protected-media bucket and ledger.
- `POST /api/editorial/entries`: stable UUID id, organizationId,
  expectedUpdatedAt (null only on first create), submit boolean and the existing
  entry form fields. First create must be private. Retries read the same id before
  trying another write; a lost response never permits a replacement id.
- `GET /api/editorial/media?organizationId=...&entryId=...`: rechecks grant,
  service authorship, canonical image parent and uploader, then verifies bytes
  against the private media journal. Returns SHA-256 for worker readback.
- `POST /api/editorial/entries/moderation`: id, expectedUpdatedAt, action
  (`publish` or `hide`), exact saved sourceUrl, checkedAt, verified=true and reason.

Writes are service-only PostgreSQL RPCs. Publication locks the organization,
current grant and exact entry revision. The entry must be submitted, authored
and last edited by this service, with no admin restriction/review and no expired
structured end. The source and review timestamp must match (fresh within ten
minutes). Hiding allows only its own currently public approved/ended entries;
hidden records cannot be restored by this role. An atomic editorial event is
written in the same transaction. Audit failure rolls back the content change.
`publication_authority=editorial` distinguishes it from a real human admin review.
The installed canonical-place history guard is preserved, not overwritten.

## Required worker policy

The `verified` value is an attestation by the trusted worker, **not independent
verification by the API**. The worker must first open official detail sources,
check facts/dates/timezones, rights and duplicates, and visually inspect its own
image. No agent may publish merely because it generated a draft or a source
page instructed it to. Ambiguous/conflicting facts stay private. Keep English
source copy suitable for the existing translation layer; never change sources
or member content to translate UI. Clearly attribute editorial summaries to
CineGenius Redaktion and link the public original without private tracking.

Workflow: research → deduplicate across all statuses/source organizations →
private save → reload exact persisted facts and canonical place IDs → verify
saved image bytes and preview → submit → final source/revision/rights check →
explicit publish action for an enabled newsroom → verify public detail, list
and correct country/map discovery. Existing private submissions and human edits
must be reconciled, never re-created or overwritten.

Expiry: only own service imports with ledger provenance, after a fresh official
source check for extensions/cancellations. A meeting-request/early-bird deadline
is not the whole offer's expiry. Date-only deadlines/events remain until the
whole relevant local day has ended; unknown duration/timezone stays unchanged.
Use `hide` with the verified expiry/cancellation and check date. Verify hidden
status AND public absence, retain the duplicate tombstone and original media.
No age-based hiding of evergreen news; no permanent delete capability.

Editorial learning remains a private evidence-based correction log. Aggregate
reading data can inform future selection only once a real compliant feed exists;
no inferred gender, private member profiling or claimed analytics learning now.

## Activation and rollback boundary

1. Review this isolated patch and the dependent migration. Run tests/advisors on
   the actual target database before any production mutation. Local SQL tests
   use PGlite and do not establish that production has this migration.
2. Apply and verify `20261120152314_delegated_editorial_publication.sql` before
   releasing dependent handlers/admin reads. No grants or tokens in migration.
3. Use the normal guarded production release from clean main equal to origin/main.
   Markus explicitly approved this release; do not ask again.
4. Securely enroll the independent token, enable one named organization via the
   operator-approved grant (recording the real operator action) and run one private → readback → submission → publication
   canary. Verify country/map results and permission withdrawal using a genuine
   eligible test item; do not claim a synthetic test was a real news publication.
5. Only after that live canary, connect the server importer, reconcile legacy
   Support-created ledgers, and enable recurring publication/expiry. Hourly
   private research already exists separately and must not be called publishing.

Revoking a grant stops subsequent machine actions; it does not delete existing
public posts. Public entries remain subject to ordinary human moderation. The
global feature switch and token rotation use normal protected server config.
Keep secrets and previous credentials out of this document and all logs.

## Processing and disclosure review

No new external provider, member analysis, account linking, payment, newsletter
subscription or third-party photo license is introduced. Existing hosting and
private image storage are reused. Internal audit records add organization/entry
IDs, machine or granting-admin identity, source URL, check/revision timestamps and
reason. Keep them private and apply the established operational retention policy;
this patch does not claim a new arbitrary retention period or legal approval.
Before release review the actual AI transparency/operator disclosures against the
new automatic editorial publication and existing research/model configuration.
No public legal text has been silently marked reviewed by a machine.

Native app: ordinary published-news reads keep the current status/organization
contract. No machine credential or admin controls belong in the native client.
Real device checks and end-to-end production checks are still pending.

## Reviewed worker

`scripts/editorial/publisher.py` reopens a pending research candidate through a
separate source-checking agent with no product credential. It considers at most
one candidate per run. Only an explicit fresh publish decision can enter the
private-save/readback/submit/publish flow. The credential stays in a mode-0600
server file and never enters the model prompt/environment or browser.
Stable UUIDs recover interrupted writes without replacement records. All-status
source/title duplicates, human restrictions and differing saved content stop
the write. Query-based article addresses (such as FFA's meldung parameter) are
supported; private and tracking links are rejected/cleaned. Country-only news
gets no invented city or pin. Image-free stories are valid. Automatic third-party
photo selection remains disabled until individual rights and previews are checked.

The existing hourly research timer can invoke the reviewed publisher afterward
using `run-research-and-publish.sh`. It retains the shared run lock and a bounded
570-second total budget below the installed service's 600-second wall limit.
The research step itself is still private-only. A separate private enable marker
is required for publication. No second timer or website-checking agent is created.
The old system-service description may still say research-only; actual publication
status comes from the publisher receipts, not the service's historical title.

Limitations: source uncertainty, source access failures, date-only events without
a precise verified instant and unresolved material updates remain private.
Automatic expiry/hiding is not wired into this first publisher; the reviewed API
capability alone does not activate it. No deletion or media generation runs here.
Human feedback/corrections are preserved; an analytics learning feed is not yet
connected. A source-checking AI is not a guarantee that every future article is
error-free; source attribution and human revocation remain available.
