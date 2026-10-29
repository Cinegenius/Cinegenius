# Homepage mobile loading and manual-only company logos — 29 October 2026

The operator reports an intermittently slow phone load with a completely white window and no Safari error text. Fast desktop/server responses do not prove this phone symptom resolved. Production logs inspected for the preceding deployment contained no runtime errors; warnings about translation environment fallback were present. The symptom was not reproduced on a physical phone.

## Changes

- At the operator's request, removed the automatic logo-demo runtime import, observer/lifecycle setup and demo-only state from `components/HomeCompanyPartners.tsx`. No automatic requestAnimationFrame is scheduled on mount, image load, visibility, reload or browser Back. The previous demonstration helper remains dormant and is not imported into the client component/bundle.
- Kept manual horizontal drag, direction/velocity/coasting, both readable logo faces, scoped click suppression, normal company links, vertical scrolling, reduced motion and real pointer-capture cancellation. CSS, dimensions, hints, company selection and data are unchanged.
- Confirmed an avoidable download: the homepage backdrop sent the entire unoptimized 2,314,433-byte JPEG to phones. Added an opt-in `optimizeImage` to the existing `PageBackdrop` and enabled it only on the homepage. `sizes="100vw"` now permits responsive Next image variants. The fixed viewport, crop, opacity and overlay stay unchanged. Other backdrops preserve their defaults; protected sources still bypass shared optimization through MediaImage. Original files and permission checks are unchanged.

## Verification actually executed

- 27 targeted motion/demo/homepage/image tests passed. The no-autoplay component test executes its effect and invokes image/visibility/resize/remount/pageshow scenarios, while existing manual math, touch-capture and coasting tests remain. The dormant demo scheduler tests remain historical coverage and are not evidence of active autoplay.
- Three responsive-backdrop tests use real Next Image server markup to verify responsive variants, unchanged default rendering and protected-media exclusion.
- Production build/type checks, six-language validation, scoped ESLint and whitespace checks passed. There is no new UI copy. Search of built client chunks found no demo key/`data-logo-demo-id` marker.
- External local fixture renders the actual production components with six fictitious companies. At 390x650, visible logos stayed at `Starts: 0 / active: 0` across separate observations, browser Back and reload. A manual Alpha drag produced a roughly 448-degree coasting transform without navigation. A normal Beta click opened `/companies/beta`; return and reload remained static. No horizontal overflow.
- The phone-width fixture requested `/_next/image?url=%2Fhero-bg.jpg&w=640&q=75` rather than the original. Real local optimizer requests with WebP Accept returned HTTP 200: width640=14,454 bytes, width1200=34,342 bytes (original 2,314,433 bytes). These are measured local variants, not a claim of total page weight or a physical-phone timing benchmark.

## Limits

Automatic rotation is disabled to isolate the reported issue; there is no proof that it caused the white window. The smaller backdrop addresses measured bandwidth cost. Further phone feedback is needed to establish whether the intermittent white window remains. No auth/cache/security rules, user records, messages, uploads or public visibility were changed. No whole-site refactoring or speculative authentication rewrite was introduced.

Evidence in the task visualization directory: `company-logo-manual-only-local.png` plus release/browser proof. Temporary fixture diagnostics are not shipped.
