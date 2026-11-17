# Broad marketplace objects in Smart search

Prepared 17 November 2026. This document is not a production release receipt.

## Cause and correction

Smart's object aliases still included older leaf values. A broad `Lampe` wish
did not include current `licht-quellen` records, whose titles can contain only
a model name. `Kostüm` expanded clothing but omitted `kostuem-accessoires`.
The public directory data confirmed the affected Munich offers: Godox KNOWLED
F800R, Aputure Nova P600C and the Lodenfrey Bavarian hat. The ARRI M18 already
matched the literal word `Lampe` in its public description.

`marketplaceConceptGroups` now supplies complete broad-object phrases to both
ordinary marketplace category matching and `wishMarketplaceCategories`:

- Lamp/light-source phrases expand `licht-quellen` and its declared legacy
  children. The generic legacy department `Lichttechnik` is deliberately not
  included wholesale: it may contain controllers and other non-light objects.
  Literal title/description matching remains available for those legacy offers.
- Costume phrases expand clothing and accessories, including the saved hat
  category. Specific hats, named manufacturers/models, boats and motorcycles
  do not inherit unrelated siblings from their parent category.
- Aliases cover basic object phrases in all seventeen enabled languages.
  Exact multiword phrases and single-character Chinese terms are supported;
  unknown modifiers are not silently dropped. Ordinary directory partial-label
  matching and decorative/practical legacy lamp candidates remain intact.

No stored categories, member content, photos, prices, privacy permissions,
geographic constraints, API contracts or admin-only access rules change.
Lists, map candidates and later pages use the same server category resolution.
No new AI request, database migration or browser history storage is introduced.

## Verification and native handoff

Regression checks cover actual public offer-category examples, separate Munich
and Berlin scopes, all seventeen basic-language cases, specific-object negatives,
ordinary category selection, emitted list/map query filters, existing access,
privacy, pagination and nearest-result behavior. Public ordinary search was read
to confirm the source records. Mocked server queries are not a live authenticated
Smart/AI test; a real signed-in Smart request and native device test remain open.

APP Entwicklung can use the unchanged shared search API after release. No native
interface update or app compatibility claim is implied by these server tests.

## Form follow-up under discussion

Markus proposes better category-driven forms and minimal required fields to
improve sorting. The existing marketplace editor already switches technical
fields by category, but most details are collapsed/optional. Shared publication
checks already require title, place, category and a contactable provider.

Proposed order: area → category/subcategory → essential relevant facts → optional
details → preview/explicit publication. Put category-relevant facts in the main
flow instead of a generic optional appendix. Keep private drafts recoverable,
photos optional, private contact/address data private, and existing offers
unchanged until their owners edit/confirm them. Missing information must never
be invented or trigger a silent removal of existing offers. No new form fields
or publication requirements have been implemented in this correction.
