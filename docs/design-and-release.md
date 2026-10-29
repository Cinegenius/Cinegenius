# CineGenius shared design and production release path

## Design reference

The current `/projects` page is the source of truth for public directory design. Its cinematic backdrop, compact header, lime emphasis, dark surfaces, restrained borders, centered content width, and primary navigation order should carry across Locations, Marktplatz, Crew, Firmen, and Jobs. Page-specific filters, listings, map controls, and empty states remain specific to their purpose.

Use `components/PageHeader.tsx` for page headers and its exported backdrop helper for any page that intentionally extends the image beyond the header. `app/globals.css` owns shared width and surface values: `--site-content-max`, responsive gutters, `site-container`, `browse-toolbar`, and `browse-card`. Keep filters and result lists on the solid background; don’t extend the cinematic image behind them unless the `/projects` reference does so. The former `CategoryHero` component was removed after its remaining routes were migrated.

All six directory areas (`/projects`, `/locations`, `/props`, `/creators`, `/companies`, `/jobs`) use `components/MobileBrowseControls.tsx` below 1280 CSS px. This shared control provides the full-width search, sort, labeled category select, count, removable filter chips, and scrollable filter panel with reset/apply actions. Page-specific controls belong inside the shared panel; do not add horizontal category strips or standalone mobile filter rows. Keep controls usable at 320 CSS px, ensure touch targets are at least 44×44 CSS px, and account for keyboard viewport resizing and safe-area insets. `app/globals.css` owns the mobile component styles.
Reserve enough safe-area-aware space for the fixed bottom navigation so the last result card and empty-state actions can scroll completely above it.

The homepage keeps `/hero-bg.jpg` as a full-page backdrop using the shared `PageBackdrop` component. Its slightly brighter dark overlay must retain readable copy and clear card surfaces while allowing the image to continue behind homepage sections.

Desktop and mobile navigation use the same order: Locations, Crew, Jobs, Marktplatz, Projekte, Firmen. Keep `components/Navbar.tsx` and `components/BottomNav.tsx` aligned when editing navigation.

## Authentication entry points

Keep `/sign-in` and `/sign-up` one click from the homepage. On desktop, show both actions in the header; on phones, show them outside the collapsed menu. Homepage and navigation links prefetch the corresponding direct routes. Each route renders the actual email/password inputs in its first server response, and the client form uses Clerk's supported flow; never add an intermediate welcome or account-type page. Ask only for fields the identity provider marks as required, then defer profile details to onboarding. Keep reciprocal sign-in/register links and send an existing session directly to its requested internal destination. Header account controls use a stable account icon rather than profile photos, preventing stale or late-loading portraits after sign-in. Profile photos remain visible on profile pages and other intentional profile surfaces.

Email-and-password is the default sign-in method. Email-code sign-in is an explicit alternative; never automatically start it when a password attempt returns `needs_first_factor`. Only `needs_second_factor` and `needs_client_trust` should enter the configured security verification flow. Do not weaken Clerk MFA or Device Trust settings to avoid a legitimate challenge.

New users continue from verified registration to the shared `/profile-setup` assistant. It asks for their name, lets them select multiple goals, then shows only the relevant steps for each selected goal before a review with an edit action for every section. Crew occupations come from the full shared department catalogue; talent occupations come from the casting group. Search-only users skip provider creation and go directly to search. Progress is stored privately, resumes after reload or sign-in, and old unfinished drafts are migrated without losing entries. Offers remain private while being drafted or submitted; an owner can only submit them for review. Only an explicitly authorized administrator can approve the exact reviewed version. Material content/image/provider edits invalidate approval and require review again; never equate saved, complete or active with publicly approved. Company profiles become public as soon as the owner saves them; onboarding and editing must explain this before the save action. Stable retry keys prevent duplicate setup records. Existing private company records remain private until the owner saves or explicitly publishes them; do not bulk-publish legacy records. The profile completion button clearly states when it creates a public profile or company. Completed existing profiles do not re-enter onboarding.

## Design regression checks

Run `npm run check:design` before each release. It verifies that all six public areas still use `PageHeader`, the desktop and mobile navigation have the same destinations in the same order, the shared page-width and solid-toolbar styles remain present, and the removed `CategoryHero` layout has not returned. The production release script runs this check automatically.

