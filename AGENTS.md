## App-Folgearbeit: Smart-Karten und News – 19. November 2026

Der am 20. November 2026 abgeglichene veröffentlichte Hauptstand ist `a9afd8e4057b932d1e15cd116deb123c25064586`. Die veröffentlichten spanischen Crew-Begriffe und Firmen-/Catering-/Inserat-Übersetzungen sowie seine Headerkorrektur ohne zusätzliche dunkle Hintergrundfläche, stärkere Smart-Auswahlmarkierung, Header-/Genie-Korrekturen, Shots / News / Smart / Projekte / Work sowie Gast-Sprachwahl und Übersetzungs-/Länderänderungen erhalten. Die frühere Freigabe ist damit verbraucht; die hier vorbereitete App-Folgearbeit hat keine neue Veröffentlichungsfreigabe. Der erhaltene alte Mobile-Zweig und ältere Swift-Dateien dürfen diesen Hauptstand nicht ersetzen.

Für die genaue native App-Darstellung gilt jetzt: News ist der gemeinsame Einstieg zu Beiträge und Organisationen; Organisationen erscheinen nicht nochmals im App-Menü. Bestehende URLs bleiben erreichbar. Land/Stadt, Suche, Liste/Karte und Seitenauswahl dürfen keine berechtigten Organisationen wegen fehlender Kartenpunkte verlieren. Beide Ortsfilter müssen auch bei 320px erreichbar bleiben.

Native Crew-Entdeckung wird ohne Eigentümerbonus über den vollständigen berechtigten Bestand gemischt; die Reihenfolge bleibt bei Nachladen, Zurück, Sprachwechsel und Wiederholen stabil. Berechtigungen werden weiter bei jeder Anfrage geprüft. Crew-Portraits vollständig darstellen, Originaldateien und gespeicherte Bildausschnitte erhalten. Die gemeinsame App-Farbzuordnung ist Crew Koralle, Marktplatz Gold, Smart Lime, Locations Blau, Firmen Violett. Sie gilt auch für Kategoriekennzeichen und Kartenpunkte. Die gewöhnliche Website bleibt gestalterisch unverändert. Diese begrenzte Folgearbeit nimmt die pausierte grundlegende Smart-/Spracharbeit nicht wieder auf.

Quellen, Schnittstellen, Prüfungen und offene Geräte-/Leistungsgrenzen: `docs/app-news-crew-followup-20261119.md`.

Die über WEB CODEX abgestimmte Länderarbeit priorisiert Mexiko und berücksichtigt Italien, Spanien, Frankreich, Schweiz, Österreich, Ungarn sowie die bereits vorhandenen Länder. Sprache, Suchland und Angebotswährung sind getrennte Angaben; vorhandene Preise werden nicht automatisch umgerechnet. Gemeinsame Länder-/Währungskorrekturen mit WEB abstimmen und geprüfte Änderungen in die App übernehmen. Der reine App-Bestandscheck unter `docs/app-regionalization-20261120.md` ist keine vollständige Länderfreigabe und keine native Geräteprüfung.

App-Kartenzähler, Betreiberauftrag vom 20. November: Verzeichnis-Gesamtzahlen bleiben unabhängig vom Kartenausschnitt. Die später am 20. November gemeldete Crew-Zähldifferenz ersetzt die alte Provider-Ausnahme: Auch Crew-, Locations- und Marktplatz-Anbieter zählen die aktuelle gefilterte Auswahl. Kartenpunkte im Ausschnitt, außerhalb und ohne Position unterscheiden, Einträge ohne Punkt über die Liste erreichbar halten. Native Smart-Zahlen sind ausdrücklich geladene, deduplizierte Treffer und kein vollständiger Serverbestand. Organisationen unterscheiden Gesamttotal, geladene Seite und Kartenpunkte. Neue App-Ergänzungen im separaten Zweig `codex/app-map-counts-20261120` erhalten; die UI-Folgearbeit bei `4327fc68f17dada987f5c2366f192a5bd26b254d` bleibt für den lokalen App-Abgleich eingefroren. Siehe `docs/app-map-count-audit-20261120.md` und die App-Übersicht `docs/CINEGENIUS-APP-UEBERSICHT.md`, sobald dessen geprüfte WEB-Übergabe übernommen ist. Die getrennte Website-Übersicht bleibt `docs/CINEGENIUS-WEBSITE-UEBERSICHT.md`; keine weitere konkurrierende Übersicht anlegen.

## App server release authorized by Markus – 19 November 2026

Markus explicitly authorized publishing the reviewed app server code after the native iPhone installation. The latest requested app has Shots / News / Smart / Projekte / Work in its bottom bar; Smart combines Crew, marketplace, Locations and companies with multi-selection and grid/list/map-list views. These changes apply only to the exact installed native appearance marker; preserve the current ordinary website, live main authentication/privacy fixes and existing Smart server access gate. Port reviewed app deltas onto current main, never upload the divergent mobile branch wholesale. Existing native Workspace is reactivated; local archives are not an online collaboration service.

Push and Shots publication activation remain separately disabled. This release does not apply migrations, enable provider credentials or feature flags, send real messages, or claim genuine Push delivery. Preserve safe unavailable states without a new schema. Stage/commit/merge/push through GitHub Desktop, then release only clean main equal to origin/main using the existing guarded production script. User publication authorization is already given; do not ask again for this same release.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## CineGenius shared design and production releases

