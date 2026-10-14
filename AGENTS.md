<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## CineGenius shared design and production releases

- Treat `/projects` as the visual reference for the public directory areas: Locations, Marktplatz, Crew, Firmen, Jobs, and Projects.
- Use `components/PageHeader.tsx` for public page headers and the shared `site-container`, `browse-toolbar`, and `browse-card` styles in `app/globals.css` for browse layouts. Keep page-specific content and controls, but do not recreate the old `CategoryHero` treatment or introduce one-off accent colors, backdrops, or widths.
- Keep browse filters and results on the solid page surface; the cinematic image belongs in the shared page header (the Projects root may extend it across its category grid as the reference does).
- Keep the desktop primary navigation in the same order as `components/BottomNav.tsx`.
- Production releases must go through `npm run deploy:production` from a clean `main` checkout whose commit exactly matches `origin/main` and the linked CineGenius Vercel project. Do not run ad hoc `vercel --prod` uploads or auto-commit deploy scripts.
- See `docs/design-and-release.md` for the reference rules, deployment project and release procedure.
