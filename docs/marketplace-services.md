# Marketplace services

Operator request, 16 November 2026: members may explicitly offer services in
the marketplace, including crew catering, Steadicam operation, trades and
lighting-console operation. Preserve the shared design. Person profiles and
company memberships do not automatically create offers or move categories.

## Shared Web/native contract

- Reuse `POST /api/listings` and `PATCH /api/listings/:id`. A service remains a
  marketplace `type: prop` record; its explicit discriminator is
  `metadata.marketplace.mode: service`, mirrored by the server as
  `metadata.rental_type: dienstleistung`.
- The `dienstleistungen` department contains canonical categories
  `dienstleistungen-kamera`, `dienstleistungen-licht`, `dienstleistungen-ton`,
  `dienstleistungen-kostuem-maske`, `dienstleistungen-handwerk`,
  `dienstleistungen-produktion`, `dienstleistungen-postproduktion`,
  `dienstleistungen-catering` and `dienstleistungen-sonstige`.
- Reuse the existing `MarketplaceOffer` envelope. A service fee uses
  `rent_mode` (`fixed`, `negotiable`, `request`) and `rent_price`, with `unit`
  (`hour`, `day`, `week`, `month`, `project`). These storage names are retained
  for compatibility; visible copy says fee and billing unit, never item rental.
  `sale_price` is null, `sale_mode` remains a valid existing price mode,
  `bundle` is `single`, `fulfilment` is empty and `specs` is empty.
- Optional service fields are `included`, `excluded`, `availability` and
  `service_equipment`. Do not send condition, quantity, deposit, item brand or
  shipping fields for a service. Preserve unsaved item-specific values in the
  private draft when switching categories; serialization uses the active type.
- Provider association remains the existing authorized personal/company
  association. Reuse the current responsible-person, content-edit, publication,
  optional-image, protected-media and Ghost rules. Service publication is an
  explicit owner action, not admin verification. There is no new payment or
  booking flow; use the existing marketplace inquiry flow.
- Browse via `GET /api/listings?marketplace=1&offer=dienstleistung`. Existing
  department/subcategory/place/query/pagination parameters still apply.
  Only public visible offers contribute to results and available filters.
- Shared category lookup supports service phrases and localized category
  labels. Existing equipment aliases retain their identity (e.g. the stored
  `steadicam` category still maps to equipment). Smart marketplace search uses
  the same service categories. No new model calls or costs are introduced.
- Use all nine catalogs' `MarketplaceCatalog`, `MarketplaceNavigation` and
  `MarketplaceOffer` keys. Grid/list/map/homepage/search pricing retains the
  actual fee unit. Search-engine metadata uses `Service` / `ProvideService`.

No database migration, automatic backfill, account permission extension or
conversion of existing crew/company records is required. Native clients must
support this discriminator before offering service editing. This document is
not a production release receipt.

## Verification boundaries

Regression coverage exercises service drafts, explicit publication, editing,
invalid envelopes, guest/foreign writes, public filtering, pricing and category
matching. Database/auth dependencies are fixtures; these tests do not create
production records. Shared form fields and summaries are browser-checked in
Chromium in all nine locales at 320, 390, 768 and 1440 CSS px with existing CSS.
This is not a Safari, native-app or physical-device verification.