- Treat `/companies` as the visual reference for the public directory areas: Locations, Marktplatz, Crew, Firmen, Jobs, News, Projects and Filmtiere (operator update, 13 November 2026).
- Use `components/PageHeader.tsx` for public page headers and the shared `site-container`, `browse-toolbar`, and `browse-card` styles in `app/globals.css` for browse layouts. Keep page-specific content and controls, but do not recreate the old `CategoryHero` treatment or introduce one-off accent colors, backdrops, or widths.
- On `/projects`, `/locations`, `/props`, `/creators`, `/companies`, and `/jobs`, use `components/MobileBrowseControls.tsx` for search, sort, category selection, result summary, active filter chips, and the mobile filter panel. Keep all domain-specific filters available inside that panel. Use the same shared controls at desktop widths as well as below 1280 CSS px; do not restore horizontally scrolling category pills or a separate mobile filter toolbar.
- Keep mobile controls full width, allow long labels to shrink or wrap, use at least 44×44 CSS px touch targets, and keep the filter panel scrollable above the software keyboard and safe-area inset. Reuse the central styles in `app/globals.css` instead of page-specific mobile copies.
- Leave safe-area-aware room for the fixed bottom navigation on mobile and tablets, so the final card or empty-state action can scroll fully above it.
- Treat readiness for the future CineGenius app as a mandatory part of every feature change and review. Check usable reflow from 320 CSS px, 44×44 CSS px touch targets, software-keyboard visibility, safe-area insets, accessible dialogs, and real browser/app Back navigation without artificial history entries. Verify loading, error, retry and interrupted-input behavior where relevant. Preserve the shared CineGenius design; distinguish actual device/app checks from browser simulations and do not claim native-app compatibility without testing it.
- Keep the homepage's `/hero-bg.jpg` backdrop spanning the full page through the shared `PageBackdrop`; maintain readable text with a restrained dark overlay instead of limiting the image to the hero.
- Extend the shared cinematic DirectoryPage backdrop behind headers, browse controls and results. Do not add a solid black band behind the toolbar or result section. Keep individual controls, cards and filter dialogs on readable opaque surfaces. The profile-location preference is a quiet 44px icon action beside sorting, with a localized accessible name and state, not a separate country-preference sentence.
- Keep the desktop header navigation in this order: Crew, Locations, Marktplatz, Jobs, Firmen, News, Mehr. Nachrichten is a compact, labelled header action with the current account's unread badge; Mein Bereich and personal actions belong in the account menu instead of repeating in the primary links. The desktop Mehr menu contains the remaining public destinations, without repeating the six direct directories; the compact layout keeps every directory reachable. The single mobile `components/BottomNav.tsx` contains five public links in this order: Crew, Marktplatz, News, Locations, Firmen. Nachrichten is a direct compact-header action at every signed-in width, with the account-scoped unread count. Mobile Mein Bereich and all personal actions remain reachable through the shared account dropdown opened by the compact portrait button, without a separate bottom account shortcut. Keep personal links and sign-out out of the right-hand public menu: the portrait menu is the single account entry point (operator decision, 13 November 2026). There is no Mehr button in the bottom bar; it remains available from the header. Use separate `PRIMARY_NAV_ITEMS` and `MOBILE_NAV_ITEMS` from the shared `lib/site-navigation.ts` model for their respective surfaces; changing desktop links must not reorder the bottom bar. Personal navigation must not render a second mobile bar. Keep the five bottom touch areas adjacent and at least 44×44 CSS px from 320 CSS px. Preserve direct sign-in/sign-up, all account destinations, Projects, organizations, and help/support access. Future AI tools can be added only when an actual destination exists. Keep compact search and utility controls from squeezing or shifting the public links across routes, session states and supported languages.
- Keep `/sign-in` and `/sign-up` one click from the homepage: both links stay visible in the desktop header and outside the collapsed menu on phones. They must open the corresponding usable form directly. Render the email/password fields in the initial server HTML, prefetch both routes from visible auth links, and do not add welcome screens or account-type gates. Registration asks only for Clerk-required account fields; profile details belong after account creation. Preserve reciprocal sign-in/sign-up links and redirect an existing session directly to its destination.
- Keep email-and-password sign-in as the default. Send an email sign-in code only when the visitor explicitly chooses that alternative; do not treat Clerk's `needs_first_factor` status as MFA or silently switch a password attempt to email-code sign-in. Continue to honor real `needs_second_factor` and `needs_client_trust` challenges.
- New accounts continue from verified registration directly into the shared, resumable `/profile-setup` assistant: name, exactly one starting goal with a clear note that more areas can be added later, only the relevant steps for the chosen goal, then a review with per-section edit actions. Show all implemented departments and occupations from the central catalogue; do not introduce a shortened onboarding-only list. Crew and talent share one person location, while each chosen offer type gets its own relevant details. Search-only users skip provider creation and go to search. Store progress in private Clerk metadata, migrate older unfinished drafts without data loss, and keep completed existing users out of setup. Offers remain private while being drafted. Marketplace objects and vehicles (prop/vehicle) can be explicitly published by an authorized offer editor with an established personal profile, without admin approval; reuse the authenticated profile name instead of requiring it again. Record this as owner_published, never as an invented admin approval. Explicit admin restrictions remain effective. Locations, animal portfolios and other offer types retain submission and explicit admin review. For those types, material content/image/provider edits invalidate approval and require review again; never equate saved, complete or active with publicly approved. A company profile becomes public as soon as its owner saves it; clearly disclose this before the save action in onboarding and editing. Keep stable request keys so retries cannot duplicate setup records. Existing private company records remain private until their owner saves or explicitly publishes them; do not bulk-publish legacy records.
- Show the current account's saved CineGenius profile photo in the desktop and mobile header account controls (operator decision, 13 November 2026). Load it through the existing permission-checked profile endpoint and MediaImage, with a stable account-icon fallback. Scope responses and profile updates to the current authenticated account, discard stale responses, and never restore an account-agnostic portrait cache. Keep all compact controls usable from 320 CSS px.
- Keep the complete visible CineGenius wordmark beside its chevron at every viewport and in every session state, including 320 CSS px. Never replace it with a mark-only logo to fit account photos or other controls. Preserve the existing logo typography and all visible controls; use only necessary spacing adjustments while retaining at least 44×44 CSS px touch areas, including the flag-only language control (operator update, 14 November 2026).
- When Clerk requires email- or phone-code MFA, keep a visible resend action in the verification step so expired codes can be replaced without restarting password entry. Do not offer resend for authenticator or backup codes.
- Do not add or re-enable advertising inventory anywhere on the public site: no banners, ad slots, placeholders, booking buttons, advertising inquiry links, or reserved space. This restriction applies at every viewport and remains in force unless the user explicitly asks to add or re-enable advertising.
- Production releases must go through `npm run deploy:production` from a clean `main` checkout whose commit exactly matches `origin/main` and the linked CineGenius Vercel project. Do not run ad hoc `vercel --prod` uploads or auto-commit deploy scripts.
- Use GitHub Desktop for source-control actions that create or publish commits: stage changes, write commits, push, pull, and resolve synchronization prompts there. Do not create commits or push from the terminal. Code changes are still made in the project files; after a GitHub Desktop push, verify with read-only Git checks that `main` is clean and exactly matches `origin/main`, then use the guarded production release script below.
- Protected browser routes must redirect signed-out users to `/sign-in` on the same host by passing a request-derived `unauthenticatedUrl` to `auth.protect()` in `proxy.ts`. Do not rely on Clerk's default cross-domain redirect unless that hostname is assigned to the production Vercel project and verified. Check a signed-out direct visit to `/dashboard` after auth changes.
- See `docs/design-and-release.md` for the reference rules, deployment project and release procedure.
- Message read state is per-user in `message_reads`; unread counts must be derived from `unread_message_counts`, never reset at login. Group chat access and membership must remain server-checked, with join-time history boundaries and admin-only management. Apply and verify the production Supabase migration before releasing dependent app code; see `docs/design-and-release.md`.

