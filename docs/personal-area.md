# Personal area and inbox

The portrait menu has three destinations plus Sign out. `PersonalAreaHome` groups own profile/offers/bookings/company separately from conversations/contacts/saved items. Analytics remains beside own offers. Saved dashboard links resolve through `dashboardLegacyDestination`; conversation IDs remain encoded and same-host.

Existing profiles edit one section directly and can save without traversing the initial setup assistant. The initial creation assistant is retained. Recovery is private, navigation does not count as an edit, and saving preserves existing validation and publication rules.

Settings use `PersonalSettings`: account/sign-in opens the real Clerk editor after an explicit action; privacy and notification preferences are account scoped; payments reuse invoices. Existing verification document submission remains accessible. Notification preferences require confirmed server values and retain retry/error state.

The inbox shows direct and group conversations together. New message uses one/multiple recipients for direct/group creation. Contacts and notices are secondary destinations, including old bookmarks, without a permanent four-tab navigator. Chat and bell counts use their existing independent read sources. Opening the bell does not acknowledge notices or chat receipts.

Favorites uses one canonical view, current visibility and server-resolved data. Explicit removal is idempotent; failed requests do not remove the visible entry. Private/hidden identities must not leak through saved snapshots. No schema migration is needed for this interface change.

Homepage news uses horizontal pages of three compact stories with dots. At most twelve currently eligible approved stories enter the rail; filters and locale remain authoritative. The page keeps native vertical scrolling. Shared dropdown surfaces are neutral, with fixed selector geometry.

Website changes do not establish native device compatibility. Native follow-up should reuse these destinations, current API permissions, private recovery and all seventeen locale catalogs. The workspace is excluded from this change. Production publication is separate from implementation and must use the existing guarded clean-main release process.
