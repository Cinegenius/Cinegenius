<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## CineGenius shared design and production releases

- Treat `/projects` as the visual reference for the public directory areas: Locations, Marktplatz, Crew, Firmen, Jobs, and Projects.
- Use `components/PageHeader.tsx` for public page headers and the shared `site-container`, `browse-toolbar`, and `browse-card` styles in `app/globals.css` for browse layouts. Keep page-specific content and controls, but do not recreate the old `CategoryHero` treatment or introduce one-off accent colors, backdrops, or widths.
- On `/projects`, `/locations`, `/props`, `/creators`, `/companies`, and `/jobs`, use `components/MobileBrowseControls.tsx` for search, sort, category selection, result summary, active filter chips, and the mobile filter panel. Keep all domain-specific filters available inside that panel. The shared mobile/tablet controls remain active below 1280 CSS px; do not restore horizontally scrolling category pills or a separate mobile filter toolbar.
- Keep mobile controls full width, allow long labels to shrink or wrap, use at least 44×44 CSS px touch targets, and keep the filter panel scrollable above the software keyboard and safe-area inset. Reuse the central styles in `app/globals.css` instead of page-specific mobile copies.
- Leave safe-area-aware room for the fixed bottom navigation on mobile and tablets, so the final card or empty-state action can scroll fully above it.
- Keep the homepage's `/hero-bg.jpg` backdrop spanning the full page through the shared `PageBackdrop`; maintain readable text with a restrained dark overlay instead of limiting the image to the hero.
- Keep browse filters and results on the solid page surface; the cinematic image belongs in the shared page header (the Projects root may extend it across its category grid as the reference does).
- Keep the desktop primary navigation in the same order as `components/BottomNav.tsx`.
- Do not add or re-enable advertising inventory anywhere on the public site: no banners, ad slots, placeholders, booking buttons, advertising inquiry links, or reserved space. This restriction applies at every viewport and remains in force unless the user explicitly asks to add or re-enable advertising.
- Production releases must go through `npm run deploy:production` from a clean `main` checkout whose commit exactly matches `origin/main` and the linked CineGenius Vercel project. Do not run ad hoc `vercel --prod` uploads or auto-commit deploy scripts.
- See `docs/design-and-release.md` for the reference rules, deployment project and release procedure.