## Mandatory localization for all changes

- Use the existing next-intl catalogs in `messages/{de,en,es,it,cs,hu,nl,nl-BE,sv,fr,pl,pt-PT,zh-Hans,ja,ko,ru,uk}.json` for all new or changed interface and system copy: pages, buttons, accessible labels, validation, errors, statuses, categories, notifications, and application-generated email. Update every supported language in the same change. Never add a parallel translation system or hard-coded German UI copy.
- A feature is not complete until its strings, interpolation placeholders, and layout have been checked in all supported locales. Run `npm run check:i18n` before release; it also runs during production builds and deployment. Do not expand `scripts/i18n-legacy-texts.json` to admit new hard-coded text. That file is a frozen inventory of existing localization debt; remove entries as those surfaces are translated.
- Preserve stable department, occupation, category, and offer IDs. Translate display labels only and reuse the same taxonomy in setup, editing, filters, and public views. Never translate or overwrite personal messages, member-written descriptions, names, or company names automatically.
- Legal documents need reviewed language versions. Until available, explicitly show that the original German legal text is authoritative; do not publish machine translations as approved legal documents.
- The manual locale cookie takes priority over browser preferences, persists across authentication, and must not be removed on logout. Use the shared locale resolver for both next-intl and Clerk. Switch with a server-component refresh, never a hard page reload or a locale-keyed form remount. Preserve unsaved fields and ongoing uploads.
- Load only the requested language bundle, merged with the defined default fallback, on the server. Do not fetch all language catalogs on navigation or add external translation requests per page. Format dates and numbers with the active locale without currency conversion.
- Maintain complete catalogs and verified critical language flows for all seventeen supported locales across public/browse pages, authentication entry forms, profile editing, canonical place filters, taxonomies and generated system copy. If later work introduces partial coverage, disclose it until its legacy UI, system copy, taxonomies and critical flows are verified. Never claim full coverage from catalog key parity alone; distinguish native-only bundles and third-party-owned templates from the website catalogs.

## Media origin and confidentiality

