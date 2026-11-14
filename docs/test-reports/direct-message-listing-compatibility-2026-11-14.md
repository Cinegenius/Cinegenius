# Direct message failure, 14 November 2026

Production text-only chat creation failed with SQLSTATE `42883`: `conversations.listing_id` is a legacy text column, while `start_direct_conversation` takes a UUID parameter. PostgreSQL rejects the comparison even when both values are null, so ordinary new chats were affected as well as listing inquiries. The attachment path already compared both values as text.

`20261114182622_direct_message_listing_compatibility.sql` replaces only the direct-chat function with the same explicit text comparison. It preserves the API, authorization checks, stable send keys, existing conversations, content, memberships, and read receipts. No data conversion or chat merge is needed.

Verification:

- 75 targeted messaging/API/database/UI tests passed (71 in the combined run, four application tests rerun after their fixture was updated to the new privacy-visible listing view).
- The SQL suite now uses production's text listing column by default, and tests both text and UUID schemas. General and listing chats stay distinct; matching and reverse-party replies reuse the right chat; repeated send keys confirm the same message; existing chats, groups, attachments, consent, blocks, and read receipts retain their checks.
- The exact production failure was reproduced in a rollback-only transaction. With the patch, that same path confirmed a conversation and message; the transaction was rolled back. No message or notification was delivered.
- The paired privacy migration also passed a rollback-only production check: existing profile, offer, media, message and read-receipt fingerprints stayed unchanged, default visibility was preserved, and public client permissions remained denied.

Apply the committed migration on the linked production database before reporting the correction live. The website uses the guarded main-branch release process. Native deployment and a real iPhone send remain separate checks coordinated with APP Entwicklung.
