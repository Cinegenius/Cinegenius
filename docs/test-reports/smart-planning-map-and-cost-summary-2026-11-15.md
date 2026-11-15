# Smart planning, combined map and concise cost replies

Prepared on 15 November 2026 from production source
`327a78a3c703e6077dfdcbb435b065b51cb84865`. This report describes a prepared change,
not evidence of its production publication. No database migration is needed.

## Behavior

- Genie uses the approved short cost summary, with no percentage, amount,
  calculation example or pricing link. The provider classifies the topic; the
  server supplies the actual localized platform-cost reply. Existing legal terms
  and provider rental-price answers are unchanged.
- Existing membership guards cover direct Genie, transcription and Smart results.
- Crew requests show an initial selection without a budget, date or scale
  questionnaire. Broad production requests can span several result areas. Necessary
  place clarifications and optional refinements preserve the requested place. The new
  Smart-page answer form keeps context in memory only and retains drafts across
  locale changes and recoverable failures.
- One combined map displays independently paginated results with a translated
  legend: Crew green, Locations orange, Marketplace violet, Companies blue and
  separate colors for other supported result areas. Repeated results are deduped.
  Missing positions and incomplete map batches are disclosed.
- Existing Ghost, offer visibility, location privacy and map opt-out controls
  precede serialization. Locations use only public areas or city points.
- A reproduced shared map-adapter resize/teardown race is fixed with cancellable,
  instance-scoped animation frames. Directory styling stays unchanged.

## Completed verification

- Targeted Genie/API/client/search regression run: 125 passed. Includes approved
  cost summaries in all nine locales, unchanged writing and rental-price behavior,
  guest rejection before paid work, planning dialogue and place-preserving
  short follow-ups. AI responses in these tests are mocked.
- Subsequent map/search suite: 32 passed, including privacy projection, opt-out,
  public location areas, independent map/list pagination, safe marker colors,
  deduplication and existing map behavior. This overlaps the search suite above;
  the totals are not additive. Public-map-point tests passed separately.
- Map lifecycle regression: 2 passed (remove/cancel/stale completion and normal
  coalesced updates). The original browser exception no longer reproduced.
- Real-component Chromium dialogue fixture: 21 checks across nine locales,
  with 320/393/834/1440 CSS-pixel layouts, retry, draft retention, expiry,
  account/session changes and discarded late responses.
- Real-component Chromium map fixture: 21 checks across nine locales and the
  same widths. Actual Leaflet, MapLibre and basemap rendering; mocked member
  results/authentication. Checked color distinctions, compact previews, no
  horizontal overflow, permission-withheld points, load-more/dedup, retry, 401,
  rapid navigation and resize. Mobile/desktop screenshots inspected.
- Read-only real database checks compared fully paginated lists with map results:
  Kostüm had 16 visible Crew results (15 mapped), 3 company results (2 mapped);
  Studio had 7 visible Locations (7 mapped); Boot had no currently visible
  result in this check. The respective record sets matched. No content was
  changed and no unrestricted/private records were used to populate the map.
- On the already published site, guest Genie required membership at all four
  widths, without a composer/microphone. Genie, transcription and unified-search
  endpoints returned 401 with no-store; Smart direct entry also required login.
  No browser page error occurred. This confirms existing access control only.
- ESLint on changed code, `git diff --check`, `npm run check:design`, all nine
  locale catalogs (7,923 keys, zero newly unreviewed literals), and the full
  webpack production build with TypeScript passed.

## Limits and evidence

During the approved release, the operator clarified that initial results must
come first; full planning and budgeting are future work. The follow-up prompt
now handles broad production starter searches without a budget/scale gate,
obvious spelling errors and distinct animal/vehicle wishes. A subsequent targeted
Genie/search run passed 83 tests, including the Munich dog/giraffe/tank example
and a six-wish Hamburg medieval-film selection spanning four areas. These are
mocked-provider contract tests, not live-model interpretation scores. ESLint,
catalog validation and diff checks also passed. This supersedes the initial
prompt's production/scale-question-first behavior; UI and API contracts are unchanged.

Processing/disclosure review: the existing privacy page already describes
OpenFreeMap tile requests and Genie messages/context, ten-minute local expiry,
no permanent search history and the distinction from provider logs. This change
reuses those services and purposes; it introduces no GPS access, new provider,
conversation storage or payment flow. The current
[OpenFreeMap privacy policy](https://openfreemap.org/privacy/) and
[OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
were checked on 15 November 2026. Existing disclosures remain applicable;
local expiry is not presented as deletion of provider/security logs. No new
legal terms or commission amounts were introduced in this change.

The new prompt's interpretation quality was not evaluated against a live OpenAI
response: the local environment has no usable provider key. A mocked coherent
conversation verifies routing/state contracts, not arbitrary real-world AI
understanding. No availability, booking or personal suitability is promised by
the proposed crew roles. Existing AI usage limits/model configuration are unchanged.

These are browser simulations, not native Xcode, physical iPhone/iPad or Android
checks. APP Entwicklung receives the contract, tested source and this limitation;
native adoption and production publication are separate steps.

Detailed local evidence is retained under
`/srv/cinegenius/audits/20261115-genie-concise-costs-and-access/`, including
`targeted-tests.log`, `map-tests-final.log`, `lifecycle-tests.log`,
`browser-final.log`, `map-browser.log`, `map-data-results.json`,
`live-access-results.json`, `design-final.log`, `lint-final.log`,
`build-final.log` and browser screenshots.