- New member-uploaded images must go through `storeProtectedMedia` and the private `protected-media` bucket. Persist the stable `/api/media/...` reference, never a local preview URL, a signed URL or a permanent public URL for an unbound/private upload.
- The `media_assets` ledger records the first canonical parent. Mirroring an image in another profile, listing or community view must never change that origin or grant new rights. Evaluate current parent visibility, ownership and accepted company permissions on every original/thumbnail request, before any derivative-cache lookup.
- Render uploaded images with `components/MediaImage.tsx`. Protected sources must bypass the shared Next image optimizer; maintain the explicit optimizer guard and no-store response headers. Do not restore a public derivative cache without an equivalent current permission check.
- On Vercel, also preserve `images.localPatterns` generated from repository-owned static assets and the public-only Supabase remote patterns. Platform image-cache hits can precede application Proxy checks. Permission-aware API images and signed/private Storage URLs must be excluded by the platform's own source validation, not only by Proxy. Retiring legacy public originals also requires explicit deletion of their old image-cache variants; stale-while-revalidate is insufficient for confidential bytes.
- Use `visibleLinkedProfileIds` before projecting linked private identities in public company teams, project credits, collaborations or recommendations. Do not cache authorization decisions across requests. Privacy withdrawal must expire affected data immediately rather than serve stale data once more.
- Legacy public Storage URLs remain public until an explicitly reviewed file cutover retires their old public copies. Never claim that hiding a card revokes a public Storage URL, or that previously downloaded/CDN-cached public bytes can be recalled. Preserve original bytes and user content; use the journaled, verified private cutover for approved legacy cases.

## Private form recovery

- Use `useFormDraft` and `FormDraftStatus` for recoverable content forms. Autosave goes only to the account-scoped private recovery API; it must never call publication/update endpoints for public content. Keep existing onboarding drafts in their existing writer and use `useExistingDraftProtection` for their debounce window.
- Guard explicit cancel/back/sign-out actions through `useFormNavigation` or `useFormRouter`. Preserve actual browser history; never add sentinel entries to intercept Back. Opening a section alone is not a content edit.
- Never store passwords, session material, local preview URLs or File objects in recovery snapshots. Recheck current content-edit rights, preserve the last confirmed draft on errors, and never delete published media when discarding unsaved input.
- Apply and verify `20261028180000_private_form_drafts.sql` before deploying the dependent recovery UI. No public content-table backfill is required.
- Application-level RPC conflicts must use explicit HTTP SQLSTATEs such as `PT409`, never PostgreSQL transaction-retry codes `40001` or `40P01`. PostgREST may automatically repeat those transactions indefinitely when application input cannot change. Preserve expected-version checks, idempotency, account scope and service-only execution; do not replace a conflict with an unchecked write. Apply and verify `20261030150000_nonblocking_private_form_drafts.sql` before releasing its dependent recovery API. A busy snapshot must fail promptly and retain the last confirmed draft and unsaved input; never interpret failure as a saved acknowledgement.

## Optional photos

- Profile photos, company logos/covers, listing images and project/post photos are optional. Missing images must never block a private draft, submission, admin approval or otherwise authorized publication. Preserve the existing per-type publication rules and validate any supplied files/URLs normally.
- Generic public person profiles automatically use the existing photographic header when a cover is available and a compact finished identity panel when it is absent, for both existing and newly created profiles. Do not reserve an empty banner, manufacture a cover from the portrait, or require another upload. Keep company affiliations compact with an uncropped logo and public role only. Profile contact actions use the shared restrained brand accent and short localized visible labels, preserving descriptive accessible names and the existing contact permissions and lifecycle.
- Keep ordinary public cards discoverable without media and use compact existing placeholders. Pure photo discovery must contain actual eligible public uploads only. Do not auto-add placeholders as media, rewrite existing images or remove originals during this change.
- Keep `20261029010000_optional_listing_images.sql` coordinated with the optional-image UI: it removes only the marketplace database photo requirement, preserving service-only execution, ownership, profile checks, revision checks and admin restrictions.
- Admin review completeness and unreadable/missing-photo notices are advisory. Authorized admins may explicitly approve the reviewed offer from any existing moderation status, including a draft; disclose that approval publishes an unsubmitted draft. Approval needs no extra typed reason and records an honest default audit reason. Other moderation actions still require a reason. Preserve exact revision checks, valid source/provider associations, private company boundaries, canonical media-origin checks and server-only admin access. Apply `20261029020000_admin_review_discretion.sql` before the dependent UI; never bulk-publish records.

## Shared responsible person

- Reuse the authenticated account's structured name for new owned offers and companies, using private Clerk metadata `cinegeniusResponsiblePerson` and the existing responsibility API. A separate public Crew profile is not required. Never guess first/last names from display names, email addresses or company titles. Recover legacy names only from unambiguous snapshots actually bound to that account.
- New forms clearly disclose the intended public contact name before an explicit save/submission. Keep existing explicit private-name snapshots private until their responsible account confirms otherwise. Opening an older offer must neither change its privacy nor overwrite the shared account name. Preserve per-type moderation and private draft recovery.
- A verified existing provider profile can identify the person without a second name form. Resolve any reused profile name server-side. Public profile links still require current visibility. Company functions never grant permissions; an owner/editor must not reveal a delegate's explicitly private contact snapshot.


App navigation correction, 13 November 2026: Markus postpones KI and restores News in the middle of the bottom bar: Crew, Marktplatz, News, Locations, Firmen. Show KI only as a disabled item in the shared header dropdown, with a localized coming-soon label. Direct visits to `/tools` show the upcoming-tools notice without a tool launcher. This supersedes the earlier KI bottom-link decision. These changes belong to the app development branch; transferring them to the main website requires an explicit new user request. The native room scanner remains a separate future implementation, not the earlier scanner. See `docs/app-product-flows.md` for the confirmed private archive, 24-hour post and simple-menu requirements. The existing floating Genie assistant remains available on phones, tablets and laptops; do not hide its launcher as a replacement for the postponed tools destination (operator clarification in WEB CODEX, 13 November 2026).


