# Native Genie voice bridge, version 1

Status: v1 contract accepted by WEB CODEX; native sources integrated, 14 November 2026.
Website UI is owned by WEB CODEX. Android build and adapter tests are separate
from the still-required Xcode build, actual audio tests and website integration.
No native voice release or device validation yet; the separate web voice UI is live.

The bundled, main-frame adapter exposes `window.CineGeniusVoice` only on the
configured CineGenius origin and when a native transport is installed. Its
presence takes precedence over browser Web Speech. A native permission denial
must not trigger another microphone implementation as a workaround.

```ts
interface CineGeniusVoice {
  readonly version: 1;
  capabilities(options: {locale: string}): Promise<{
    recognition: boolean; synthesis: boolean;
    systemServiceMayProcessAudio: boolean;
  }>;
  start(options: {locale: string}): Promise<{text: string}>;
  stop(): void;   // End audio capture and finalize the current transcription.
  cancel(): void; // Discard the pending transcription; reject with cancelled.
  speak(options: {locale: string; text: string}): Promise<void>;
  stopSpeaking(): void;
}
```

Supported app locale identifiers are `de/en/es/it/cs/hu/nl/nl-BE/sv`. Native
recognition/voice availability is checked separately; never silently switch to
another language. `start` requires a current user activation in a visible page.
An explicit microphone action may request OS permissions. There is no automatic
recording, background recording or restart after an interruption. Capture lasts
at most 30 seconds. Native `speak` uses an available local system voice, accepts
at most 6,000 characters, and stops recording before playback.

Subscribe before calling a method:

```ts
window.addEventListener('cinegenius:voice-state', event => {
  // event.detail = {requestId, state, partialText?, code?}
});
```

States are `requesting-permission`, `listening`, `processing`, `speaking`,
`idle`, and `error`. Partial text is a preview only. `start` resolves only with a
final transcript. No bridge method itself sends a Genie message, navigates,
edits a record, publishes or contacts another person. WEB owns the explicit
“finish recording and send” interaction: with an empty composer it may send
the final transcript to Genie, speak the reply and open a server-validated
read-only Crew, Marketplace or Locations search link. With an existing unsent draft it appends the text
without sending. WEB limits a transcript to 2,000 characters and must not
truncate and silently send a longer one. Content edits still require a separate
explicit confirmation and current server authorization. Cancel never sends.
Spoken replies are an explicit web UI option.

Native speech sets the rate parameter to 0.94 on Android and 0.94 times Apple's
default rate on iOS, with an utterance volume of 0.85. Device volume and pitch
remain unchanged. These settings match the agreed calm web style.
Among available voices in the same language, prefer the requested region, then
the highest system-reported quality, the matching system default, and finally a
stable identifier/name tie-breaker.
Keep the existing Apple-system/installed-local Android restrictions; do not
download voices or add a network speech provider. This is a configured speaking
style, not a claim that it has been heard or approved on an actual device.
These native defaults do not add parameters or change the v1 bridge contract.

The updated account-scoped Genie quota handoff and the Apple voice-download/device
verification boundary are recorded in [native-genie-account-and-voice.md](native-genie-account-and-voice.md).
Server-side account/model decisions never grant native archive or content rights.

For an automatic spoken search, wait until the selected result route is active
and the directory has consumed its `genie=1` launch marker before calling
`speak`; the native navigation cancellation would otherwise cut
off the answer. Closing, changing language or backgrounding also cancels the
pending spoken Genie request, so its late reply cannot navigate or start audio.
Track the originating route for each automatic spoken navigation: when a search
is repeated on its own result page, the old matching URL is not evidence that
the new launch/normalization has completed. The three supported directory
views pass their launch key to shared URL normalization even if the requested
filters are identical; normalization continues to replace only the current
entry and yields to real Back/navigation.
Native navigation checks invalidate only operations belonging to an older URL;
a queued old navigation observation must not cancel speech begun on the new URL.

