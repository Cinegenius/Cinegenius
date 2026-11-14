# Native floor plan core

Run `swift test --package-path mobile/ios/RoomScannerCore --jobs 2` from the repository root. The Foundation-only geometry/archive/origin sources are also explicit source references in the iOS App target. No manual change to the Capacitor-generated CapApp-SPM package is needed.

The separate shared scheme **CineGenius Arbeitsplatz** runs the existing Debug App with `--cinegenius-workplace`; the normal App scheme keeps the existing website entry. The old `--cinegenius-room-scanner` argument remains an alias. No release guard is removed. Resource generation and `cap sync ios` must run before building, including the nine `NativeStrings` InfoPlist variants and `public/native-room-scanner` JSON resources.

Each saved room is an immutable UUID-named JSON file, atomically committed with schemaVersion 1. Optional CapturedRoom Codable data is stored in the same transaction, contains no camera images, and is deterministically encoded once for retries. Older records without that optional data retain their 2D plan. Examples keep their source marker in storage and every PDF page and cannot produce a sensor model. A repeated identical save is idempotent; a conflicting overwrite fails and preserves the existing record. There is no account, server identifier or cloud sync in this format.

Archive and export directories exclude backups; files use restrictive permissions and iOS FileProtection.complete. Archive access is gated in the native model by deviceOwnerAuthentication and re-locked on background. A passive privacy window covers the app's own sheets while inactive; system authentication remains separate. Share files remain protected until activity completion/dismissal and are removed afterward or on next workplace startup after interruption. Never purge a live share transfer on background.

Straight RoomPlan surfaces project their transformed local X endpoints onto X/Z, retaining orientation and metric lengths. Curved, non-finite, empty or degenerate geometry is rejected rather than replaced with invented straight walls. Open plans remain open. Drawing bounds are for uniform fitting only; no room area is inferred. PDF scale is reported for 100% printing and all dimensions remain estimates requiring site verification.

LiDAR capture, camera permission/restriction, genuine interruptions, Face ID/passcode strength and data protection on a locked physical iPhone require a real-device check. Simulator example rendering and Foundation tests do not establish sensor or physical-device success.