Directory background decision, 13 November 2026: Markus explicitly requests the approved homepage image `/hero-bg-v2.jpg` across the full Crew, Marketplace, News, Locations, Companies, Projects, Jobs and Filmtiere pages, with crops progressing from far left to far right. Reuse `components/DirectoryPage.tsx` and its shared `PageBackdrop`; match the homepage’s 72% dark overlay and keep individual cards, inputs and filter dialogs on opaque readable surfaces; the surrounding toolbar and results remain transparent. The homepage crop and brightness stay unchanged. This supersedes the older header-only image rule for these directories. Homepage discovery rails use centered position dots instead of arrow controls, preserving swipe, keyboard operation and 44px touch areas.


## Gemeinsamer Nachrichteneingang (Betreiberentscheidung, 14. November 2026)

Desktop und kompakter Header haben einen gemeinsamen Nachrichten-Einstieg mit Chat-Symbol. Keine zusätzliche Glocke im Header. `/messages` und `/notifications` bleiben über die gemeinsamen Bereiche „Chats“ und „Mitteilungen“ erreichbar. Der Header zählt ungelesene Chatnachrichten und Mitteilungen aus dem bestehenden kontogebundenen Eingang; Chatbenachrichtigungszeilen dürfen Chat-Zähler nicht verdoppeln. Das Öffnen allein bestätigt keine Mitteilung als gelesen. Lesen oder Lesefehler verändern niemals fremde Konten oder Chat-Lesebelege. Die bestehende persönliche Menüverknüpfung und echte Browser-Zurück-Navigation bleiben erhalten.

## Comparable surfaces and resilient offer previews (operator request, 14 November 2026)

- When fixing a defect, inspect and verify equivalent existing surfaces and offer types, then reuse the correction for future surfaces. Do not make a one-profile exception or claim a browser simulation reproduces an unverified device failure. Record which equivalent paths were checked and the remaining device limits.
- Render offer-card thumbnails through `components/ListingImage.tsx`, backed by `MediaImage`, with a bounded retry and an accessible localized unavailable state. This applies to personal/company offer lists, homepage rails, directory lists/grids, map previews, search and favorites. Keep existing robust detail-gallery handling. Missing photos remain valid. Never change image ownership, authorization, stored originals or original focal points to repair presentation, and never fall back to a public or optimizer URL for protected media. Exercise successful load, transient failure, persistent failure, source changes and all offer types in regression checks.
- Keep direct public header links visible from 1024 CSS px with the corresponding More menu. Search remains a direct compact header action as well. On the smallest widths, allow the header an additional row with synchronized content/account-menu/message offsets; preserve the complete wordmark and 44px controls instead of clipping or shrinking them.

## Abstimmung Website und native App – Betreiberentscheidung, 14. November 2026

- WEB CODEX bearbeitet die Website. APP Entwicklung übernimmt die Abstimmung mit Xcode sowie native App-Funktionen. Jede Websiteänderung wird an APP Entwicklung weitergegeben: betroffene Bedienabläufe, Schnittstellen und Sprachen, geprüfter Commit, Testergebnisse, offene Grenzen und tatsächlicher Veröffentlichungsstatus.
- Die laufende Abstimmung zwischen WEB CODEX (01a1d43f-7699-7452-b2f3-3691699f6613) und APP Entwicklung (01a1d174-0c82-7df3-9c11-ab963e3222e5) ist von Markus ausdrücklich beauftragt. Beide Server-Chats verwenden hostId remote-ssh-discovered:cinegenius-server. Native/Xcode-Arbeit wird über APP Entwicklung koordiniert, nicht ungefragt in die Website übernommen.
- App-eigene Quellen, Sprachschlüssel und laufende Änderungen bei einem Abgleich erhalten. Der native Arbeitsplatz mit Locations/Grundrissen und RoomPlan bleibt App-Arbeit. Unveröffentlichte Websiteentwürfe nicht als live melden; Browserprüfungen nicht mit echten App-/Geräteprüfungen gleichsetzen. Diese Abstimmung ist keine pauschale Veröffentlichungsfreigabe und aktiviert keinen täglichen Prüfagenten.


## Persistent inbox sections (operator decision, 14 November 2026)

- Chats, Mitteilungen, Freunde and Gruppen share the persistent `/messages` navigation; select the section through `view` without a dashboard detour or synthetic Back entries. Preserve section input/filter state and reset private data on account changes.
- Freunde shows accepted contacts only. Do not show incoming/sent sub-tabs or sent pending requests there. Received requests are actionable in Mitteilungen using the actual connection ID, including requests outside the recent-notifications page. Opening or switching sections never accepts a request or marks messages read.
- Keep saved `/notifications`, `/messages?requests=1` and `/dashboard?tab=friends` links usable through the corresponding inbox section. Retain direct messages, group creation, confirmed contact removal, retries and interrupted-action recovery.

Crew result row correction, 14 November 2026: Keep the compact count, Crew, Locations providers, Marketplace providers and the grid/list/map controls together in that order on one row, including phones. Use icon-only view controls where space requires it, retaining localized accessible labels, fixed count width and 44px touch targets. Do not restore a second shortcut row.


## Personal privacy and Ghost mode (operator decision, 14 November 2026)

