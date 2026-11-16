# Shared search and filter menus

The header's ordinary site search, directory filter panels, and their selection
menus share the subtle translucent lime `browse-popup-surface` in `app/globals.css`.
The existing page dimensions, layout, results and available filter values remain.

- `BrowseSelect` renders localized choices with 44px targets, type-ahead,
  arrow/Home/End navigation, Enter selection, Escape and normal Tab order.
- `MobileFilterSelect`, `PlaceFilters`, the Projects country filter and the
  Locations radius selector reuse it. Countries, places and categories still
  derive from the eligible content; unavailable saved values remain identifiable.
- A selection opened inside a native modal passes that dialog as `FloatingPanel`'s
  portal root. This keeps it in the active top layer and outside the inner scroll
  container. Escape closes the list first and restores focus to its trigger.
- `MessagingDialog` opts into the browse surface only for `GlobalSearch`.
  Message, contact and group dialogs retain their existing presentation.
- Filter selection, reset/apply, search retry, current history and private form
  handling retain their existing behavior. No new API, permissions, storage,
  geolocation request or language keys are introduced.

Website/native coordination: carry the same restrained selection appearance and
interaction hierarchy into native controls through APP Entwicklung. Browser
checks are not evidence of an Xcode build or a physical iPhone/iPad test.
