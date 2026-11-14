# Persistent inbox sections and one-row Crew controls

The four inbox sections now remain in the same mounted `/messages` shell. Friends
opens confirmed contacts directly, preserving search while switching sections.
Received requests are actionable in notices by connection ID; sent pending
requests are not displayed in Friends. Existing notification and dashboard links
redirect to the corresponding inbox view. Conversation navigation retains real
Back/Forward entries and existing unsent-message protection.

The Crew result row keeps count, Crew, Locations, Marketplace and grid/list/map
controls on one line. Narrow layouts use icon-only view buttons with localized
accessible names and 44px targets. A reserved compact-count width prevents shifts
during loading and digit changes. Other directories keep their existing controls.

## Verification

- Production build and localization check passed: nine catalogs, 7,810 keys, no
  new source literals. No new translation keys, API contracts or migrations.
- 255 focused tests passed: inbox navigation/loading, contacts and removal,
  notification localization/account isolation, message reads, navigation/email
  links, compact counts and provider filters.
- Browser fixtures import the actual React inbox components, React Activity,
  catalogs, styles and fonts with a synthetic account and controlled API data.
  All 36 combinations of nine locales and 320/393/768/1440px passed: stable
  section navigation, retained search, accepted contacts, request handling,
  group filtering, real Back/Forward and 44px targets. A final 393px run also
  exercised a failed read acknowledgement completing while its pane was hidden.
- Crew controls passed 45 combinations of nine locales and
  320/360/393/768/1440px, each with nine loading/count states. Order, single-row
  alignment, touch targets, no overlap/overflow and unchanged button positions
  were checked. Four final width cases passed using the final production CSS.
- Shared design checks and whitespace checks passed. Changed inbox/controls
  sources pass ESLint. The legacy dashboard retains the same 12 errors and six
  warnings as the baseline; this change adds none.

## Limits and publication

These are Chromium browser simulations, not physical-iPhone or native-app
verification. Dialog/composer fixtures do not prove native sending, uploads or
new group creation; their implementations and server contracts are unchanged.
No real messages, contact decisions, emails or production data were written.

A supplemental whole-application localhost check could not complete:
`/creators` and `/impressum` did not return within their timeouts, while static
assets responded. The public live `/creators` route returned HTTP 200 in under a
second. The incomplete local check is not reported as a pass, and no authentication
bypass was introduced for testing.

Native full-screen geometry remains with APP Entwicklung/Xcode and requires a
new iPhone build/device check. Website publication requires the operator's
specific release request and the guarded clean-main procedure. This report
alone does not establish a production deployment.

Detailed logs and screenshots are outside the repository in
`/srv/cinegenius/audits/20261114-inbox-navigation/`; the handoff receipt records
the reviewed commit and actual publication status.
