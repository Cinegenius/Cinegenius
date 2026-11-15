# Smart: independent keywords and nearest alternatives

Requested examples: `Hamburg Polizei Kostüm`, `Berlin Location Polizei`.
Prepared on `codex/smart-nearest-results`; not yet published.

The initial keyword path recognizes the separate wishes without an AI round trip.
Whole-directory queries return eligible entries without requiring a directory word
in a title. Unknown modifiers, negation and semantically qualified compounds
remain with Genie; this does not promise perfect interpretation of arbitrary text.

Nearest alternatives are computed independently per wish and area, only after
there is no local match across that wish's requested places. Explicit country
constraints remain. Ranking uses permission-projected public city centres,
never exact/private coordinates or hidden map positions. A bounded top-page
accumulator and stable distance/ID pagination prevent arbitrary or duplicate
suggestions. All candidates must be examined before claiming nearest, under the
existing request deadline. No-match, database failure and interruption differ.

## Evidence

Audit directory: `/srv/cinegenius/audits/20261115-smart-nearest-results`.

- Targeted cases cover exact local entries appearing beyond the former 180-row
  scan; nearest entries at the end of the catalogue; stable same-distance pages;
  different wishes/areas; public-only locations and map opt-out; country-only,
  unknown and conflicting locations; forged cursors; member access; whole-area
  queries; specific objects/roles; city-first/city-last keywords and compounds.
- Read-only execution against the existing database verifies current public
  eligibility through the actual server query and privacy code, with no member
  impersonation or data mutations. The sample `Berlin Location Polizei` returns
  five public Berlin locations, plus independent public police matches in Crew,
  Marketplace and Companies. Four sample plans are checked to exhaustion in list
  and map modes, with matching IDs. Data can change after the check.
- The browser harness renders actual Smart result, map and thumbnail components
  with real shared styles/Leaflet/MapLibre and simulated account/API responses.
  It checks all nine locales, 320/393/834/1440 CSS px, distance and fallback copy,
  compact cards, horizontal overflow, cursor forwarding, local-mode replacement,
  retry and authorization loss. This is not physical iPhone/iPad/Mac or native QA.
- No usable local production AI key or authenticated live Smart browser session
  was available. The two requested simple keyword cases are deterministic and
  were exercised against real data. Complex provider interpretation is covered
  by mocked contract tests, not an actual new-model quality evaluation.

Validation passed: 173 targeted tests, plus the updated direct-Genie example test;
21 browser checks across nine locales; all four real-data sample plans agree
between list/map; nine catalogs with 7,926 keys; ESLint, design checks, production
compilation and TypeScript. The standalone type-check was initially run without
the documented 4-GB heap and exhausted its default heap; the guarded-size
production build completed successfully. An initially missing MapLibre worker
in the standalone browser fixture was supplied from installed dependencies;
this was a harness asset omission, not a website code change.

Final reviewed commit and publication status are recorded in the handoff receipt.
