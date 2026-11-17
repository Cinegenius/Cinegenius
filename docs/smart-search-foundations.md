# Smart search foundations — 17 November 2026

This change is prepared shared Web/App source. Smart remains restricted to the
server admin allowlist. It is not a production release or a new iPhone installation.
The approved compact Smart layout and ordinary Crew directory remain intact.

## Reproducible defects and changes

The fixed corpus is `lib/fixtures/smart-search-corpus.json`. It was frozen before
implementation; its copies, baseline output and measurements are under
`/srv/cinegenius/handoffs/20261117-smart-foundations/`.

- A manufacturer stored separately from its model was missed, while a longer
  sibling model could match. Candidate retrieval now includes public manufacturer
  and model fields, followed by whole-token verification of the requested model.
- Required LED/era/accessory properties in the shared offer specification fields
  were ignored. Search reads the same allowlisted public fields as offer details;
  it does not flatten private metadata. Explicit negative declarations override
  contradictory positive metadata. Unicode boundaries include CJK text.
- Budget, date and marketplace radius could not survive the plan contract. They
  now remain editable conditions, together with quantity, requirements/exclusions
  and visibly unsupported constraints. Missing prices, units, dates and stock stay
  unconfirmed. A general availability flag never confirms a requested Friday.
- Fully recognized catalogue requests and explicit city/budget corrections avoid
  an unnecessary model call. Relationships remain on one record: a camera person
  with their own camera is not two independent offers. Ambiguous attachment of a
  budget across multiple wishes stays with the existing conversational interpreter.
- Radius applies to all result areas. No-results searches no longer silently
  relocate: an explicit control can request labelled nearest alternatives while
  retaining the other conditions. An explicit radius is never silently extended.
- Current v2 search filters the entire permission-eligible candidate stream before
  ranking/pagination. Exact declared facts precede unconfirmed facts. Result cards
  state their public evidence; duplicate list/map entries conservatively merge
  uncertainty instead of hiding it.
- Follow-up searches preserve the previous plan. Original request text, view,
  filters and expanded rows survive real detail/Back navigation. Only small
  account-scoped controls are retained in the actual history entry; result records
  are fetched with current permissions. There are no artificial Back entries.
- Late responses are discarded. Account changes remove results, and foreground/
  visibility return rechecks access without repeating interpretation. Load failures
  retain input and offer retry. The condition editor fits the visible viewport
  above the bottom bar. Delayed initial setup cannot erase a newly typed draft.

## Shared contracts and compatibility

`POST /api/genie` retains its existing bounded `searchContext: {plan,wishIndex?}`.
Its structured provider schema is extended; request/record text remains untrusted
data. The local path does not contact a model. Provider outputs never grant rights.
`POST /api/search/unified` retains its authenticated, same-origin, rate-limited,
private/no-store entry, list/map/combined modes and per-group pagination.

Optional v2 wish fields:

```ts
budget?: {
  max: number; // 0.01–1e9
  currency: 'EUR' | 'CHF' | 'USD' | 'GBP';
  unit: 'unspecified' | 'hour' | 'day' | 'week' | 'month' | 'project' | 'purchase';
  scope: 'each' | 'total' | 'unknown';
};
period?: string;          // literal request, <=100 characters
unsupported?: string[]; // <=6 constraints, <=120 characters each
allowNearby?: boolean;  // false/absent by default; explicit expansion only
```

Legacy v1/v2 links remain readable; v1 does not gain the new fields. URLs may carry
bounded `q` alongside `plan`; no credentials or results are put into the URL.
Ship the new consumer and API together: the older deployed validator rejects the
new optional v2 fields. An independently bundled native client must wait for the
matching API release; the remote-content preview uses the published Web version.
`SearchResult.unconfirmed` can contain `price`, `period`, `quantity`, `unsupported`.
`evidence` additionally accepts `category`. Ranked cursors can include `uncertain`;
clients must forward it unchanged. Optional group `total` describes the fully
filtered local group, not a sum across duplicate wishes. The UI continues to label
its deduplicated loaded pool honestly; pagination remains available. Facet/map
filters apply to that loaded pool and the partial notice remains until complete.

This extends the shared contract without a database migration, dependency update,
new paid service, cloud scan storage or change to native RoomPlan. All new interface
copy is in the existing 17 catalogues. NativeRoomScanner keys/resources are retained.
The current remote-content iOS preview still uses the published website; a prepared
source commit alone does not put these changes on the phone.

## Boundaries

- Stored prices are EUR. Other currencies, unknown price units, negotiable/request
  prices and ambiguous multi-item totals stay unconfirmed; no conversion or guessed
  package arithmetic. Quantity is a request, not verified inventory.
- There is no date reservation or live availability service. Dates retain their
  literal wording. Certification, guarantees and similar unsupported conditions
  must remain visible; search is not an independent verification of declarations.
- Local deterministic tests cover the frozen examples and a lamp/city request in
  every supported language. More complex language goes through the existing model.
  Mocked provider-contract tests do not establish live model comprehension or
  comprehensive natural-language accuracy in all 17 languages.
  Property matching still uses bounded literal synonym groups, not universal
  translation of arbitrary member descriptions or a general grammar engine.
- Public city centres give approximate straight-line distance. Unknown/ambiguous
  places are not fabricated GPS positions. Permission projection precedes geocoding.
- Full candidate scanning remains bounded by the existing request timeout. Very
  large catalogues may need database-side indexing/RPC work; failure returns an
  error with retry, not a false empty answer. No production load test was run.
- Actual admin sign-in, paid-model quality, physical iPhone gestures, keyboard,
  lifecycle and Xcode build/install still require separate evidence. Local browser
  simulation with synthetic authentication is explicitly not device acceptance.

## Validation and handoff

The final report and exact commit/release status are recorded in
`/srv/cinegenius/handoffs/20261117-smart-foundations/receipt.json` after validation.
The browser fixture uses actual shared components, API handler and search service,
with clearly labelled synthetic records, authentication and database adapters. No
production mutation or paid model call is used. The old server implementation is
compiled beside the current one over the same fixture for the comparison.

WEB integration must include the previously reviewed `fbaef73` marketplace-search
change first; it is already in the App branch but was not published when this work
started. Transfer the shared Smart commit, not unrelated native App commits.
Publication still requires Markus's explicit request and the guarded release path.
The installed Next version's existing security advisory is separate and unresolved;
its build reminder is not evidence that this patch introduced or repaired it.