For visual review, capture `/projects`, `/locations`, `/props`, `/creators`, `/companies`, and `/jobs` at identical 320×740, 375×812, 390×844, 430×932, 768×1024, 1024×768, and 1366×900 viewports. Compare each area beside `/projects` at that same size, checking the header, page width, search/filter stack, first result row, and fixed mobile navigation. Exercise search, category and sort selects, filter combinations, reset/apply, long labels, empty results, orientation, and the keyboard-open filter panel. Check for horizontal overflow. Open each route directly, reload it, then navigate across areas. Review signed-out and signed-in navigation when an authenticated test session is available; production data must not be altered for these checks.

## Production source and release

### Private form recovery

Before releasing the automatic recovery snapshots, apply `supabase/migrations/20261028180000_private_form_drafts.sql`. It creates an account/key-scoped private table and a service-only version-checked writer. Verify RLS, denied `anon`/`authenticated` direct access, service-role access, retry idempotency and stale-tab rejection. The change does not publish or rewrite profiles, companies, listings or projects. Application reads/writes also recheck current edit permission for existing content. Native reload/tab-close prompts depend on browser support; do not claim guaranteed unload delivery or recovery of an unfinished upload. See `docs/test-reports/private-form-drafts-2026-10-28.md` for local verification and remaining production/device checks.

### Responsible provider identity

Before releasing the responsible-person fields, apply `supabase/migrations/20261028120000_responsible_person.sql` to the linked database. Verify both nullable `responsible_person` columns, service-role access, preserved existing rows, and denied direct `anon`/`authenticated` access to the new internal fields. Existing column access and row policies must remain intact. Unexpected inherited grants deliberately abort the migration; investigate them rather than skipping its checks. No bulk backfill or publication is part of this migration.

Use structured Clerk first/last names only to prefill the real owner; never split a display name or use an email/company title as a person. Creation binds responsibility to the verified current account. Existing editors retain the stored contact and may not silently substitute themselves. A public function never becomes an access role. Only the explicit per-offer public choice projects the contact name/function; never serialize the raw snapshot in public responses. Public profile links require a real, currently visible profile. Admin provider reassignment clears the obsolete snapshot and requires the actual provider to complete it before a later publication. See `docs/test-reports/responsible-person-2026-10-28.md` for verification and remaining live checks.

- Canonical Git source: `origin/main` in the CineGenius repository.
- Use GitHub Desktop for Git operations that create or publish repository history: stage, commit, push, pull, and resolve synchronization. Do not create commits or push from the terminal. Make code edits in the project normally; after pushing through GitHub Desktop, confirm the working tree is clean and local `main` exactly matches `origin/main` before using the guarded release command.
- The production Vercel project is linked locally through the ignored `.vercel/project.json`. Check the linked project and production alias in the Vercel dashboard before a release; keep those account-specific identifiers out of the public repository.

## Authentication redirects

- Protected browser pages must send signed-out visitors to `/sign-in` on the same host as the requested page. Build the URL from `request.url` and pass it as `unauthenticatedUrl` to `auth.protect()` in `proxy.ts`; do not rely on Clerk's default cross-domain redirect unless that hostname is explicitly attached to the production Vercel project and verified.
- After any auth-routing change, test sign-out, then open `/dashboard` directly while signed out. The redirect must reach the app's sign-in page without a Vercel 404; preserve the requested path in `redirect_url` where applicable.
- Vercel automatic production deployment from `main` is disabled in `vercel.json`. This prevents an unreviewed Git integration deployment from replacing production.
- Publish a release only by running `npm run deploy:production` from a clean `main` checkout whose `HEAD` matches `origin/main`. The guarded script checks the branch, clean tree, remote commit, linked project, and shared design rules, then uploads the checked source for a Vercel-hosted production build. Do not use a local prebuilt release: Vercel intentionally redacts sensitive environment values when pulling them locally, so a local prebuilt can capture placeholder values instead of the real production configuration.
- Never use a dirty working tree, another branch, a stale project folder, or a direct ad hoc `vercel --prod` command for production. The guard is intended to make those recurring snapshot overwrites fail before deployment.
- `npm run build` uses Next.js Webpack explicitly. This avoids the reproduced Turbopack Google Font resolver failure in the Vercel CLI production build while keeping local and Vercel builds on the same successful path.

