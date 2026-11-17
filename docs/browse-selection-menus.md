# Shared search and filter menus

The header's ordinary site search, directory filter panels, and their selection
menus share the opaque neutral `browse-popup-surface` in `app/globals.css`.
The 17 November operator update replaces the previous lime/cyan tint; selected
checkmarks and focus rings retain the existing restrained brand accent.
The existing page dimensions, layout, results and available filter values remain.

- `BrowseSelect` renders localized choices with 44px targets, type-ahead,
  arrow/Home/End navigation, Enter selection, Escape and normal Tab order.
- `MobileFilterSelect`, `PlaceFilters`, the Projects country filter and the
  Locations radius selector reuse it. Countries, places and categories still
  derive from the eligible content; unavailable saved values remain identifiable.
- A selection opened inside a native modal passes that dialog as `FloatingPanel`'s
  portal root. This keeps it in the active top layer and outside the inner scroll
  container. Escape closes the list first and restores focus to its trigger.
- Touch and wheel scrolling remain native: pointer movement never scrolls an
  option into view. Only opening or keyboard navigation reveals a choice, and
  only within the popup. Returning focus must not scroll the surrounding page
  or filter dialog. Internal option scrolling does not reposition the popup.
- Homepage country/topic triggers occupy stable grid columns, and selected text
  stays on one line without changing control height. The full selected value
  remains available to assistive technology and through the trigger title;
  expanding choices never changes the surrounding page geometry.
- `MessagingDialog` opts into the browse surface only for `GlobalSearch`.
  Message, contact and group dialogs retain their existing presentation.
- Filter sheets and header search use `useSwipeDismiss` for touch gestures.
  Pull down on the existing handle/header, or on noninteractive content already
  at the top, to move the window with the finger. Releasing beyond 72 CSS px
  dismisses it; shorter/cancelled gestures return it to its existing position.
  Upward/horizontal gestures, fields, buttons and nested selection lists remain
  native. A gesture started in scrolled content never becomes dismissal when
  it reaches the top. Reduced motion skips the release animation. Existing
  close buttons, Escape, actual Back history and selected filters remain intact.
  No gesture is enabled on message/group editing or busy dialogs.
- Filter selection, reset/apply, search retry, current history and private form
  handling retain their existing behavior. No new API, permissions, storage,
  geolocation request or language keys are introduced.

Website/native coordination: carry the same restrained selection appearance and
interaction hierarchy into native controls through APP Entwicklung. Browser
checks are not evidence of an Xcode build or a physical iPhone/iPad test.