- Ghost hides a member's personal profile, structured location/activity and all personal public offers, including from accepted friends. Preserve content, stored publication states and saved audience choices; company visibility remains independent. Never use a public company or project mirror to reveal a hidden linked person.
- Reuse `lib/profile-privacy.ts`, `lib/profile-privacy-server.ts` and `visibleLinkedProfileIds` for current request-scoped permissions. Project protected fields before serialization/geocoding/filtering. Public offer reads use `privacy_visible_listings` before counts and pagination; cached content/direct links require a fresh visibility check. Never share authorization decisions between requests.
- Apply and verify `20261114180242_profile_privacy_controls.sql` before dependent Web/native releases. Settings are own-account only through `/api/user-settings`; errors or missing capability fields must not look like saved privacy choices. Native settings use the same contract in `docs/profile-privacy.md`.
- Ghost is visibility control, not deletion or a promise to recall previously public Storage URLs/copies. Keep this limit explicit; retiring legacy originals requires the existing reviewed, journaled media cutover and cache retirement. Existing shared messages and participant transaction records remain accessible under their existing rules.

## Smart development preview (operator decision, 16 November 2026)

- Smart is temporarily admin-only, including Genie search planning, direct links,
  results, maps and pagination. Enforce the existing server admin allowlist;
  ordinary membership, personal AI quota and client claims grant no access.
- Other members see only a clearly labeled static example: a small schematic
  map and a graphic explanation underneath. Guests see the development notice.
  Reuse existing Smart area colors; load no real results or map services for the
  preview. Keep ordinary search and Genie's general help/writing available.
- Preserve Locations as the homepage default and the existing shared design.
  See `docs/smart-development-preview.md` for the API/native contract and limits.

## Occupation focus and email presentation (operator decisions, 16 November 2026)

- A personal profile selects one main occupation, up to two secondary occupations
  and at most one additional occupation. Only the first three belong on cards;
  the additional occupation remains in profile details and search. Reuse
  `lib/crew-occupations.ts`; never truncate persisted positions or silently reduce
  older selections during unrelated edits. See `docs/profile-occupation-focus.md`.
- Directory sort menus and homepage news country/topic selectors use
  `components/BrowseSelect.tsx`, with the shared subtle translucent lime popup,
  keyboard support and 44px options. Keep existing page layouts and filter choices.
  Header search, directory filter dialogs and their category/place/detail choices
  use the same `browse-popup-surface` treatment. Nested selection popups must stay
  in the modal's top layer, with Escape closing the selection before the filter
  dialog. See `docs/browse-selection-menus.md`.
- New application emails use `lib/email-layout.ts` and the existing localized
  content. Preserve token links, unsubscribe choices, recipient language and
  delivery/idempotency checks. Provider-managed authentication/billing templates
  require their separate reviewed configuration; a website deployment alone does
  not update them. See `docs/email-branding.md` for the audit and limits.

## Zentrale News-Redaktion (Betreiberauftrag, 16. November 2026)

- Alle redaktionellen News-Aufträge einschließlich früherer „Erstelle News“-Aufträge
  gehören zu Agent AG DOK. Der Technik-News-Agent betreut Hersteller, Geräte und
  Firmware; bestehende Rechercheaufträge und Einreichungen übernehmen, nicht
  duplizieren. Siehe `docs/agents/technology-news.md`.
- WEB CODEX verantwortet Website-Programmierung und Datenanbindung, APP/APP
  Entwicklung die native Umsetzung. Laufende App-Arbeit erhalten und Schnittstellen
  abstimmen. Redaktionelle Quellen und Prüfergebnisse zentral weitergeben.
- Die Startseiten-Themenwahl verwendet den vorhandenen News-Katalog, tatsächliche
  freigegebene aktuelle Inhalte und kontogebundene Einstellungen. Keine Beispiel-
  artikel als echte News, keine Herkunft eines Herstellers als erfundene Zielregion.
  Siehe `docs/home-news-topics.md`.
- Lernen bedeutet ein privates, belegbares Korrekturprotokoll. Es erlaubt weder
  automatische Rechteausweitung noch Selbstfreigabe neuer Artikel. Agenten und
  Zeitpläne nur nach bestätigter Einrichtung als aktiv melden; eine Anleitung oder
  Übergabedatei allein aktiviert nichts. Der Website-Prüfagent bleibt deaktiviert.

## Profile identity and expanded languages (operator decision, 16 November 2026)

- User-approved target languages: existing de/en/es/it/cs/hu/nl/nl-BE/sv plus fr/pl/pt-PT/zh-Hans/ja/ko/ru/uk. All new and changed interface, validation, accessibility, system and generated email copy must cover every enabled language, with the same target for the native app. Do not declare a new locale complete or enable it with copied fallback text. Preserve locale choice, drafts, authentication and stable taxonomy IDs. Keep member-written content unchanged. Legal language versions require review; retain the clearly labeled authoritative German original until reviewed versions exist.
- Occupation wording follows the latest 17 November preference decision below; the earlier blanket neutralization rule is superseded. Optional pronouns default to empty, have an explicit display choice, remain editable/removable and are never inferred or used for search/ranking.
- Provide twelve optional profile avatars: four masculine, four feminine and four neutral. Every choice is available to every member; never derive gender or pronouns from a choice. Preserve existing photographs and protected-media permissions.
- Markus confirms an existing OpenAI key and explicitly authorizes reusing it for the one-time catalog translations after being informed that API usage can incur additional costs. Prefer that existing credential for authorized API work; never expose it or treat its presence as unlimited spending authorization. Translation outputs are bundled locally; no per-page translation requests. Lack of a locally usable credential is not permission to expose production secrets or bypass access controls.

