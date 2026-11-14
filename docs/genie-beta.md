# Genie — configuration, voice and release notes

Genie remains visible to guests, but chat advice and inline description assistance through `POST /api/genie` require a valid signed-in account. The server uses the verified Clerk identity; a client-supplied user ID, cookie string or authorization header cannot replace that verification. It can prepare validated, read-only Crew search links. It has no private-data lookup, publishing, messaging or shared-plan mutation. OpenAI is called only after an explicit chat send, writing request or completed browser recording.

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
| `GENIE_DAILY_REQUEST_LIMIT` | Optional global daily request ceiling. Unset or blank means **200**. Accepts only decimal integers **1–1000**; invalid nonblank values make the endpoint unavailable. |

No new schema or migration is required. Genie reuses `rate_limit_buckets` and atomic `upsert_rate_limit`; existing service-only permissions must remain intact. Missing, failed or malformed limiter responses deny provider access.

### Vercel setup and activation

Select the CineGenius project identified by the checkout's ignored `.vercel/project.json` and confirm its production alias as described in `docs/design-and-release.md`. In that project's **Environment Variables** page, choose **Add Environment Variable** and fill in **Name/Key**, **Value**, **Type** and the target **Environments**. Current Vercel uses **Secret** and **Config** types; the older Sensitive setting is now represented by Secret. Secret values cannot be read back after saving. [Vercel variable types](https://vercel.com/docs/environment-variables/sensitive-environment-variables)

| Name/Key | Value to enter privately | Type | Application effect |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | The actual OpenAI project workload key, entered directly in the secret field | **Secret** | Required by the server's direct OpenAI connection. |
| `GENIE_ENABLED` | `true` for activation, or `false` to keep the endpoint disabled | **Config** | Optional; only the literal `false`, ignoring case and surrounding whitespace, disables it. Setting `0` does not disable it. |
| `GENIE_DAILY_REQUEST_LIMIT` | `200` for the default, or the chosen integer from `1` through `1000` | **Config** | Optional shared daily request ceiling, not a currency budget. |

Use **Preview** for the intended test branch, with its own test credential. Use **Production** for the live site's credential and activation values. Preview success does not establish the Production configuration. Branch-specific Preview values override general Preview values. **Development** is the separate scope for running the full app locally. [Vercel environment scopes](https://vercel.com/docs/environment-variables)

Click **Save** after adding or updating each variable. A new deployment of the relevant environment is required before changed values take effect; the existing deployment retains its configuration. Production activation and later disabling therefore both require the repository's guarded production release process. [Vercel environment updates](https://vercel.com/docs/environment-variables/managing-environment-variables)

For the deployed application, use an OpenAI project service account and its workload key with the permissions needed for the implemented `POST /v1/responses` and browser-only `POST /v1/audio/transcriptions` requests. The project must permit the configured `gpt-4.1-mini` model and have available API usage capacity. Store the key directly in Vercel; its existence, permissions and successful model access must be confirmed separately. [OpenAI API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)

The source reads only the three Genie variables listed above. It calls OpenAI directly with fixed endpoints/models for conversation and browser transcription; native recognition uses the device bridge. There is no separate public activation flag. With a nonempty key, an enabled endpoint and a valid daily limit, requests still depend on the app's existing Clerk setup and working Supabase quota service. The visible launcher alone does not confirm any of those connections.

### Local fixture versus a connected app

An isolated UI fixture or mocked test can demonstrate the launcher, forms and preview behavior without a working Next.js API route, real account service, durable quotas or OpenAI. A successful fixture build, HTTP 200 page response or simulated answer is evidence only for that fixture. Adding an API key to a fixture does not establish the real server flow.

Live local verification must run this repository's full Next.js application (`npm run dev`) with its normal development authentication/database configuration and a separate server-only development key, supplied through the approved local secret mechanism or ignored `.env.local`. Restart the local server after changing its environment. Never add a key to client fixture code or expose it with a public variable prefix. A real Vercel Preview deployment is another route to end-to-end verification, using its own environment settings and credentials.

## Limits and cost boundary

| Scope | Requests per fixed 60-second window | Requests per UTC calendar day |
| --- | ---: | ---: |
| Verified Clerk member | 10 | 60 |
| IP, shared by signed-in accounts | 20 | 100 |
| All Genie requests sharing the database | — | 200 by default; configurable as above |

All five counters are reserved for authenticated requests before the single provider call. Guests have no API allowance and their rejected requests do not reserve durable counters. Later denial, upstream failure or cancellation does not refund earlier reservations; there is no automatic retry. IP headers are trusted only on Vercel; other runtimes share a fallback bucket. IP/member identifiers are HMAC-hashed with the server key. Key rotation changes identity buckets but not the global bucket; deployments sharing a database share that ceiling.

For the exact `POST /api/genie` and `POST /api/genie/transcribe` endpoints, the proxy verifies the session before its best-effort, per-instance IP limit of 20 requests per minute. Signed-out requests return `401` even if the IP bucket is already exhausted; authentication service errors return sanitized `503` failures. Neither consumes that IP allowance. The limiter supplements, rather than replaces, the durable quotas. Rate-limit rejections for authenticated requests return `429`, `Retry-After` and private/no-store headers. Other proxy routes retain their existing ordering and protection.

The fixed model is `gpt-4.1-mini` through Responses, with **600 maximum output tokens**. Chat requests allow **nine** alternating user/assistant messages, beginning/ending with user, **2,000 characters each**, **8,000 total** (JavaScript string length). Writing requests allow exactly **one user message**, containing at most **2,000 characters** of explicit notes, and a bounded output-length limit. Writing and chat share all existing endpoint quotas, timeouts and provider configuration; writing has no separate allowance.

Streamed input is capped at **40 KiB**, with strict UTF-8 decoding. Replies allow at most **2,000 characters**, provider bodies **64 KiB**, and chat catalogue links **four**. A writing reply must also fit its destination field's shorter limit and contain no navigation links. Overlong provider replies are rejected rather than silently truncated. Provider timeout: **25 seconds**; route/browser ceiling: **35 seconds**. Cancellation propagates to the provider fetch.

These limits are not an exact currency budget. Failed/cancelled upstream work can incur usage; monetary spend is not reconciled.

## Privacy and state

For chat, OpenAI receives the coarse page area, interface locale and manually submitted conversation, including retained replies, plus static instructions/schema. For inline writing, its only user-provided source material is the explicitly entered notes; the request also supplies the interface locale, coarse description area and output-length limit through trusted instructions. No chat history is attached to a writing request.

Browser cookies, browser authorization headers, member ID and visitor IP are not forwarded. Exact URLs, form contents, uploads and private records are not collected for AI automatically. Text manually pasted into chat or the writing notes is part of the submitted text. Server-side Clerk identity authorizes access and scopes quotas; the browser uses the active account/session scope to isolate its local state.

Signed-in members retain only the latest completed exchanges in the current browser tab's `sessionStorage` for up to **24 hours**. The cache is scoped to the active account/session and restored only after that scope is known. It contains at most **four complete exchanges** and **8,000 conversation characters**, with the existing **2,000-character message limit**. Stored content is validated on restore and links remain subject to the same destination allowlist. Drafts, pending requests and error states are not stored. Storage failures leave the chat usable in component memory.

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

The model returns at most three structured crew search proposals. The server
resolves occupation IDs from the existing taxonomy and places from the existing
public place catalogue. It rejects unsupported/ambiguous resolutions instead of
inventing coordinates, people or counts. Only validated `/creators` parameters
can be emitted; model URLs and mutation paths are not accepted. A spoken request
opens the first search; additional searches remain accessible in the reply.
Typed requests retain clickable links. Navigation uses the form-leave guard.

For “near Munich”, 50 km is the default unless the request specifies 1–200 km.
The selected radius is visible and removable in the filter chips. Coordinates
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
