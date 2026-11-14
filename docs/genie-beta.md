# Genie — configuration, voice and release notes

Genie remains visible to guests, but chat advice and inline description assistance through `POST /api/genie` require a valid signed-in account. The server uses the verified Clerk identity; a client-supplied user ID, cookie string or authorization header cannot replace that verification. It can prepare validated, read-only cross-directory search links. It has no private-data lookup, publishing, messaging or shared-plan mutation. OpenAI is called only after an explicit search/chat send, writing request or completed browser recording.

After the origin check, the route rejects missing or expired sessions with `401 {"error":"unauthorized"}` before reading the body, inspecting provider configuration, reserving durable quota or calling OpenAI. The same gate covers both chat and the writing assistant. Authentication service errors fail closed with the sanitized `503 unavailable` response; they never fall back to guest access. Responses remain private and uncached, with no automatic redirect.

**Do not deploy without fresh, explicit user approval.** After approval, follow `docs/design-and-release.md`: publish source changes through the approved server Git workflow (GitHub Desktop remains the Mac workflow), then use `npm run deploy:production` from clean `main` matching `origin/main` and the correct linked project. Passing checks or configuring credentials does not authorize deployment.

## Configuration

The floating Genie assistant is available on phones, tablets and laptops. News
remains in the middle of the bottom navigation; the separate Work destination is
still coming soon. The draggable/hideable launcher is independent of voice.
Opening Genie, moving it or restoring its history makes no generation request.
The native room scanner and shared workplace remain separate app work.

Set `OPENAI_API_KEY` as a server-only **Secret** in the correct Vercel project's environment settings, scoped to the intended environments. Never use `NEXT_PUBLIC_`, commit the value, or expose it in commands, screenshots, logs or chat. Do not copy production credentials into previews merely to test the UI.

| Variable | Implemented behavior |
| --- | --- |
| `OPENAI_API_KEY` | Required. After authentication, missing/blank values return `503 unavailable` before durable quota or provider work. |
| `GENIE_ENABLED` | Optional. A trimmed, case-insensitive value of `false` disables the endpoint. Unset or other values do not disable it. This does not hide the chat or inline writing controls. |
| `GENIE_DAILY_REQUEST_LIMIT` | Retired and ignored. There is no shared daily Genie ceiling (operator decision, 14 November 2026). |
| `GENIE_UNLIMITED_USER_ID` | Optional single server-configured verified account exempt from daily Genie ceilings and using the personal quality model below. Minute guards remain. Never a client-provided claim or an automatic privilege for all admins. |

No new schema or migration is required. Genie reuses `rate_limit_buckets` and atomic `upsert_rate_limit`; existing service-only permissions must remain intact. Missing, failed or malformed limiter responses deny provider access.

### Vercel setup and activation

