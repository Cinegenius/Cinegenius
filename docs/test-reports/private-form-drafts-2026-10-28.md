# Private form recovery — 2026-10-28

## Scope and causes

Existing profile, onboarding and location writers had debounce windows with no shared leave protection. Company recovery covered guided creation only. Other listing types, existing offers, projects and board composers had no common recovery store. A successful response could label older state as saved while newer input was pending. Legacy cleanup omitted nested Clerk metadata keys, which does not remove them under Clerk's deep merge. Location recovery also filtered out the newer canonical `/api/media/…` image references.

## Implementation

- `contexts/FormDraftContext.tsx`: one leave guard, an accessible dialog, conditional native `beforeunload`, capture of internal links, and exact-distance rollback/replay of tracked history entries. No additional history entries. Cancel restores focus without scrolling. A confirmed saved snapshot leaves without a warning. External/full-document departures use browser behavior.
- `lib/form-draft.ts`, `lib/use-form-draft.ts`, `lib/use-form-router.ts`, `components/FormDraftStatus.tsx`: account-scoped, debounced, serialized snapshots; exact acknowledgements; image order/crops and values included; recovery of older snapshot shapes; explicit safe-save completion; errors retain inputs. View-only section changes do not trigger a dirty warning.
- `app/api/form-drafts/route.ts`, `lib/form-draft-access.ts`, migration `20261028180000_private_form_drafts.sql`: authenticated private recovery API, no-store responses, source permission checks, write limits, service-only RLS-protected storage, optimistic revisions, identical-retry recovery and completion tombstones. The supplied account is checked against the actual session, never used to grant ownership. No public content changes.
- Creation: `app/inserat/page.tsx` covers locations, marketplace/vehicles, jobs and the other existing listing variants. `app/company-setup/page.tsx`, `app/dashboard/projects/new/page.tsx`, `app/projects/neu/page.tsx` use the same private store, including incomplete inputs.
- Editing: `app/profile/page.tsx`, the listing editor in `app/dashboard/page.tsx`, and creator forms in `components/ProjectDetail.tsx`. Existing profile/company/gallery references remain unchanged. Public mutations still require their existing explicit save/publish actions.
- `components/CommunityBoard.tsx`: private composer and unfinished replies. Existing submission endpoints remain explicit.
- `components/ProfileSetupWizard.tsx`, `components/GuidedProfileWizard.tsx`, `components/GuidedListingWizard.tsx`, `lib/onboarding-save.ts`: retain existing draft storage and add leave protection; guided writers are serialized, and explicit completion waits for older draft requests.
- `components/Navbar.tsx`, `components/ContextBackLink.tsx`, `app/layout.tsx`: shared guard, including explicit sign-out and context Back. `app/api/onboarding/route.ts` explicitly nulls targeted legacy draft keys instead of omitting them.
- `app/api/upload/route.ts`, `components/ListingImageManager.tsx`, company portfolio uploads: stable retry IDs reuse immutable owner-scoped paths. The media ledger checks identical bytes. No discard path deletes existing image files.
- All new text in the existing six catalogs: German, English, Spanish, Italian, Czech and Hungarian. Existing incomplete-language disclosures remain.

## Actually verified locally

Automated tests execute the real SQL migration and writer in PGlite and the actual API handlers with controlled authentication/database adapters. They cover guest denial before reads, account isolation, account-switch mismatch, revoked source access, rate limiting, denied direct Supabase roles, idempotent retry, stale writes, tombstones, limits, temporary preview rejection, stable snapshot comparisons, image order/crops, older shapes and view-only changes. Existing admin navigation tests were adapted for the shared guard without changing their permission assertions.

Browser verification used actual React guard/form components and API handlers backed by a local PGlite database, with clearly fictitious accounts and mocked existing source APIs. No production account/content was changed and nothing was published:

- Edit text/price/image order → autosave → reload: values restored.
- Immediate internal leave while dirty: save completes before navigation.
- Injected storage failure → leave: dialog remains on the source page. Continue editing retains input; explicit discard returns exactly one actual history step. The previously saved private copy remains when the failed request cannot be committed.
- Browser Back with unsaved changes: current form retained until a decision; no extra history entry.
- Switching between two fictitious accounts: the second account has none of the first account's draft fields.
- Simulated upload busy state: not treated as saved; leave is guarded. After ending the simulated upload with unchanged fields, the final bundle returns to “Private draft saved”. This caught and corrected a stale pending-status branch. Successful acknowledgements also recheck the latest input so a newer/reverted value is not abandoned behind an older completed request.
- Real company creation component: partial company name/tagline recovered with required fields still empty, without publishing a company.
- Real profile editor: changed name recovered in the same editor section, while the underlying source response remains the original profile.
- Real location creator: selected location type, partial title and room selection recovered.
- Real project creator: incomplete description without a required title saved before leaving.
- Desktop and 390 px mobile-frame layout of the failure dialog: readable controls, wrapping, stay action preserves fields. These are simulations, not physical device tests.

Screenshots are in the task visualization directory: `privater-entwurf-warnung-desktop-2026-10-28.png` and `privater-entwurf-warnung-handy-2026-10-28.png`.

## Check results

- Full existing test suite: 727 passed, 0 failed. After the last hook/status correction, all 19 targeted recovery/onboarding tests passed again and the browser upload-status case above passed.
- TypeScript and the final production build passed after the last code change.
- ESLint on the new recovery core, including the final hook/provider revisions: 0 errors. This is not a claim that the entire repository is lint-clean; existing editor lint debt was not expanded into this task.
- Translation checks: all six catalogs have the same 1,450 keys, no empty/mismatched placeholders; existing localization debt remains 2,174 entries without additions.
- Existing design guard and `git diff --check` passed.

## Release state and limits

- Production migration and deployment have not been performed for this change. Apply/verify the migration before publishing the dependent code.
- Browser checks use local controlled auth and source APIs; a full live Clerk logout/relogin and Supabase upload matrix is still required after the release. Actual iOS/Android back gestures and physical keyboard/safe-area behavior have not been tested.
- The standard reload/tab-close prompt cannot have custom action text or promise save completion. The automated reload/dialog check did not complete, so it is not counted as passed. Reload of an already acknowledged draft was verified.
- File bytes still in a browser/upload queue cannot be reconstructed from a JSON snapshot. Busy/failed gallery uploads remain guarded; the user may explicitly abandon them. Abrupt process/network termination can leave an owner-journaled, private unbound upload. No blanket deletion/expiry of existing media was added.
- If recovery cleanup fails after a real public save, the successful save is not reported as failed. A private recovery copy can remain. Recovery never automatically applies it to public content.
- The supplementary project-join request has no private draft writer; it uses stay/discard protection. No password/authentication secrets or private-message histories are saved by this feature.