## Messaging and group conversations

- Message reads are stored in `message_reads` per `(message_id, user_id)`. Never use the legacy global `messages.read_at` as the unread source after the receipt migration; it is only backfilled for compatibility. Counts come from `unread_message_counts` and include active members' incoming messages after their current join time.
- All conversation and message reads, sends, group administration, read receipts, and notifications go through authenticated server routes. Do not subscribe clients directly to raw message rows. Client refreshes must be deduplicated by message ID and scoped to the active Clerk user/session.
- Personal message deletion hides only the sender's own message through `hidden_for_sender_at`; keep the original and recipients' views intact. Before releasing this feature, apply `supabase/migrations/20261025110000_hide_own_messages.sql` and verify the service-only `hide_own_conversation_message` RPC. Both the chat history and sidebar preview must filter the current sender's hidden messages before pagination.
- Group membership is recorded in `conversation_members`. New members see messages from `joined_at` onward. Rejoining resets that boundary. Only active members can read or send; only admins can rename/add/remove. When the last admin leaves, the oldest active member is promoted. A sole remaining admin must add another member before leaving.
- Do not clear unread counts at login or mark an entire thread read. A client marks only IDs from its fetched snapshot, and the server validates membership, sender, conversation, and join boundary before storing receipts.
- Before production release, apply `supabase/migrations/message_read_receipts.sql` to the linked production Supabase project, verify the new schema/RPCs, then release the matching clean `main` commit through `npm run deploy:production`. Do not deploy the app code before the migration succeeds.
- Before releasing the homepage photo-rating feature, apply `supabase/migrations/profile_image_ratings.sql` to the linked production Supabase project and verify its unique constraint, RLS, and grants. This migration has been applied and verified on the production `main` database.
- Before releasing idempotent photo likes, apply `supabase/migrations/profile_image_likes_unique.sql` to the linked production Supabase project. It removes duplicate rows for the same liker/profile/photo while preserving one existing like, then enforces a unique index used by the API's state-setting upsert. Verify the index before deploying the application code.

## Public community media and direct company invitations

- Discovery now allows only directly assigned public personal-profile and company-profile media. Apply `supabase/migrations/20261025150000_profile_company_discovery_only.sql` and `supabase/migrations/20261025151000_bound_discovery_query.sql` before releasing this restriction. Keep decoded candidate paths materialized before Storage joins; do not inline path decoding into those joins. It supersedes the earlier all-source registry definition below, keeps uploads/likes intact, and excludes foreign-parent assignments even when mirrored in a profile. Keep the application source allowlist before pagination; do not use likes or `featured` as admission requirements.
- Before releasing the expanded public image collection and targeted member invitations, apply `supabase/migrations/20261024190000_public_community_media.sql` and `supabase/migrations/20261024191000_direct_company_invitations.sql` to the linked Supabase database. A successful rollback-only compatibility test does not mean the migrations are installed.
- Verify the server-only view, public-storage joins, helper grants, `recipient_user_id`, invitation status constraint, pair guards, and the three invitation/search RPCs. Ensure PostgREST has refreshed its schema before releasing dependent server routes.
- Keep `public_community_media` and the trusted RPCs inaccessible to direct anonymous/authenticated database clients. The app server checks Clerk identity and company permissions; a public job title must never become an authorization role.
- Do not ship temporary test routes or Clerk bypasses. Preserve existing memberships and photo-like records. See `docs/test-reports/community-media-team-2026-10-25.md` for tested flows and remaining real-account/device checks.

## Advertising surfaces

Public advertising surfaces are disabled across all routes and screen sizes. Do not add ad banners, reserved slots, placeholders, advertising inquiry links, or booking buttons unless the site owner explicitly asks to add or re-enable them. Keep the `/werben` route redirected to the homepage while this rule is active. `npm run check:design` guards against the removed placeholder, reserved layout, public ad copy, and footer-style links returning; the production release script runs this check before deployment.

## Cause confirmed during the deployment review

