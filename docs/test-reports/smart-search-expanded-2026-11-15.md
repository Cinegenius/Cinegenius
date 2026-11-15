# Comprehensive Smart search implementation — 15 November 2026

Scope: implement the supplied ten-point Smart brief on top of the unpublished
production/catering precursor `516465a`. Preserve the established design and
coordinate native use through APP Entwicklung. No migration, publication of
user content, model/key change or additional paid service.

## Implemented

- Versioned quantities, mandatory declarations/exclusions and explicit
  recommendation status. Old v1 links remain supported.
- Natural-language rules plus deterministic composition of completely known
  catalogue clauses, multi-place wishes and correctly attached independent
  places; unknown/ambiguous wording goes to the model without dropping words.
- Per-department head groups and independent local/nearest fallback, rather
  than one available department hiding another department's missing matches.
- Evidence-ranked local pages with stable cursors; nearby pages retain
  qualifications and explicit geographic limits.
- Short-lived result refinements and current-plan context in Genie text/voice;
  targeted edits cannot quietly change unrelated wishes.
- Collapsed editors for query, area, quantity and places, with retained drafts
  and explicit error/retry behavior. Lazy initialization avoids loading all
  hidden country editors/dialogues at once.
- Combined initial list/map read, current privacy before all matching, and
  detailed declaration fields loaded only when actually needed.

Contract and limits: [Smart search v2](../smart-search-v2.md).

## Executed evidence

`/srv/cinegenius/audits/20261115-smart-search-expanded/` contains:

- `regression-final.log`: 180 passing tests spanning plans, interpretation,
  matching, API boundaries, group/rank pagination, combined results, privacy,
  direct Genie, voice, retention and map helpers.
- `final-boundaries.log`: 85 passing affected tests after the final public-fact
  projection and current-city/radius validation corrections. Includes v2
  requirements, quantity/plan bounds and selected-wish context across locales.
- `browser-results.json`, `browser-final.log`, `results-*.png`: 21 passing
  browser checks over nine locales; widths 320, 393, 834 and 1440 CSS px;
  actual components/styles/vector map with mocked member/API boundaries.
  Tests include one combined initial request, compact cards, no horizontal
  overflow, editing one wish, preserving others/quantity, contextual follow-up,
  failed-request draft retention, shortened viewport and clearing on sign-out.
- `live-data-results.json`: read-only permission-checked public data, five
  queries, complete list/map identity parity. Berlin police-film planning
  independently finds nearby camera, sound and costume leads where no local
  qualifying lead is present; unsupported requests remain empty. Generic and
  vegan catering and Model/Berlin plus Fahrer/Hamburg retain their conditions.
  Logged counts are a point-in-time test, not promised availability.
- `build-verified.log`, `lint-final.log`, `design-final.log`: final production
  build, lint and shared-design check. The build also checks all nine catalogs
  with 7,952 keys and no new hard-coded UI copy.

The initial browser rerun encountered a stopped private fixture server, not a
site regression. The final runner owns its loopback server lifecycle, awaits
real vector tiles and shuts down only that fixture afterward.

## Follow-up from APP review

APP review reproduced unsaved wish edits being lost on a language change.
The validated editable plan now stays independent of the result-language
refresh, while account and plan changes continue to reset the editor.
The isolated shared fix was adopted from APP commit `104d940`.
The Web browser regression in `locale-account-results.json` confirms that
quantity and follow-up drafts survive a German-to-English switch, that an
account switch clears those drafts, and that a delayed response from the
previous account cannot restore its results. Authentication and API responses
are simulated in this browser check; this is not a physical device test.

## Boundaries and release

Browser viewport tests are not physical iPhone/iPad or native Xcode/Android
tests. Provider responses are simulated in automated tests. The local
environment still has no usable unmasked OpenAI credential/member production
session, so unrestricted free-form live-model interpretation remains an
explicit verification gap. No claim that arbitrary language always works.

Six wishes, four places each, the existing rate guards, finite catalogue scans
and deadlines remain. Hard requirements use public declarations only; missing
evidence cannot establish suitability. A list-visible person who withholds
map/location data need not have a map marker. No schema or environment changes
are needed. Existing basic functions and future entitlement boundaries remain.

This report records implementation/testing, not a live release. Exact commit,
APP handoff and publication status are recorded outside Git in the final
handoff receipt. At implementation start the confirmed live source was
`ad3cb39`, not the newly supplied comprehensive prompt.