Select the CineGenius project identified by the checkout's ignored `.vercel/project.json` and confirm its production alias as described in `docs/design-and-release.md`. In that project's **Environment Variables** page, choose **Add Environment Variable** and fill in **Name/Key**, **Value**, **Type** and the target **Environments**. Current Vercel uses **Secret** and **Config** types; the older Sensitive setting is now represented by Secret. Secret values cannot be read back after saving. [Vercel variable types](https://vercel.com/docs/environment-variables/sensitive-environment-variables)

| Name/Key | Value to enter privately | Type | Application effect |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | The actual OpenAI project workload key, entered directly in the secret field | **Secret** | Required by the server's direct OpenAI connection. |
| `GENIE_ENABLED` | `true` for activation, or `false` to keep the endpoint disabled | **Config** | Optional; only the literal `false`, ignoring case and surrounding whitespace, disables it. Setting `0` does not disable it. |
| `GENIE_UNLIMITED_USER_ID` | The verified account ID selected by Markus, entered privately | **Secret** | Personal unlimited daily usage and quality processing; never inferred from a client name or admin role. |

Use **Preview** for the intended test branch, with its own test credential. Use **Production** for the live site's credential and activation values. Preview success does not establish the Production configuration. Branch-specific Preview values override general Preview values. **Development** is the separate scope for running the full app locally. [Vercel environment scopes](https://vercel.com/docs/environment-variables)

Click **Save** after adding or updating each variable. A new deployment of the relevant environment is required before changed values take effect; the existing deployment retains its configuration. Production activation and later disabling therefore both require the repository's guarded production release process. [Vercel environment updates](https://vercel.com/docs/environment-variables/managing-environment-variables)

For the deployed application, use an OpenAI project service account and its workload key with the permissions needed for the implemented `POST /v1/responses` and browser-only `POST /v1/audio/transcriptions` requests. The project must permit `gpt-4.1-mini`, `gpt-transcribe`, and, for the selected personal account, `gpt-6-astra` with `ultrafast` processing, and have available API usage capacity. Store the key directly in Vercel; its existence, permissions and successful model access must be confirmed separately. [OpenAI API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)

The source reads the Genie variables listed above. It calls OpenAI directly with fixed endpoints/models for conversation and browser transcription; native recognition uses the device bridge. There is no separate public activation flag. With a nonempty key, an enabled endpoint, requests still depend on the app's existing Clerk setup and working Supabase quota service. The visible launcher alone does not confirm any of those connections.

### Local fixture versus a connected app

An isolated UI fixture or mocked test can demonstrate the launcher, forms and preview behavior without a working Next.js API route, real account service, durable quotas or OpenAI. A successful fixture build, HTTP 200 page response or simulated answer is evidence only for that fixture. Adding an API key to a fixture does not establish the real server flow.

Live local verification must run this repository's full Next.js application (`npm run dev`) with its normal development authentication/database configuration and a separate server-only development key, supplied through the approved local secret mechanism or ignored `.env.local`. Restart the local server after changing its environment. Never add a key to client fixture code or expose it with a public variable prefix. A real Vercel Preview deployment is another route to end-to-end verification, using its own environment settings and credentials.

## Limits and cost boundary

| Scope | Requests per fixed 60-second window | Requests per UTC calendar day |
| --- | ---: | ---: |
| Verified Clerk member | 10 | 30 |
| IP, shared by signed-in accounts | 20 | None |
| Whole website | — | None |
| The single operator-selected unlimited account | 10/account and 20/IP | No account, IP or shared daily ceiling |

Ordinary authenticated requests reserve three counters before the single provider call. The operator-selected unlimited account reserves the two unchanged minute counters only, for both chat/writing and transcription. Markus explicitly selected **Markus Müller only**, superseding the earlier proposal for all admins and the intermediate 120-call proposal. The later operator decision removes the global and shared-IP daily ceilings for everyone and sets the ordinary personal allowance to 30. Browser voice search uses two provider calls (transcription plus interpretation), so it can consume two of these 30 calls; native device recognition does not consume a server transcription call. The identity is configured privately in the Production environment; it is not committed, accepted from the client or inferred from a display name at request time. Removing the setting restores ordinary policy and does not delete prior counters.

Guests have no API allowance and their rejected requests do not reserve durable counters. Later denial, upstream failure or cancellation does not refund earlier reservations; there is no automatic retry. IP headers are trusted only on Vercel; other runtimes share a fallback bucket. IP/member identifiers are HMAC-hashed with the server key. Key rotation changes identity buckets. No global daily bucket or shared-IP daily bucket is reserved; existing rows are not reset or deleted.

For the exact `POST /api/genie` and `POST /api/genie/transcribe` endpoints, the proxy verifies the session before its best-effort, per-instance IP limit of 20 requests per minute. Signed-out requests return `401` even if the IP bucket is already exhausted; authentication service errors return sanitized `503` failures. Neither consumes that IP allowance. The limiter supplements, rather than replaces, the durable quotas. Rate-limit rejections for authenticated requests return `429`, `Retry-After` and private/no-store headers. Other proxy routes retain their existing ordering and protection.

The ordinary model is `gpt-4.1-mini` through Responses, with **2,400 maximum output tokens for chat/search plans**, so six wishes with multiple places fit, and **600 for writing**. Chat requests allow **nine** alternating user/assistant messages, beginning/ending with user, **2,000 characters each**, **8,000 total** (JavaScript string length). Writing requests allow exactly **one user message**, containing at most **2,000 characters** of explicit notes, and a bounded output-length limit. Writing and chat share all existing endpoint quotas, timeouts and provider configuration; writing has no separate allowance.

### Personal quality configuration

Only the same verified account selected by `GENIE_UNLIMITED_USER_ID` uses **GPT-6 Astra**, **Ultrafast** request-level processing, `reasoning.effort: low`, and 8,192 maximum output tokens including reasoning. This selects OpenAI's current most capable text model and fastest offered processing tier while bounding time and output; it does not guarantee a faster internet connection or a measured latency improvement. Other accounts retain the existing model. The server derives this choice from the verified session, never request headers, names, admin status or client options. Reasoning metadata is discarded; only the validated final JSON can create read-only search links. Provider failures are not retried automatically or silently downgraded to another paid call. No new tools or private-data permissions are granted.

Official model and tier references checked 14 November 2026: [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [Ultrafast including HTTP](https://developers.openai.com/api/docs/guides/ultrafast-mode), [reasoning token limits](https://developers.openai.com/api/docs/guides/reasoning). Personal quality can incur higher provider costs. Model/tier access and actual spoken interpretation must be verified with the real production account; the locally pulled protected key is a placeholder, not evidence of an invalid production credential.

Browser recognition already uses `gpt-transcribe`. Spoken replies still use the best matching installed device voice with the existing gentler rate/volume; this change does not install voices or add a cloud speech session. Native voice choice and device downloads are coordinated with APP Entwicklung. No claim of measured native voice quality is made from browser fixtures.

Streamed input is capped at **40 KiB**, with strict UTF-8 decoding. Replies allow at most **2,000 characters**, provider bodies **64 KiB**, and chat catalogue links **four**. A writing reply must also fit its destination field's shorter limit and contain no navigation links. Overlong provider replies are rejected rather than silently truncated. Provider timeout: **25 seconds**; route/browser ceiling: **35 seconds**. Cancellation propagates to the provider fetch.

These limits are not an exact currency budget. Failed/cancelled upstream work can incur usage; monetary spend is not reconciled.

## Privacy and state

For chat, OpenAI receives the coarse page area, interface locale and manually submitted conversation, including retained replies, plus static instructions/schema. For inline writing, its only user-provided source material is the explicitly entered notes; the request also supplies the interface locale, coarse description area and output-length limit through trusted instructions. No chat history is attached to a writing request.

Browser cookies, browser authorization headers, member ID and visitor IP are not forwarded. Exact URLs, form contents, uploads and private records are not collected for AI automatically. Text manually pasted into chat or the writing notes is part of the submitted text. Server-side Clerk identity authorizes access and scopes quotas; the browser uses the active account/session scope to isolate its local state.

Signed-in members retain only the latest completed exchanges in the current browser tab's `sessionStorage` until **10 minutes without Genie interaction**. The cache is scoped to the active account/session and restored only after that scope is known. It contains at most **four complete exchanges** and **8,000 conversation characters**, with the existing **2,000-character message limit**. Stored content is validated on restore and links remain subject to the same destination allowlist. Drafts, pending requests and error states are not stored. Storage failures leave the chat usable in component memory, with the same inactivity expiry. Typing and explicit transcript/voice interaction renew the deadline; route changes, locale changes and restoration do not. Expiry clears completed exchanges only, preserving unsent input and current directory filters. The deadline is checked before sending, on resume and by a timer even while the panel is closed. Suspended browser timers are checked when execution resumes. Expired pending requests are cancelled with their input restored; late replies cannot revive history. Stored history is also swept before opening the lazy panel.

Guests cannot generate chat exchanges or writing suggestions. Changing account/session clears the local history; the trash button clears both the visible conversation and its local cache. Closing cancels pending work but retains completed exchanges. Reloading can restore a signed-in member's unexpired history in the same tab; it never resumes or sends a request automatically. There is no database or form-draft transcript storage. The existing cookie-notice preference is still read from localStorage, and the notice returning unmounts Genie.

Local clearing applies only to the browser's history. It does not delete messages already submitted to the AI service or promise deletion from provider or infrastructure logs.

`store: false` is set, without conversation/previous-response identifiers. **This does not mean zero provider retention** or eliminate applicable security/abuse logging. The feature does not intentionally log transcripts or upstream error details; its only server writes are quota counters. Credential screening is a precaution, not complete detection. Submit only necessary, nonsensitive text.

## Chat interactions

**Enter** submits a message; **Shift+Enter** inserts a new line. Input composition must finish before Enter can submit. The send button remains available, and pending requests continue to block duplicate submission. The keyboard hint and privacy notice are localized in all nine supported interface languages.

The close button, Escape and a click outside the bubble close Genie and abort pending work. A click inside the bubble leaves it open. Completed exchanges remain available when it is reopened. Opening or restoring the conversation does not call the AI service; only an explicit send or completed browser recording does.

## Optional inline writing

`GenieWritingAssistant` appears beside description fields in shared profile setup, guided profile setup and profile editing; location, object and vehicle listing creation and editing, including the guided listing flow; and guided or full company setup/editing. The shared onboarding descriptions use the appropriate profile, company, location or marketplace mode. Each helper updates only its associated field through that form's existing state callback.

Opening the helper, entering notes and closing it make no AI request. Notes start empty. **Use existing text** optionally copies the current description into the notes locally; the user must still explicitly generate a suggestion before that text is sent. Existing text longer than 2,000 characters is refused without truncation so the user can select the relevant facts. Other form fields are never collected automatically.

The generated text appears in an editable preview, in the selected interface language, with a character count. The limit is the smaller of the field limit and **2,000 characters**. The model is instructed to use only supplied facts, omit missing information and return plain description text without commentary or links. These instructions do not guarantee factual accuracy; the user must review the suggestion. **Use text** is a separate action that copies the reviewed preview into the field. The helper's buttons use `type="button"` and do not submit the parent form.

Changing or replacing the notes clears the previous preview. If the destination field changed after generation began, application is refused so those edits survive; a new suggestion is required. Closing, cancelling, disabling or unmounting the helper aborts pending work, and late responses are ignored. The helper is keyed by the active session and form context, so switching account or destination discards its local notes and preview. Writing state remains in component memory; it is not stored in chat history or browser storage.

Genie does not save, submit or publish content automatically. After the user applies a suggestion, the form's existing private draft recovery may save that edited field normally. Explicit save/submission/publication actions, permissions and moderation rules continue to belong to the form.

## Voice and read-only Crew searches (14 November 2026)

Status: feature branch, not published. Markus approved reusing the existing Genie
server credential and its additional API usage. No secret was extracted into the
local test setup. No real OpenAI call was used in the checks below.

- An explicit microphone action starts a capture of at most 30 seconds. Stop
  finishes recognition. With an empty composer the final text is sent to Genie;
  with existing unsent notes it is appended without sending. Cancel discards it.
- In a browser, MediaRecorder sends at most 1 MiB of validated webm/mp4/ogg/wav to
  the same-origin authenticated transcription route. That route sends only the
  audio file and model `gpt-transcribe` to OpenAI. It stores no audio files.
- The origin/auth checks precede quota/body/provider work. Streaming byte limits,
  container checks, provider deadlines and private/no-store headers apply. The
  microphone permissions policy allows only this origin; it does not grant
  microphone permission automatically.
- Transcription and the subsequent chat each reserve one unit from the same
  durable quotas. Native recognition reserves no web transcription unit; its
  submitted Genie message still uses the ordinary quota. No automatic retry.
- The preferred native integration is `window.CineGeniusVoice.version === 1`.
  `start({locale})` resolves with final `{text}`; `stop`, `cancel`, `speak` and
  `stopSpeaking` stay within the native contract. Native permission denial never
  falls back to browser recording. Stalled native finalization times out.
- Closing, account/language changes, backgrounding and unmounting cancel capture
  and speech and discard late results. Native audio permissions, interruption
  and actual voices still need physical-device checks through APP Entwicklung.
- Replies may be read by the device/browser speech engine. Available voices
  depend on that device; a matching local voice is preferred. Device/provider
  processing is disclosed. No separate OpenAI speech-generation request occurs.
- All nine interface locales have voice states/errors/actions and search labels.
  Replies use a supported language inferred from the message, with interface
  locale as fallback. Speech does not overwrite the chosen interface language
  or translate member-written content.

The current extension returns at most six structured search wishes in one
validated `/search?plan=…` link; see the shared contract below. A spoken request
opens that common result page, preserving every wish. Typed requests retain the
clickable common link. Legacy validated directory links still restore safely.
Model URLs and mutation paths are not accepted. Navigation uses the form-leave guard.

For “near Munich”, 50 km is the default unless the request specifies 1–200 km.
The selected radius is visible in the result-group label and editable search. Coordinates
are approximate public city positions; entries without a resolvable location
are excluded from radius matches. Genie does not inspect actual profiles or
prove compatibility/availability. Existing user/account privacy and public
profile rules continue to control the directory results.

Shared schedule changes such as moving lunch are **not implemented**. The current
repository has no shared day-plan store, membership model, revision mechanism or
subscription. Public project credits are not edit permissions. The permissions
choice is still awaiting Markus. APP Entwicklung owns the native workplace;
see the coordinated handoff for the proposed preview → confirmation → authorized
atomic update → member refresh flow. Do not claim a voice request saved a plan.

The added privacy section is the original German disclosure in every legal
catalogue, with `lang="de"`; it is not an approved translated legal document.
The short operational notices are translated in all nine languages. Existing
unpublished legal/operator amendments remain on their separate branch.

References checked on 14 November 2026:
[OpenAI transcription](https://developers.openai.com/api/docs/guides/speech-to-text),
[OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).
`store: false` on conversation requests does not promise zero provider retention.

## Unified search contract — website and native consumers (14 November 2026)

Status: implemented and checked on the feature branch; not yet published. The
live OpenAI credential already exists. Pulling Vercel Production variables yields
a protected placeholder, not a usable local credential. The attempted local
provider call failed for that reason; it is not evidence of a broken live key.
Do not rotate it or claim that the model's interpretation passed a real test.

- Homepage's existing search uses a `Smart` tab, with localized search-page titles
  in all nine languages. The tabs stay on one row, with horizontal overflow only
  when their labels cannot fit at the minimum touch size. Explicit submit navigates
  to `/search?smart=1&q=…`; that page calls
  the existing authenticated `POST /api/genie` once, then replaces the temporary
  URL with the validated plan URL. No AI request on typing, account/locale change,
  pagination or Back/Forward to resolved results. Retry is explicit.
- `lib/unified-search.ts` is the shared version-1 contract. A plan contains 1–6
  `searches`, each `{area,query,department,places}`. `area` is `crew`,
  `marketplace`, `locations`, `companies`, `jobs`, `animals`, `projects`, `news`,
  `organizations`, or `all`. Department IDs are stable catalogue IDs, only for
  Crew. Empty query is accepted only with a valid department.
- Each `places` array contains 0–4 OR alternatives. A place is
  `{city,country,continent,radiusKm}`. Country is ISO 3166-1 alpha-2 or empty;
  continent is UN M49 `002/019/142/150/009/010` or empty. Continent cannot accompany
  city/country. Within a place constraints are AND; never cross-product separate
  wishes. Crew radius is 1–200 km around an unambiguously resolved public city;
  zero means exact city. No places means unrestricted public geography.
- `/api/genie` retains `{reply,language,links}` for native callers. One link now
  encodes all wishes. Accept only `searchPlanFromHref`-validated relative links;
  no additional native provider key or parallel parser is needed.
- Read results with same-origin `POST /api/search/unified`, JSON `{plan}` or
  `{plan,cursor:{wishIndex,area,offset}}`. Response is `{groups}`; each group has
  `{area,wishIndex,label,results,nextOffset}`. Result cards keep the existing
  `{id,title,subtitle,type,price,priceLabel?,image,available}` contract. `nextOffset`
  is null on exhaustion, otherwise continue only on explicit request. Twelve
  visible results per group, up to 180 candidate rows per request; an empty page
  with a continuation does not mean there are no matches. At most four DB reads
  run concurrently. Cursor limits/area/indices are checked again on the server.
- Read-only results permit guests; AI interpretation still requires sign-in.
  Current viewer permissions precede profile projection and geographic matching.
  Ghost profiles, hidden location/activity and personal-offer visibility remain
  enforced. Companies/public projects/approved news and organizations reuse their
  public eligibility rules. Project geography uses its recorded primary place or
  production country, not guessed cities from its shooting-location list.
- Occupation matches prefer exact catalogue roles and their aliases: Model does
  not expand to model makers, generic drivers exclude dolly grips, and camera
  people include DoP. Gender/plural search aliases never rewrite saved occupations.
  Marketplace matching includes public vehicle subtype, make/model and offer
  brand/model. Specific objects do not admit every sibling in a broad category.
  Company categories and declared services participate in company searches.
- Origin checks, the existing flood guard and additional read quotas remain.
  Errors are sanitized (`invalid_request`, `search_unresolved`, `rate_limited`,
  `unavailable`); all results are private/no-store. Missing authorization data
  fails closed. No new database schema, search-history write or provider-data
  lookup. `unifiedSearchAccess` is the single future entitlement boundary;
  currently included, with no paywall or payment activation.
- Existing account-scoped 10-minute Genie retention is unchanged. Search plans
  are ordinary URL filters and can appear in browser-managed history; the app
  does not store a recent-search list. Unsent input survives language changes and
  errors. Account changes hide old results immediately and abort old requests.

See `test-reports/genie-unified-search-2026-11-14.md` for evidence and remaining
real-model/native-device checks. Shared workplace mutations are still unavailable.

## Verification status

The targeted API/client/voice/auth/proxy regression suite and all nine language
catalogues are checked locally. A Chromium fixture renders the actual Genie
components and records from a synthetic microphone, with mocked provider and
speech responses. It covers empty-input send/search, draft preservation,
cancellation, close/account changes, 44px targets and widths 320/834/1440, plus a
short viewport. These are browser simulations, not physical device verification.
The actual Next.js Crew directory is checked separately; the completed evidence
and exact totals are recorded in the handoff, not inferred from fixture success.

Reproduction:

```sh
node --experimental-strip-types --import ./scripts/register-test-aliases.mjs --test lib/genie*.test.mjs lib/private-api-auth.test.mjs lib/proxy-localization.test.mjs
npm run check:i18n
npm run check:design
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

No paid/live OpenAI speech recognition, actual speech quality, iPhone/iPad/
Android audio, live transcription credential permissions or voice production
release has been verified by these local checks.

### Search history retirement (14 November 2026)

Global search no longer reads or writes a recent-search list. On mount and search opening it removes only the legacy `cg_recent_searches` key, tolerating blocked storage. Existing suggestion chips, result navigation, retry and keyboard operation remain. Current directory filters, actual browser history, language/cookie choices and private form recovery are not deleted. The search API does not persist queries; Genie provider `store: false` and content-free usage counters are unchanged. This local retention policy does not promise removal of provider/security logs or browser-managed URL history.
