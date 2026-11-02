/**
 * Conservative fallback refreshes for message surfaces.
 *
 * User actions, focus/visibility changes and read events refresh immediately.
 * These intervals only keep an already-open page reasonably fresh when no
 * event is available, without making every mounted surface poll rapidly.
 */
export const INBOX_FALLBACK_REFRESH_MS = 60_000;
export const CONVERSATION_LIST_FALLBACK_REFRESH_MS = 30_000;
export const ACTIVE_CONVERSATION_FALLBACK_REFRESH_MS = 8_000;
export const DASHBOARD_MESSAGES_FALLBACK_REFRESH_MS = 30_000;
