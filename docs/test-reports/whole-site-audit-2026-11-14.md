# CineGenius website audit — 14 November 2026

Requested scope: public and account routes, loading, data transfer, database work,
errors and dependency security. Fixes and production publication were explicitly
authorized. No layout, color, typography, navigation or product redesign was
requested or implemented.

## Changes

- BTS cards and most-liked photos use the existing permission-checked thumbnail
  endpoint instead of downloading originals. The mosaic and photo links retain
  their original media identity. Only currently eligible public owner/image pairs
  may appear; a private or foreign canonical parent cannot become public through
  a profile mirror. Eligible protected uploads are included.
- A service-only single-image database lookup replaces building the entire
  public gallery for each thumbnail. Existing visibility, duplicate ownership,
  storage metadata, canonical media origin and access checks are retained.
- The browser receives less server-only translation copy. All nine full server
  catalogs remain intact; taxonomy JSON references and dynamic namespaces remain
  available. The build checks the generated client selection.
- The shared internationalization provider receives the server time zone as well
  as its request clock, avoiding environment-dependent formatting on hydration.
- Removed duplicate font preloading; the same font files, weights and CSS remain.
- Pointer effects batch geometry reads once per animation frame. DOM mutations
  inspect newly added card subtrees instead of rescanning the entire document.
- Corrupt, blocked or full optional search history cannot interrupt navigation.
- Sentry was updated to the fixed version with explicit previous privacy and trace
  collection settings. No replay recording or extra personal-data collection was
  enabled. A scoped development-tool override fixes the remaining vulnerable
  minimatch dependency. The installed lockfile audit reports zero vulnerabilities.
- Three existing database write functions now bind their search path. Two exact
  duplicate non-constraint indexes were removed; retained indexes preserve query
  coverage and uniqueness. No user-content rows were changed.

## Verification and evidence

Private server evidence directory:
`/srv/cinegenius/audits/20261114-whole-site`.
The final release receipt, live browser results and measured before/after bytes
are retained there. Measurements use fresh Chromium contexts on the server,
without phone-network throttling; they are not field measurements or native-app
certification.

The baseline HTTP pass covered 70 static routes including authentication and
protected redirects; 30 public pages and representative detail pages were opened
and scrolled in a real browser. They returned no browser JavaScript errors.
Before/after route screenshots and request traces are retained. Maps across Crew,
Marketplace, Locations and Companies were tested at 390 and 1366 CSS pixels:
no map assets before activation, no zoom-induced toolbar movement and no horizontal
overflow. The final browser pass also exercises all nine languages at 320 pixels,
filters, sign-in form visibility and damaged/blocked/full recent-search storage.

The full automated run executed 3,258 cases: 3,173 passed initially and 85 failed
because older test fixtures did not include the later browse/place/job metadata
contracts or still asserted superseded filter wiring. Those fixture imports and
assertions were updated to exercise the current behavior; every affected test file
was rerun successfully. Additional regressions cover the thumbnail permissions,
BTS selection, translation selection including JSON maps, timezone differences,
pointer batching, search storage failures and telemetry privacy. Original failed
logs and successful targeted reruns are retained; this is not represented as a
single all-green full-suite run.

Production-equivalence queries compared all 467 eligible image references with
zero differences. Five paired same-database measurements averaged approximately
179 ms for the old lookup and 59 ms for the selective lookup. This isolated
measurement is not an estimate of total website latency or a monetary saving.
Both migrations passed rollback preflight and production ACL checks before the
application release. Anonymous/member direct RPC execution remains denied.

## Limits and remaining maintenance

No signed-in member/admin browser session was available. Account operations,
message attachments, moderation and private recovery were covered by existing
API/database fixtures and signed-out denial checks; real users' records and
messages were not altered to manufacture end-to-end evidence. Safari, physical
phones and native app builds were not tested in this server audit.

The repository-wide lint baseline has existing React hook/compiler-rule debt in
other account/admin components. Those warnings and errors were recorded and
reviewed, rather than removing privacy/session guards solely to silence static
rules. Changed-file lint is checked separately. Narrow lint exceptions apply only
to test VM/observer adapters, never production components.

Remaining database advisor notices include repeated permissive policies,
auth-expression initialization and immutable helper search paths. They are not
reported as newly discovered exploitable flaws. Broad policy rewrites were not
made without a demonstrated behavior/performance benefit and equivalent access
coverage. Permission decisions remain uncached across requests.

## References

- [next-intl request configuration and inherited time zone](https://next-intl.dev/docs/usage/configuration)
- [Sentry v10 to v11 migration and collection defaults](https://docs.sentry.io/platforms/javascript/migration/v10-to-v11/)
- [Minimatch security advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
- [Minimatch security advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)
