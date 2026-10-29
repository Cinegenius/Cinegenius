# Messages: browser Back/Forward — 2026-10-29

## Cause

The colleague's video shows the conversation list, an opened conversation, and Safari Back leaving CineGenius for the previously visited external site. Opening a conversation only updated component state, so no conversation entry existed in browser history. In addition, changing `?to` reset the whole account's contact list and in-memory message drafts.

## Change

- `lib/message-navigation.ts` records real conversation selections with Next's native History integration. Back and Forward update the selected conversation through `useSearchParams`. Re-selecting the current conversation adds no duplicate entry.
- `app/messages/page.tsx` follows URL selection and clears private state only on account changes. Contact loading no longer displays a premature zero count. Existing in-memory unsent drafts survive list/chat and chat/chat traversal.
- Resolving a recipient into a conversation, including first-send success, replaces that same entry rather than adding a redundant step. Company contact context is retained.
- The conversation Back action follows one existing internal step; on a directly opened conversation without such a step it replaces the current URL with the message list. Native browser Back from a direct external deep link remains normal browser behavior. No sentinel entries are inserted.
- History contains only account/routing identifiers; message bodies, contact rows and authentication material are not stored there. Server authorization and message persistence are unchanged.
- Back/contact status labels are included in all six existing language catalogs.

## Verification actually completed

- 814 repository tests passed, including six new navigation tests and existing message access/action tests. The focused navigation/message run passed 33/33.
- TypeScript passed. Production build and its i18n check passed (six catalogs, 1,797 keys). `git diff --check` passed.
- ESLint of the affected source reports two pre-existing `set-state-in-effect` findings in account reset and group-search reset. The original file reported six findings. No new finding remains; no broad lint-rule change was made.
- Browser testing used the actual changed messages component inside an isolated Next 16.4.3 fixture with its real router and next-intl provider. Clerk identity and API responses were controlled, fictitious local fixtures; no production member received a message.
- Desktop: list → Anna chat → native Back to list → Forward to chat, with unsent text preserved; Anna → Carla → in-app Back to Anna; next Back to list.
- New contact: list → Ben recipient → first local fixture send → conversation URL; native Back returned directly to list and Forward to the conversation, without a redundant recipient step.
- Direct conversation URL: opened the requested conversation; in-app Back closed it to the list.
- Simulated 390 px phone: list → chat → native Back → list → Forward → chat, with unsent text restored. A second Back from the list returned to the preceding fixture page.
- Simulated 820 px tablet: list and chat controls visually checked. Desktop viewport was 1280 px. Screenshots saved outside the repository in the task's visualization folder.

## Limits / release state

No physical iPhone/Safari or Android device test was performed. The local API fixture demonstrates navigation integration, not a new production message-delivery test. Unsent text is retained in the existing account-scoped in-memory map during this page's lifetime; reload/logout does not gain new draft persistence. No database change is required. This change is local and has not been deployed.
