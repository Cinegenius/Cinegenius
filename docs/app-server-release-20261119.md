# Native app server integration

The installed native wrapper previously loaded the ordinary site directories. The app now has a single header and the bottom destinations Shots / Workspace / Smart / News / Projects. Smart is the central combined entry for Crew, marketplace, Locations and companies, with multiple areas selected together and cards, list or map with list. The original website keeps its current navigation and search behavior.

The UI uses the installed native appearance marker for presentation only. Existing Clerk sessions, server admin restrictions, privacy rules, recovery navigation and real browser history remain authoritative. The port starts from production `6f5ec38`; it does not import the divergent mobile branch, unpublished homepage changes, native source snapshot or older public profile/search rewrites.

Workspace links reopen the existing native tools and archives after a fresh native account check. This does not create online collaboration. Homies reuses the existing accepted-contact favorite contract; the ordinary website contact list remains unchanged.

Shots and Push source preparation is included but activation remains off. This release does not apply the new migrations, enable provider flags, create a bucket or send notifications. Without the separate configuration their protected APIs return an unavailable state with false capabilities. The API/worker lifecycle and later activation are documented in `shots-ephemeral.md`, `native-push.md` and `app-background-workers.md`.

The canonical release candidate passed a full Next production build and typecheck, all17 language catalogs, the shared design check and targeted ESLint checks. Separate targeted runs passed107 service tests,216 navigation/contact tests,43 Smart tests and166 Chromium/WebKit checks of the actual canonical React components. The message wakeup regression also passed after verifying both committed-message routes. Test counts overlap and are not a single end-to-end total. Browser account/API/map dependencies were isolated fixtures; no real member messages or provider sends were performed.

Production release continues through GitHub Desktop history operations and the existing guarded `npm run deploy:production` command from clean main equal to origin/main. Physical iPhone receipt of Push and real Shots storage/cleanup remain separate acceptance steps. A saved legacy Crew page may remain the restored route; tapping the middle Smart destination opens the new combined `/search?smart=1` entry.
