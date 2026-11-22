import test from "node:test";
import assert from "node:assert/strict";
import { nativeInboxConversations, nativeInboxCursor, nativeInboxPageURL, nativeInboxPreview } from "./native-inbox-conversations.ts";

const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222", g = "33333333-3333-4333-8333-333333333333";
const rows = [
  { id: a, kind: "direct", sender_id: "owner", receiver_id: "friend-a", otherName: "Anna" },
  { id: b, kind: "direct", receiver_id: "owner", sender_id: "friend-b", otherName: "Bert" },
  { id: g, kind: "group", otherName: "Kamerateam" },
];
const friends = [{ user_id: "friend-a", is_favorite: true }, { user_id: "friend-b", is_favorite: false }];
test("pagination retains the server time and UUID pair, rejecting invalid or partial cursors", () => {
  const value = { before: "2026-11-22T16:00:00.000Z", before_id: a };
  assert.deepEqual(nativeInboxCursor(value), value);
  const url = new URL(nativeInboxPageURL(value), "https://example.invalid");
  assert.equal(url.pathname, "/api/conversations");
  assert.equal(url.searchParams.get("before"), value.before);
  assert.equal(url.searchParams.get("before_id"), a);
  for (const invalid of [null, "arbitrary", { before: "not-a-date", before_id: a }, { before: value.before }, { ...value, before_id: "other" }]) assert.equal(nativeInboxCursor(invalid), null);
});
test("HOMIES shows existing favorite conversations while colleagues retain all accepted contacts", () => {
  assert.deepEqual(nativeInboxConversations(rows, friends, "owner", "homies", "", "de").map(row => row.id), [a]);
  assert.deepEqual(nativeInboxConversations(rows, friends, "owner", "colleagues", "", "de").map(row => row.id), [a, b]);
  assert.deepEqual(nativeInboxConversations(rows, friends, "owner", "groups", "", "de").map(row => row.id), [g]);
});
test("a changed account or removed relationship cannot reuse previous direct-chat classifications", () => {
  assert.deepEqual(nativeInboxConversations(rows, friends, "different-account", "homies", "", "de"), []);
  assert.deepEqual(nativeInboxConversations(rows, [], "owner", "colleagues", "", "de"), []);
  assert.deepEqual(nativeInboxConversations(rows, [{ user_id: "friend-a" }], "owner", "homies", "", "de"), []);
});
test("search respects the category and malformed conversation destinations never become buttons", () => {
  assert.deepEqual(nativeInboxConversations([...rows, { ...rows[0], id: "javascript:invalid" }], friends, "owner", "homies", " ANNA ", "de").map(row => row.id), [a]);
  assert.deepEqual(nativeInboxConversations(rows, friends, "owner", "groups", "anna", "de"), []);
});
test("the visible preview uses the most recent dated message and is bounded without changing source", () => {
  const item = { messages: [{ content: "newest ".repeat(70), created_at: "2026-11-22T16:00:00Z" }, { content: "old", created_at: "2026-11-21T16:00:00Z" }, { content: "invalid", created_at: "bad" }] };
  const before = structuredClone(item);
  assert.equal(nativeInboxPreview(item).length, 240);
  assert.ok(nativeInboxPreview(item).startsWith("newest"));
  assert.deepEqual(item, before);
  assert.equal(nativeInboxPreview({ messages: [] }), "");
});