Production had been replaced by manual CLI uploads from dirty or stale local snapshots instead of a single canonical Git commit. Automatic Git production deployment was disabled, so different uploads could replace the live build without being tied to the current `main` commit. The source review found no service worker registration or service-worker asset; it was not the cause of the differing layouts.

### Admin-Prüfansicht (2026-10-28, erste Ausbaustufe)

Vor Veröffentlichung der abhängigen App-Version die Migration
`supabase/migrations/20261028160000_admin_review_release.sql` prüfen, in Produktion
anwenden und die Ausführungsrechte verifizieren. Sie legt ausschließlich die
servicegeschützte Funktion `admin_review_listing_transition` an, verändert keine
bestehenden Inhalte und verbindet den Vergleich des geprüften Datensatzes,
Publikationswechsel und Aktionsprotokoll in einer Transaktion. `anon`,
`authenticated` und `PUBLIC` dürfen sie nicht ausführen. Ohne diese Funktion
scheitert die Admin-Freigabe bewusst geschlossen; keinen Ersatz ohne Versionsprüfung
aktivieren. Die Produktionsmigration wurde am 28.10.2026 in CineGenius main
PRODUCTION ausgeführt: Gäste/Mitglieder ohne Ausführungsrecht, Service-Rolle
berechtigt, vorhandene Inserate und Firmen unverändert. Freigeben, Ausblenden,
Versionskonflikt und Protokolleinträge wurden dort mit einem eigenen Testdatensatz
in einer vollständig zurückgerollten Transaktion geprüft.

Private Prüfbilder werden ausschließlich über `/api/admin/reviews/[kind]/[id]/media`
ausgeliefert: aktuelle Adminprüfung, explizite Inhaltsquellen, kanonischer Elternabgleich
und keine gemeinsamen Bildcaches. Dies ist keine allgemeine Freigabe privater Medien
für Administratoren; Nachrichten und Supportanhänge gehören nicht zu den Prüfquellen.
Vor dem Release mit eigenen Testdaten auf dem produktiven Auth-/Storage-System prüfen.

### Verbindliche Inseratsfreigabe (2026-10-28)

Die nächste Stufe ersetzt die frühere direkte Anbieter-Veröffentlichung. Vor ihrem Release `supabase/migrations/20261028200000_offer_moderation.sql` prüfen und koordiniert mit der abhängigen App-Version anwenden. Alte App-Versionen versuchen noch `published=true` zu schreiben; nach der Migration scheitert dieser Weg bewusst geschlossen. Daher den Datenbankschritt nicht als unabhängige Vorabänderung mit längerer Wartezeit ausrollen. Die beiden Migrationen (Formularentwürfe und Inseratsfreigabe) wurden am 28.10.2026 vor dem passenden App-Release gemeinsam angewendet und auf unveränderte Bestandsinhalte sowie gesperrte Clientrechte geprüft. Eine vollständig zurückgerollte Produktionstransaktion bestätigte Einreichen, Freigeben, erneute Prüfung, Ablehnung, Versionskonflikt, Audit und private Entwurfsspeicherung.

Die Datenbank erzwingt private Standardwerte und `draft → pending → approved` für `listings` und `company_equipment`. `published` ist nur für eine geprüfte Revision oder ausdrücklich gekennzeichnete Bestandsfälle wahr. Titel, Text, Fotos, Preis, Anbieter und andere wesentliche Angebotsdaten invalidieren die Freigabe. Bis zur erneuten Prüfung bleibt die geänderte Fassung unsichtbar; es gibt noch keine sichere parallele Altfassung. `changes_requested`, `rejected` und `hidden` sind ebenfalls privat. Anbieter dürfen erneut einreichen, aber niemals selbst freigeben. Ein dauerhaftes Kontoverbot ist damit nicht implementiert.

Alle bisherigen öffentlichen Datensätze bleiben unverändert öffentlich und werden als `legacy_review_required` einzeln zur Entscheidung angeboten; es wird kein historischer Freigabenachweis erfunden. Prüfhistorie, Adminprotokoll und Entscheidungsmeldung werden atomar gespeichert. Die Freigabe vergleicht den vollständigen geprüften Datensatz und die Anbieterzuordnung, sperrt die betreffende Zeile und lehnt inzwischen geänderte Fassungen ab. Direkte Client-Lese- und Schreibrechte bleiben gesperrt; alle Zugriffe laufen über die vorhandenen servergeprüften Routen. Kein Fallback auf ein ungeschütztes Update bei fehlender RPC.

