# Marketplace simplification — 11 November 2026

The marketplace now puts search and offers first. A compact category control opens a searchable catalogue with explicit parent/subcategory paths. Browsing, ordinary offer forms and the guided equipment flow use the same 14 departments and 116 stable subcategory IDs. No listings, original category values or database records are migrated or deleted.

## Behavior

- Direct category suggestions recognize existing aliases such as Sofa and ARRI. Multiword expansion requires matching every term. Removing a department also clears its child filter; shareable URLs retain offer mode, sorting, view and the current directory path.
- `/vehicles` uses the shared marketplace browser. Broad vehicle selection retains actual vehicles with empty or unknown categories and recognized older prop/vehicle categories. A precise subcategory does not guess unknown classifications. The retired standalone vehicle browser was removed.
- Cards retain their widths and shared design. Titles, location and price sit on a solid surface below the photo. Favorites have named 44 px controls. Visible rows drive auxiliary requests; superseded searches are aborted and stale responses ignored.
- The guided equipment flow supports rental, sale and both, preserves category-specific specifications and legacy recovery, and keeps photos optional. Failed recovery cannot overwrite a saved draft. Confirmed request keys protect creation retries. Marketplace inquiries require a message; project details are optional.
- Ratings resolve the real provider on the server, preserve valid contact/confirmed-booking eligibility, reject self ratings and private listings, and never accept a caller-supplied notification recipient. Public card projections do not expose account IDs or arbitrary metadata.

## Validation

- 321 targeted tests passed across marketplace search, category handlers, URL/reset behavior, prices, legacy vehicles, publication, private recovery, creation retries, inquiries and rating providers.
- TypeScript passed with a 6144 MB local heap. Targeted ESLint passed without errors or warnings. Design checks passed. Localization checks passed for all nine catalogs (7,222 keys; no source literals requiring review).
- Actual source components were rendered in all nine languages using an anonymous public listing snapshot. Native Safari layout review used fixed-width frames at 320, 390, 430 and 1366 CSS px. This found the photo/text overlap and native-select styling issues that were corrected; final card layout was reviewed at 430 and 1366 px. This static review does not establish live authentication, keyboard or upload behavior; component/API tests use controlled fixtures.
- The first local full build exhausted its default TypeScript heap after bundling. The independent type check passed with the larger heap. Production release uses the repository's guarded remote build so production secrets remain in Vercel.

Reference: [Kleinanzeigen category and listing flow](https://hilfe.kleinanzeigen.de/hc/de/articles/17083044980764-Wie-kann-ich-eine-Anzeige-aufgeben). CineGenius's own design and publication rules remain authoritative.