## Profile identity and language expansion (operator update, 17 November 2026)

- Occupation wording follows the latest 17 November preference decision below, preserving canonical role/department IDs and legacy search aliases. Optional self-described pronouns are private by default, displayed only after explicit consent and current profile visibility checks. Never infer gender/pronouns or use them for ranking, filtering or mandatory completion. Keep consent fresh outside shared profile caches.
- Approved additional locales: fr, pl, pt-PT, zh-Hans, ja, ko, ru, uk. Update all supported catalogs, locale resolution, Clerk, Genie and generated mail together, with legal originals identified. Incomplete draft catalogs are not enabled in production. Check the full critical language flow, not only key parity.
- Avatar and cover presets are deferred by Markus. Show twenty paired style previews for selection; do not publish any preset picker or replace existing user uploads. This supersedes earlier avatar/cover draft approvals. See docs/profile-identity-languages.md.

## Profile art assortment (operator update, 17 November 2026)

- Markus approved all twenty paired studies and delegated selection of twelve avatars (four masculine, four feminine, four neutral presentations) and twelve nature covers. This supersedes the earlier design deferral; production publication remains a separate release request.
- Offer the shared selection during personal profile setup and later profile editing. Suggest one varied, account-stable avatar only for new profiles; preserve resumed choices, explicit removals, uploads and existing profiles. Every design is available to everyone and implies no gender, pronouns, permissions or verification.
- Keep versioned public artwork URLs available permanently when changing the assortment. Retain all original studies in `design/profile-art/2026-11-17`; never rotate artwork on existing profiles. Art is repository-owned decoration, not a member-uploaded photograph for community discovery. Uploaded media keeps the private permission-checked workflow. See `docs/profile-art.md` for the native contract and test limits.


## Simplified personal area (operator decision, 17 November 2026)

- The portrait menu contains only Mein Bereich, Profil ansehen, Einstellungen and Abmelden. Keep server-confirmed administration/support access within Mein Bereich; preserve current-account support badges on the portrait. PersonalAreaHome is the management entry; do not restore a second personal navigation bar or duplicate editors in the dropdown.
- Existing profile editing uses direct sections with Save changes; the sequential assistant remains for first creation only. Navigating sections is not a content edit. Preserve private recovery, explicit publication, optional media, current occupation/artwork rules and account isolation.
- Settings group sign-in/account management, privacy, notification preferences, payments and verification. Use the existing identity provider for credentials and retain the separately available verification-document flow. Keep destructive actions collapsed and explicitly confirmed.
- Messages has one mixed list for direct and group conversations, with recipient search and multi-person group creation in New message. Contacts and notices are utility destinations with a clear return to Messages; keep legacy links and real Back working. Platform notices use a separate header bell; chat and notice badges must remain independently account-scoped. This supersedes the earlier four inbox tabs and combined-badge/header-no-bell decisions.
- Browse popups and selectors use neutral readable surfaces, retaining only restrained accent selection/focus. This supersedes the translucent lime surface decision. News country/type selectors have stable dimensions across selection changes; countryless news is labeled Neutral in every supported locale.
- Homepage news advances horizontally through pages of three actual eligible stories with visible position dots. Keep ordinary vertical page scrolling; never create a nested vertical news scroll area. Preserve country/topic/approval filtering and the bounded query.


## Compact occupation labels and optional wording (latest operator correction, 17 November 2026)

- This decision supersedes both the earlier blanket occupation-neutralization rule and the intervening full masculine/feminine pair requirement. Restore the previous compact shared standard, including established asterisks/slashes (for example Oberbeleuchter*in). Existing profiles and older drafts without an explicit choice use that standard; never bulk-rewrite their saved occupations or artwork.
- An owner may optionally choose standard, masculine, feminine or neutral professional wording while creating or editing their own occupations. Use the shared `components/OccupationFormSelect.tsx`, neutral readable surfaces and at least 44px controls. The optional choice is `crew.occupationForm`; use `lib/occupation-form.ts` for validation, defaulting and preservation. Explicit standard resets the override; omitted keys and older clients preserve a saved override.
- Render a person's occupations using that person's explicit preference, never the viewer's preference or inferred sex. Names, portraits, artwork, pronouns and casting attributes must not select it. Pronoun consent and visibility remain independent. Unknown member-written titles remain untouched.
- Keep one canonical choice and stable occupation/department IDs for all forms. Best Boy / Best Girl, including Electric, Grip and Rigging, remain aliases of the same existing role. Search all localized forms and legacy exact aliases regardless of the selected presentation; do not create duplicate role choices or guess ambiguous departments.
- Keep precise professional meaning and qualifications. Use curated explicit catalog forms, including irregular forms; do not derive grammar at runtime, invent female suffixes, replace occupations with unrelated activities or imply new leadership/medical qualifications. A neutral option may use an accurate established epicene/international title or locale-appropriate compact inclusive spelling.
- Preserve all seventeen locales, both animal-role namespaces, account-scoped private recovery, existing images and provider-only flows. Load only the current language bundle and defined fallback, never all seventeen catalogs into an editor. See `docs/occupation-form-preference.md` for the shared Web/app contract and verification limits.

## Compact Smart layout (operator selection, 17 November 2026)

