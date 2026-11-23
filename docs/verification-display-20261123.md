# Verification display and admin confirmation — 23 November 2026

Prepared locally; production publication is still pending. Priority: repair the
verification display before finishing the selected avatar refill styles.

## Read-only production findings

All 241 profiles and all five verification requests were included in the aggregate
check. 138 profiles have an explicit true verification flag. All five requests are
approved and their profiles are verified; no approved request lacks its badge flag,
no pending request already has a verified profile, and no request lacks a profile.
The sampled member reported by Markus is already verified, with an approved request
and successful audit records. No live records were modified or notifications sent.

The public browser reproduction confirms the casting profile uses the actor layout:
it has a badge in the photo area, but no badge beside the name. The foreground photo
has z-index 10 and could cover the old badge. Generic crew profiles had no header
badge at all. Model profiles had a status chip but no check beside the name. Smart
and ordinary search did not project the verification flag; crew map previews omitted
it. These are display/data-projection faults, not evidence of a failed approval.

## Change

One accessible badge uses only `verified === true`. All three profile layouts show
it beside the name, including profiles without photos. Actor photo status is above
the foreground photo; photo labels use the translated common status. Crew grids,
lists, map previews/cluster titles and Smart/search cards receive the same explicit
flag after the existing permission projection. Old approved requests never confer
verification after revocation. No new database queries or permission changes.

Admin approval/rejection errors stay visible inside the open decision form; the
entered reason is retained. Pending and invalid submissions cannot submit twice.
Atomic approval/revocation/rejection RPCs and revision checks remain unchanged.

## Validation and limits

- 68 existing API, database and unified-search checks passed, including atomic
  approval, rollback on notification failure, revocation and concurrent decisions.
- Nine UI regression cases plus the focused search projection case passed. The
  initial new search assertion referenced the fixture incorrectly; corrected and
  rerun successfully (recorded separately from the original failing run).
- 18 browser cases: actual profile components and CSS, synthetic data, three layouts,
  current/revoked status, widths 320/393/1440. No horizontal overflow, visible badges.
- Three browser admin flows using the actual form and save function with synthetic
  responses: failed approval retains input and visible error, retry succeeds,
  rejection requires a reason, controls at least 44px.
- All 17 translation catalogs, full TypeScript and shared design checks passed.
- Targeted lint reports existing admin/crew hook and render warnings/errors;
  baseline comparison retained separately. No unrelated render refactor included.

Evidence: `/srv/cinegenius/handoffs/20261123-verification-check/`. Browser components
use stubbed peripheral services. No real member was approved/rejected as a test;
no native-device or signed-in production admin interaction is claimed.
