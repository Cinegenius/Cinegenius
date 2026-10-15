# CineGenius shared design and production release path

## Design reference

The current `/projects` page is the source of truth for public directory design. Its cinematic backdrop, compact header, lime emphasis, dark surfaces, restrained borders, centered content width, and primary navigation order should carry across Locations, Marktplatz, Crew, Firmen, and Jobs. Page-specific filters, listings, map controls, and empty states remain specific to their purpose.

Use `components/PageHeader.tsx` for page headers and its exported backdrop helper for any page that intentionally extends the image beyond the header. `app/globals.css` owns shared width and surface values: `--site-content-max`, responsive gutters, `site-container`, `browse-toolbar`, and `browse-card`. Keep filters and result lists on the solid background; don’t extend the cinematic image behind them unless the `/projects` reference does so. The former `CategoryHero` component was removed after its remaining routes were migrated.

Desktop and mobile navigation use the same order: Locations, Crew, Jobs, Marktplatz, Projekte, Firmen. Keep `components/Navbar.tsx` and `components/BottomNav.tsx` aligned when editing navigation.

## Design regression checks

Run `npm run check:design` before each release. It verifies that all six public areas still use `PageHeader`, the desktop and mobile navigation have the same destinations in the same order, the shared page-width and solid-toolbar styles remain present, and the removed `CategoryHero` layout has not returned. The production release script runs this check automatically.

For visual review, capture `/projects`, `/locations`, `/props`, `/creators`, `/companies`, and `/jobs` at identical 390×844, 768×1024, and 1366×900 viewports. Compare each area beside `/projects` at that same size, checking the header, page width, toolbar surface, first card row, and fixed mobile navigation. Also open each route directly, reload it, then navigate across areas. Review both signed-out and signed-in navigation when an authenticated test session is available; production data must not be altered for these checks.

## Production source and release

- Canonical Git source: `origin/main` in the CineGenius repository.
- The production Vercel project is linked locally through the ignored `.vercel/project.json`. Check the linked project and production alias in the Vercel dashboard before a release; keep those account-specific identifiers out of the public repository.
- Vercel automatic production deployment from `main` is disabled in `vercel.json`. This prevents an unreviewed Git integration deployment from replacing production.
- Publish a release only by running `npm run deploy:production` from a clean `main` checkout whose `HEAD` matches `origin/main`. The guarded script checks the branch, clean tree, remote commit, and linked project; then it pulls the linked project's Production settings into the ignored `.vercel` directory, builds for production, and deploys the prebuilt output.
- Never use a dirty working tree, another branch, a stale project folder, or a direct ad hoc `vercel --prod` command for production. The guard is intended to make those recurring snapshot overwrites fail before deployment.

## Cause confirmed during the deployment review

Production had been replaced by manual CLI uploads from dirty or stale local snapshots instead of a single canonical Git commit. Automatic Git production deployment was disabled, so different uploads could replace the live build without being tied to the current `main` commit. The source review found no service worker registration or service-worker asset; it was not the cause of the differing layouts.