- The latest approved mobile concept is option 1: a small map above compact, area-grouped results with the shared Crew list/map switch. Desktop keeps a large map on the right and compact results on the left. Keep further filters collapsed and show only areas with actual currently visible entries; no empty requested categories or invented results.
- Deduplicate repeated type/id results across wishes without changing their public facts or server ranking. Keep all existing result cursors, unmapped list entries, explicit map filtering and current privacy/admin checks.
- Mark the active, authorized Smart search input with the existing Lime accent on the homepage and Smart results. The same server-confirmed account predicate controls access and homepage styling; this is not an access expansion. Preserve ordinary search and member/guest development previews. See docs/smart-discovery.md.


## Exclusive artwork replenishment (operator correction, 18 November 2026)

- New optional artwork uses faceless silhouettes and quiet nature covers; omit line drawings, technical patterns, harsh neon geometry and busy illustrated scenes. Avatar presentation is freely selectable as feminine, masculine or neutral, never inferred from the member.
- Offer four avatars per presentation and twelve covers, with an additional reserve. Refill after confirmed assignment, not page opening. One-time assignment must be backed by durable ownership and current availability; never recycle shared legacy artwork as exclusive. Provider/quality failures must not be reported as available stock.
- A picture change retains prior ownership. Explicit permanent deletion requires confirmation and profile Save, blocks future use/reassignment, and retains a duplicate-prevention tombstone. Preserve interrupted input and old clients; do not make ordinary photo uploads destructive.
- Verschenken/Tauschen is a future proposal, not an active feature. Any later transfer must change a single owner atomically and require the actual owner's confirmation. See `docs/profile-art-stock.md` for the Web/native contract and validation boundary.

## Classic artwork replacement (latest operator correction, 18 November 2026)

- Markus requests immediate replacement of both avatars and covers, one at a time,
  using the original 17 November flat graphic style. Preserve the editable sources,
  existing member photos, claimed artwork and exclusive assignment rules. Retire
  rejected free stock from selection without deleting originals or owner records.
- Prefer simple matte two-dimensional silhouettes and broad graphic nature scenes.
  Do not generate realistic/sculptural heads, plastic busts or photographic/painted
  landscapes. The independent review must enforce this style before replenishment.
- Unrelated work remains paused; the Smart-language branch is not part of this
  artwork publication. See `design/profile-art/2026-11-18-classic/README.md`.


## Mixed optional artwork and member profiles (operator update, 18 November 2026)

- New stock uses the approved evening-light, color-field, paper-collage, soft-form,
  faceted and flowing-color directions, including abstract invented facial features
  and stronger color variations. This supersedes the faceless-only requirement.
  Always show a collage before a new style; preserve exclusive ownership and
  duplicate prevention. All presentations are freely selectable, mixed by default.
  Personal photo likenesses remain private preview requests, outside stock generation.
- Add `members` as an explicit profile visibility option, retaining `public`, legacy
  friend-only `private`, Ghost, blocks and field audiences. Enforce visibility on
  direct profiles, linked identities, search and protected media. Apply the member
  privacy migration before releasing dependent controls. See docs/profile-privacy.md.
- These additions do not resume the paused Smart-language work or authorize a new
  production publication on their own.

## Latest app interaction and Workspace contract – 19 November 2026

Follow `docs/design/app-current-20261119.md` for the latest native-only navigation, shared measured header clearance, swipeable view controls, Workspace-style Genie and department About-glass contract. Workspace functions must reuse account-bound project/document IDs and respect revocable source context; Genie navigation context never grants access. Preserve actual implemented scope and distinguish local references from online team delivery.

## Two maintained product inventories – operator request, 20 November 2026

- Maintain `docs/CINEGENIUS-WEBSITE-UEBERSICHT.md` for the entire website, including public pages, personal/admin areas, feedback, editorial operations and shared foundations.
- Maintain `docs/CINEGENIUS-APP-UEBERSICHT.md` separately for the entire native app, including Work and device-specific capabilities. Markus explicitly requests two inventories, not one combined list.
- With each relevant change update the affected entries: scope, date, implementation status, publication/activation evidence, tests and remaining work. Cross-link shared contracts and coordinate with APP Entwicklung. Preserve unrelated updates; these documents create no new automation or release authorization.
- Distinguish source present, tested, deployed, activated, installed and verified on a physical device. Never infer a live feature from a route, a draft, a successful build or another platform's test. Add new modules and mark superseded behavior; do not silently drop unfinished work.


## Nachgemeldete Crew-Zähldifferenz und Prioritäten — 20. November 2026

Die mit WEB CODEX abgeglichene Korrektur aus `5ba93dd7` setzt die sichtbare und
zugängliche Crew-Gesamtzahl auf denselben gefilterten Bestand wie die Karte.
Die frühere Anbieter-Ausnahme ist überholt; die Kartenausschnittsbegrenzung
ändert weiterhin nicht die gefilterte Gesamtsumme. Native Beschriftung
„gesamt“, Lade-/Fehlerzustände und aktuelle Rechte erhalten.

Die gemeinsame Prioritätenliste ist `docs/AKTUELLE-AUFTRAEGE.md`: akute
Datenschutz-/Datenverlustfälle, dann Funktionsfehler, danach abhängige begonnene
Arbeit und Erweiterungen. Die lokale Mac-Aufgabe bearbeitet die gemeldeten
Smart-/Work-Hänger; keine konkurrierende Installation oder Veröffentlichung.
Homepage-Rotation ist separat geprüft und gesichert. App-Livegang bleibt
ausdrücklich angehalten; geprüfte Entwürfe sind keine neue Freigabe.
