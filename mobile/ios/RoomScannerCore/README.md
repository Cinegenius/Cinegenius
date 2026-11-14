# Native floor plan core

Run `swift test --package-path mobile/ios/RoomScannerCore --jobs 2` from the repository root. Foundation-only source files are also explicit App target references. Do not edit the generated CapApp-SPM package.

Both the normal App launch and the Arbeitsplatz quick action require CineGenius sign-in. A valid WebKit session is restored through the existing server sign-in page. The workplace uses authenticated existing-location data, scoped to the current owner. No session token or plan is sent through the page's workplace message handler.

Schema 2 adds account/location IDs, metre-based plan objects and a revision. Existing unbound schema-1 files remain readable and preserved in their original archive, without automatic account assignment. New per-account archives use a SHA256 account directory. `save` is an idempotent immutable create; `update(replacing:)` atomically compares the exact expected record and preserves source geometry, captured source bytes, origin and creation date. Conflicts/write failures preserve the last saved file. Names/objects and history never modify RoomPlan geometry.

`PlanTransform` provides reversible world/screen transforms, independent of content. `PlanEditHistory` validates edits and keeps bounded undo/redo history. `AppAuthenticationPolicy` restricts the Clerk top-level navigation exception to its exact HTTPS handshake endpoint. `WorkplaceOriginPolicy` still restricts native entry to the configured CineGenius origin/main frame.

Archive/export files retain restrictive permissions and Apple backup exclusion, with iOS FileProtection.complete. Linux tests check geometry, authorization projections, atomic storage and POSIX permissions; Apple backup-exclusion assertions run only on Apple platforms. Native camera, Face ID, locked-device data protection, PDF rendering, gesture recognizers, WebKit persistence and sign-in need macOS/iOS verification.

Prepare generated resources with `npm --prefix mobile run prepare:preview`, sync iOS, then build the existing App or CineGenius Arbeitsplatz Debug scheme. Keep the release guard, existing bundle ID, local signing settings and installed data container. The 3D export remains the original sensor model; PDF includes 2D planning objects.
