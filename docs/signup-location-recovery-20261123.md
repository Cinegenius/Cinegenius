# Profile setup location recovery · 23 November 2026

The reported failure is at step 5 of 6: advancing to review repeatedly shows a
city/location warning. The operator believes the entered city was Berlin; the
member account and exact stored draft were not provided. The same dead end is
reproducible with an incomplete saved draft.

## Cause and correction

The previous order asked for location before the starting goal. Location
validation depends on that goal, so a new draft with no goal could pass the
location step without a city. The server subsequently validated the entire draft
on entry to review and rejected it. The interface remained at step five, where
the missing location could not be edited directly.

- Choose the goal before location; retain six named steps and stored step IDs.
- Keep older drafts and their entered values; drafts without a goal return to
  goal selection before continuing.
- Before entering review, run the same full validation used by the draft API
  (`requirePrimary: false`). Open and focus the missing field instead of sending
  an invalid review snapshot. The primary occupation remains a review action.
- Focus the composite field's actual country input when country is missing.
- Clear the previous location warning when the member edits that field.
- Preserve typed city text when the optional region changes. Clear the selected
  city ID as before, so conflicting edits cannot retain a verified map identity.

Existing server validation, explicit city selection, country/region consistency,
publication rules, private draft storage and request keys remain in force.
No passwords, email verification or sign-in challenges were changed.

## Verification

- The regression tests fail on the original code for region edits and the
  step-five city/country recovery; the patched behavior passes.
- 94 focused checks passed, including the seven profile place handler cases and
  the separate company-navigation case. A stale handler test fixture was updated
  to supply the real currency module now imported by that handler.
- TypeScript passed with a 4 GiB process heap (the default 2 GiB attempt exhausted
  memory). Focused ESLint, shared design checks (17 tests), and all 17 translation
  catalogs passed; no new interface text was introduced.
- The initial public sign-in/sign-up checks passed at 393 and 1280 CSS pixels:
  forms loaded, invalid email errors remained visible, and no page errors or
  horizontal overflow were observed. No real registration or email was sent.
- Browser fixture evidence and final inspection are recorded in the operator
  receipt directory below. Controlled account/draft responses are distinct from
  a real member's authenticated session or physical iPhone testing.
- Five browser cases passed: Berlin recovery at 320, 393 and 1280 CSS pixels,
  plus a new goal-before-location flow and missing-country recovery at 393.
  All reached review, survived reload, preserved draft values and showed no
  horizontal overflow or page errors. Actual wizard and PlaceField code ran;
  unrelated child editors and account/storage interfaces were controlled.

## Marrakesh company map correction

The public company `Production service company` existed in the directory but
had no canonical city ID and `Morocoo` in its region field. The existing map
fallback correctly refused that conflicting location.

Using the existing compare-and-journal `apply_place_mapping` operation, that one
record was assigned the catalogued Marrakesh city and Marrakesh-Safi region in
Morocco. Raw owner-entered text, publication status and other company data were
preserved. No map privacy or place validation rule was relaxed.

The live directory returned the corrected coordinates. A 393-pixel browser check
found and clicked the marker, displayed the Marrakesh company preview and
verified its company-profile link with no page error. This is a completed data
correction, independent of the unpublished setup source change.

Private operator receipts and evidence:
`/srv/cinegenius/handoffs/20261123-signup-company-map/`.

## Release boundary

The setup correction is prepared on `codex/signup-company-map-20261123`, updated
from `7c8d8a76` to the published APP 2209 base `7c2a29d0` without overlapping
changes. It has not been published. No native source or device installation was
changed by this task. Production publication requires the operator's request and the existing
clean-main/remote-identity/guarded-release checks, preserving newer APP changes.