Vor einem Release müssen die Produktionsrechte, PostgREST-Schemaaktualisierung und ein eigenes Admin-/Mitglied-Testangebot einschließlich geschützter Fotos geprüft werden. Lokale Simulationen sind kein Nachweis für eine Live-Veröffentlichung. Bestehende öffentliche Storage-Dateien werden durch einen Statuswechsel nicht nachträglich vertraulich; eine gesonderte geprüfte Dateiumstellung ist dafür erforderlich. Details und Bestandsbefund: `docs/test-reports/offer-moderation-2026-10-28.md`.

### Marktplatz-Veröffentlichung mit eingerichtetem Profil (2026-10-28)

Die ausdrückliche neue Betreiberentscheidung ersetzt die obligatorische Adminfreigabe ausschließlich für `prop` und `vehicle`. Ein eingerichtetes Profil (dieselben Basisangaben wie beim Onboarding) und aktuelle Anbieter-/Firmenberechtigungen erlauben die explizite Veröffentlichung. Ein privater Entwurf wird durch Speichern oder Autosave weiterhin nicht veröffentlicht. Name und Konto werden serverseitig wiederverwendet; keine neue Freigabe persönlicher Kontaktdaten.

Vor dem App-Release `20261028210000_marketplace_profile_publication.sql` anwenden und verifizieren. Die Migration ergänzt `owner_published` und eine ausschließlich für die Service-Rolle zugängliche, versionsgeprüfte Veröffentlichungsfunktion. Sie veröffentlicht keine vorhandenen Datensätze und erfindet keinen Adminfreigabenachweis. Adminsperren gelten über Bearbeitung und erneutes Einreichen hinweg, bis eine berechtigte Adminentscheidung sie aufhebt. Locations, Tierportfolios, andere Inseratsarten und `company_equipment` behalten den Prüfablauf. Die älteren allgemeinen Beschreibungen der obligatorischen Freigabe gelten damit nur außerhalb dieser Marktplatz-Ausnahme.

Prüfnachweis und noch offene Produktionsschritte: `docs/test-reports/marketplace-profile-publication-2026-10-28.md`. Nicht abgeschlossene Filmtiere-Arbeit darf nicht Teil dieses Releases werden; sie ist separat gesichert.

## Film animals and animal training (28.10.2026)

The shared `lib/animal-taxonomy.ts` catalogue supplies the human animal-training/handling occupations, agency categories, services and species. Explicit secondary occupations remain eligible for their chosen crew filters. Preserve legacy role IDs and resolve exact old references without rewriting members' stored content. Animal portfolios are supervised production enquiries, not marketplace sale/rental objects. They retain submission and explicit admin approval; the prop/vehicle self-publication exception does not apply.

Apply `20261028220000_film_animal_company_details.sql` before the dependent app. It adds only optional `companies.animal_details` JSONB, keeps direct client writes denied and uses the existing authenticated company server routes. On 28.10.2026 it was applied to production and verified: 13 companies, 21 listings, 19 public listings; unchanged company fingerprint, anon/authenticated column writes denied, service-role write allowed. No member or publication backfill. See `docs/test-reports/filmtiere-tiertraining-2026-10-28.md` for local testing and remaining live checks. The earlier instruction to exclude unfinished animal work applied to the preceding marketplace-only release.

## Optional profile and offer images (29.10.2026)

Before deploying the optional-photo application changes, apply and verify `supabase/migrations/20261029010000_optional_listing_images.sql`. It replaces only the existing service-only marketplace publication function to stop treating a missing main image as incomplete. No content or media is rewritten, published or removed. Confirm current owner/company permissions, required profile basics, stale-revision handling and explicit admin restrictions still apply. Locations and animal portfolios retain explicit submission and admin approval; supplied photos still undergo existing validation and checked-file review. Missing photos are never a publication issue. The application removes the matching location form and admin-preview image requirements. See `docs/test-reports/optional-media-2026-10-29.md` for executed checks and production limitations.
