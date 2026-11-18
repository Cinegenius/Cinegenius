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
