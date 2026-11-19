# Public content display translations

Prepared 19 November 2026; not activated by adding these files. This is separate
from the approved/live messages repair at `9715c7d`. No production schema,
environment flag or provider setting has been changed for this draft.

## Shared behavior

The existing next-intl locale and `cg_locale` cookie remain the single language
choice for the website and installed WebView. The existing flag switcher is also
available inside the native More menu and on native sign-in/setup pages. Changing
language refreshes server components; it does not key/remount content forms or
reload the document. Native Swift/offline resources still use their existing
resource generator and must be checked by APP Entwicklung on its current sources.

`ContentTranslationProvider` only replaces its temporary request service on a
route, account, language or original-display change. It is under the existing
session boundary. There is no persisted browser content cache, no translation of
edit/recovery values and no repeated Smart planning request. The language popup
offers automatic/original display; browse views also offer original and retry.
The functional `cg_content_original` cookie stores only that preference for a
year. Original content remains usable when the service is disabled, slow, capped
or unavailable. Actual translated spans have the target `lang` and a localized
machine-translation title.

Visible cards request the same canonical reference once per page service; cards
and map previews share that response. At most three records are batched. Pending
generation is retried twice, not indefinitely; HTTP 429/503 stops automatic work
until refresh. The client checks the active language/service generation and the
exact original field before using a response. Focus/online refresh discards stale
display values and rechecks the server. Already delivered public text cannot be
recalled from a reader's device.

## API and data boundary

Same-origin `POST /api/content-translations` accepts:

```json
{"locale":"en","items":[{"kind":"listing","id":"10000000-0000-4000-8000-000000000001"}]}
```

The example UUID is synthetic. Supported locale codes are the existing 17 codes.
Batch size is 1–3 and body size is at most 4096 bytes. There is no arbitrary-text,
URL, table-name or private-file translation endpoint. Only this exact POST skips
mandatory login in Proxy; origin checks and the 120/minute IP flood limit remain.
The handler also applies its account/IP-scoped durable read limit. Guest access
does not grant access to member-only Smart results or any private source.

Response: `{locale, items}`. Each returned item contains `kind`, `id`, `locale`,
`fingerprint`, `status`, `fields` and `originals`. Status is `translated`,
`original`, `pending` or `unavailable`. Successful results contain display fields;
fallbacks do not needlessly repeat originals. Invisible/deleted/changed-during-read
sources are omitted. Client fallback is always its already authorized source,
not data recovered from an old translation. Responses are private/no-store at
application and CDN layers.

| Kind | Stable source and display fields |
| --- | --- |
| `listing` | UUID from currently published `privacy_visible_listings`; title, description, selected public access/availability/animal skills notes. Animal name is excluded. |
| `profile` | Clerk `user_…` ID; bio and tagline only when the profile is currently visible both to guests and this viewer. |
| `person` | UUID of an unclaimed public person; bio only, never name. |
| `company` | Published company UUID; description, tagline, short bio, USP. |
| `service` | Service UUID with currently published parent company; title, description, price note. |
| `news` | Approved/ended entry UUID with approved organization; title, summary, description. |
| `organization` | Approved organization UUID; description. |
| `project` | Public project UUID, never `project_drafts`; description/logline/synopsis, not work title. |
| `community` / `reply` | Public unexpired board post/reply UUID; title/body, with current parent, author Ghost and block checks. |

Server reads allowlisted canonical fields itself, checks publication/privacy/blocks
before cache lookup, rechecks source after generation/cache retrieval and again at
final batch serialization. Authorization is never reused across requests. Source
fingerprint includes the projected text and structured names. Company publication
remains independent of owner Ghost. No chat, private draft, protected profile,
Workspace, scan, file, legal document or OCR is sent to this service.

TranslatedText is connected to public details, relevant homepage/directory titles,
board posts, news and native News views, and shared Smart result/map previews.
`SearchResult.sourceId` is optional and holds the canonical source ID when the
navigation ID is different (notably organization/entry slugs for news). Names,
places, taxonomy labels, amounts, coordinates, filter plans and ordering stay in
their existing data model. This does not translate every arbitrary legacy metadata
field, review, attachment or third-party widget.

## AI and storage

`CONTENT_TRANSLATION_ENABLED=true` is required in the server environment; otherwise
UI content remains original and the endpoint returns 503 before source/provider
work. The existing authorized `OPENAI_API_KEY` is reused without exposing it to
clients. Provider model is pinned to `gpt-4.1-mini-2025-04-14`, Responses API, strict
JSON fields, `store:false`, no tools, 25-second deadline. Structured names, numeric
facts and detected contacts/URLs are masked and validated before restoration.
Unstructured public prose can still contain personal information. Prompt text is
untrusted data; successful structure/fact checks are not a guarantee of linguistic
quality. Missing key/schema/refusal/invalid output falls back to original.

Migration `20261119192145_content_translation_cache.sql` creates a private schema
with RLS and no anonymous/authenticated/service-role direct table access. Only
three security-definer RPCs are executable by service_role; they use a fixed
search path. A short NOWAIT lock serializes generation claims, not provider calls.
Lease expiry and source hashes prevent an old worker overwriting a new revision.

Initial safety caps: 500 generation reservations/day globally, 2,000,000 source
characters/day, 60 per daily pseudonymous principal and 4 concurrent calls. These
are translation-service operating limits, not changes to Genie's user quotas.
Cache hits do not consume generation reservations. Failures retain their charge
reservation and cool down for 15 minutes. Successful output is reusable for
30 days; expired cache and usage older than two days are pruned on the next valid
generation claim. There is no new scheduled agent. Database operational deletion
must include this private schema when handling an applicable erasure request.

Provider storage settings are not zero-retention guarantees. Reference checked
19 November 2026: [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
and [model documentation](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
The activation-gated privacy paragraph describes processing/cookie/retention in the
authoritative German original across all catalogs. It is an implementation
disclosure, not a legal certification or an invented provider-contract approval.

## Verification and activation

Evidence directory: `/srv/cinegenius/handoffs/20261119-content-translations`.
The reviewed feature has 86 passing core/client/provider/API/SQL cases. The
existing 132-case regression group was checked; its initial 19 NativeNews failures
were missing imports in the isolated test fixture and all 19 passed after that
fixture was updated. The final access/proxy group has 40 passing cases, and the
Smart notice/race group has 10. These groups overlap and are not an independent
combined total. The two final provider lifecycle cases repeat the corresponding
cases from the complete 12-case browser run. APP Entwicklung independently
reviewed the shared connections in six additional component-browser cases and
recorded its evidence separately in
`/srv/cinegenius/handoffs/20261119-app-translation-connection-review`.

Core/client/provider/API tests use synthetic sources and provider responses;
PGlite exercises the actual migration and role grants, not a production database
or multi-session contention stress test. Browser checks render actual components
in Chromium and Linux WebKit with mocked auth/navigation/provider and an example
editor. They cover all 17 menu languages, 320/393/820/1440px native-menu layouts,
44px targets, nested Escape, source fallback, duplicate batching, lazy loading,
language/account races and preserving text/file state. They are not real iPhone,
full protected-editor/upload or linguistic quality tests.

Before activation: reconcile the final patch with APP Entwicklung's newer native
UI, complete the final build/checks, obtain the operator's separate publication
request, apply/verify only the reviewed migration, verify the existing provider
configuration and a bounded real public-text translation, and enable the flag
through the guarded clean-main release process. Do not upload this worktree or
enable the flag under the earlier messages release approval. A real device check
and language quality review remain explicit follow-ups. To disable, remove/set
the flag false and redeploy; preserve original source and the reviewed migration.
