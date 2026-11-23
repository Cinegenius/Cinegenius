# Exclusive profile artwork: balanced replenishment and deletion

Operator corrections, 18 November 2026: keep the assortment filled, expose feminine,
masculine and neutral avatar styles, remove the rejected styles, replace an assigned
motif with a new one, explain one-time assignment and never recycle a deleted motif.
The user approved faceless silhouettes and quiet nature covers. Gifting/swapping is
an idea for a later owner-to-owner transfer; it is not implemented or advertised.

## Assortment and refill

The picker shows twelve new avatars (four of each optional presentation) and twelve
covers. All choices are available to every member. These are artwork labels, never
profile gender, pronouns, ranking or access controls. The durable target is six free
avatars per presentation and eighteen free covers, including reserves. Read/open
and temporary leases do not trigger paid generation. A newly confirmed claim queues
one replacement in the same transaction; failure of the refill quota cannot undo
the profile save. Post-response work can start it immediately. The five-minute worker
catches up after an interruption, with only one generation running globally.

Source limits: 64 newly enqueued attempts per UTC day, 36 outstanding jobs, one image
per job, fixed prompts/models, bounded bytes/time. A provider or quality failure can
still temporarily reduce stock: never relabel a shared image as exclusive or falsely
claim a failed refill succeeded. Accepted artwork metadata/fingerprints remain for
ownership and duplicate protection rather than stopping forever at 512 past jobs.
The existing 20,000-reference safety bound still requires operational monitoring.

The prior manual-only gate could not keep an automatic assortment stocked. Its new
replacement is an independent fixed-brief vision check of the actual normalized
image using `gpt-5.4-mini`, with storage readback and all existing duplicate checks.
It must accept the composition/style before release. This is an automated quality
check, not human review or proof of worldwide visual uniqueness. No member images,
identity, messages or arbitrary user instructions go to either art model. The
separate database `automatic_review_enabled` gate starts off and is enabled only
following the controlled generation checks. Old workers cannot claim new jobs.

## Permanent deletion

Ordinary picture changes retain prior ownership. Explicitly removing a saved v2
motif asks for confirmation. The irreversible action occurs only with profile Save;
Back/cancel does not delete it. Recovered empty drafts require fresh confirmation.
The existing atomic save accepts optional `deletions: [{kind, mediaKey}]` alongside
`choices`, with the same parent request key and expected profile timestamp.
Use `profile_art_save_profile_v2` when deletions are present; old clients keep their
existing save contract. A tombstone blocks future reads, reservations and restoring
the image through older writers. Ownership and fingerprints remain to prevent
reassignment or regrowth of the same picture. Previously downloaded copies cannot
be recalled. This is not a member-upload deletion policy.

All failure paths preserve unsaved fields and the last confirmed profile. The
17 catalog locales carry the choices, one-time-assignment hint and deletion copy.
Native work must adopt presentation metadata, the confirmation and optional deletion
contract; a web release alone does not establish native support.

## Rollout / verification

Apply balanced-stock and permanent-deletion migrations after the four existing
profile-art migrations. Keep the reader enabled while replacing rejected inventory;
retire rejected style entries from new choices without rewriting an owner's profile.
Apply the follow-up stock-budget migration as well: the bounded allowance includes the existing seed journal and rejected quality attempts. Only actually approved new assets count as available. Verify category counts, real
provider/style checks, current private Storage hashes, reservations/save/deletion
transactions, account switching, interrupted input, 320px/WebKit/desktop and all
locales before production publication. The ongoing website-check agent stays off.

Operational results and exact live status belong in the separate release receipt;
this document describes the implementation, not a claim of publication.

## Mixed abstract assortment — 18 November 2026 (prepared, not deployed)

The latest operator decision supersedes the faceless-only style brief: use the six
approved mixed abstract directions, with restrained invented facial features allowed
and some stronger color. Keep every presentation freely selectable. The default
exclusive catalogue already interleaves presentations under All; the legacy grid
now does the same. Preserve the 12-choice window and balanced reserve rather than
loading the entire historical catalogue. The next reviewed package contains 21
avatars and 21 covers, including one previously unselected original pair.
See `design/profile-art/2026-11-18-mixed/README.md` for duplicate checks and release
requirements. Personal likeness requests never go into the automatic stock pipeline.

## Selected human and animal directions — 23 November 2026 (prepared)

The operator selected human #11,13,15,17,19,31,32,36,37,38,39 and animal
#1,2,4,5,6,8,10,11,14,15,17,19,20 from the three numbered collages. Human #11 was
mentioned twice and is one direction, not extra weighting. The reference manifest
with source hashes is `design/profile-art-selected-20261123/selection.json`;
`lib/profile-art-selected-styles.ts` is the actual prompt catalogue.

New avatar jobs select among the approved directions using their random UUID, with
independent stable hashes for style, palette, pose and hair. Producer and reviewer
therefore see the same brief, even after a lease change. Feminine and masculine
reserves draw from the eleven human styles. Neutral draws from all 24: neutral human
portraits plus the thirteen animals. All remain freely selectable by everyone.
Visible grain, misregistered ink, rough cuts, watercolor edges, pastel and doodles
are intentional; the independent reviewer no longer rejects these or requested
animals under the old human-only/smooth-illustration criteria.

The SQL protocol ID `cg-silhouette-nature-v1` remains for wire compatibility only.
New avatar review JSON additionally records `styleVersion: cg-selected-avatars-20261123`
and the exact `styleId`; a real SQL fixture verifies they persist through release.
No migration or expanded access is needed. Existing covers use their unchanged
nature prompts. Ownership, deletion tombstones, duplicate checks, stock levels,
models, one-attempt behavior, generation quality and all source limits are retained.
Existing artwork is not replaced; the new mix enters as real refills are needed.

41 focused producer/reviewer/refill/stock checks passed without paid model calls.
Generated-image fidelity for this new mix has not yet been tested against the live
provider. These prompt changes are prepared, not proof of publication or new stock.

## Günstigere Reserve · 23. November 2026

Batch-Umstellung für Avatare und Cover beauftragt und als Quellkandidat gebaut.
Gleiches Modell/Qualität; 50 % Rabatt auf Erzeugung, separate Bildprüfung bleibt.
Bis zu 24 Stunden im Hintergrund, kein Warten beim Profilabschluss. Gezielte
Migration vor Veröffentlichung erforderlich; noch nicht live.
[Ablauf, Kostenbasis und Grenzen](profile-art-batch.md).
