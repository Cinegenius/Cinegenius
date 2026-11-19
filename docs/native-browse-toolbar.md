# Native browse controls

Markus's 19 November 2026 correction: Smart, Projects and News use the same
compact glass result rail directly above their results or map. Keep the count,
actual quick filters, More icon, divider and grid/list/map controls in that order.
Use `components/app/NativeBrowseToolbar.tsx`; do not recreate page-specific rows.

- This is presentation for the exact native appearance marker only. It grants no
  account permissions and leaves ordinary website controls and content intact.
- All controls keep 44px touch targets. On narrow containers the second quick
  filter moves out of the rail; its full choices remain in More. Full option names
  and keyboard interaction remain available through the existing BrowseSelect.
- Search uses the shared glass bubble and the localized “What are you looking
  for?” prompt. Domain-specific accessible names remain on directory search.
- Native More opens beside its trigger, within the visual viewport, retaining the
  existing modal, nested listbox, Escape, Back and scroll behavior. Closing it
  restores focus to More. Sorting, location preference and extra actions remain
  in that panel.
- Smart keeps its real department/category facets, area multi-selection and
  permission-projected loaded counts. The existing server access gate is unchanged.
- Projects supports real grid/list views. Its map action is visibly unavailable
  with a localized reason until project locations exist; a country is not a pin.
- News offers grid/list/map with the same approved, paginated result pool. Pins
  use only an entry's own known public city centre. Online, unknown and ambiguous
  locations remain unpinned; an organization's seat is never a replacement.
  Every loaded entry remains in the list below the map. Labels state the current
  page and loaded/mapped scope, rather than implying a map of all database rows.
- Map code loads on demand. This change adds no query, geocoding service, schema,
  feature activation or real notification delivery.