Rejected promises have a stable `code`: `permission-denied`, `unavailable`,
`language-unavailable`, `no-speech`, `network`, `busy`, `cancelled`, `interrupted`,
`audio`, `invalid-request`, `gesture-required`, or `timeout`. Translate all UI
states/errors through the existing nine catalogs; retain text input on failure.

The web UI must call `cancel()` and `stopSpeaking()` when Genie closes, its
account or language changes, or it unmounts. The native shell also cancels on
navigation/backgrounding and audio interruption. The adapter invalidates pending
operations on pagehide/hidden visibility. Results are bound to the initiating
document and request; late permission/recognition callbacks are discarded.
The web close/account/language cancellation hooks are required, including during
pending permission prompts; a native document cannot infer an account change
without those hooks. The bridge never handles account identifiers or sessions.

Native recognition can use the OS speech service where on-device recognition is
unavailable. Disclose this next to the microphone in all nine UI languages;
availability is not a promise of offline recognition. No audio files, transcript
logs, credentials or plan data are stored or transmitted through this bridge.
Only the recognized text returns to the initiating CineGenius page. The existing
Genie message endpoint is used only by the normal explicit web send action.

The adapter dispatches `cinegenius:voice-ready` on installation. Check for the
API immediately as well as listening to that event, since native injection can
precede web hydration. Capability queries never prompt for permission or start
audio. Android speech synthesis initialization is asynchronous; query again
when opening Genie if the first query reports synthesis unavailable.

The native path uses OS speech recognition and returns text; it does not call
the web audio transcription endpoint. WEB's browser-only recorder may call
`POST /api/genie/transcribe` with the existing authenticated server access.
Neither native bundle contains an AI key or writes audio/transcripts to files.

Retention coordination, 14 November 2026: WEB CODEX has handed over Markus's
confirmed requirement to keep no persistent search-history archive and to clear
the Genie conversation after ten minutes without Genie activity. Current search
results/filters, unsent input and workplace drafts/plans must survive that expiry.
Apply the same rule to any future native-owned Genie/search history; do not add
a parallel transcript cache. The existing native voice adapter and iOS/Android
implementations keep only bounded active speech requests, clear them on
completion/cancellation and have no conversation-history persistence.

The shared WebView implementation from reviewed WEB commit `235b1d7` has been
integrated into the app branch, preserving route-aware speech, interruption
handling and the legacy-host microphone guard. Expiry also stops playback of
the discarded reply without cancelling a new request or deleting unsent input.
This source integration is separate from website/native publication and a real
iPhone lifecycle test.
Use a narrowly scoped conversation expiry, never a broad WebView/storage purge:
account sessions, locale choice, current browse state and private plan archives
are separate. Background suspension must not revive expired conversation state
on return. No model selection, provider or cost change is part of this rule.

Transport is internal: `cinegeniusVoice` WKScriptMessageHandler on iOS;
origin-scoped AndroidX WebMessageListener on Android. Do not use a wildcard
origin or the unrestricted Android `addJavascriptInterface` fallback. Native
code independently checks the main frame/current origin, foreground state,
operation/locale/text limits, and request/document IDs. Unsupported Android
WebView providers do not advertise this native bridge.

Real iPhone/iPad/Android microphone, permissions, audio interruptions, speech
services/languages and lifecycle checks remain required. Linux builds and mock
browser transport tests cannot establish those checks. Preserve newer Mac
workplace sources, catalog keys and saved plans during targeted Xcode merging.

Implementation references: [Apple Speech](https://developer.apple.com/documentation/speech/sfspeechrecognizer),
[Apple device speech voices](https://developer.apple.com/documentation/avfaudio/avspeechsynthesisvoice),
[Android SpeechRecognizer](https://developer.android.com/reference/android/speech/SpeechRecognizer),
[Android TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech),
[AndroidX origin-scoped web messages](https://developer.android.com/reference/androidx/webkit/WebViewCompat).
