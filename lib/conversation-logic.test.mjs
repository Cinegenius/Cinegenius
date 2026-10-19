import test from "node:test";
import assert from "node:assert/strict";
import {
  activeMemberFor,
  canManageGroup,
  canReadMessageForMember,
  countUnreadForMember,
  mergeMessagesById,
  normalizeMemberIds,
} from "./conversation-logic.ts";

const members = [
  { user_id: "a", role: "admin", joined_at: "2026-10-01T10:00:00.000Z", left_at: null },
  { user_id: "b", role: "member", joined_at: "2026-10-02T10:00:00.000Z", left_at: null },
  { user_id: "c", role: "member", joined_at: "2026-10-01T10:00:00.000Z", left_at: "2026-10-03T10:00:00.000Z" },
];

test("group authorization is limited to active members and admins", () => {
  assert.equal(activeMemberFor(members, "a")?.role, "admin");
  assert.equal(canManageGroup(members, "a"), true);
  assert.equal(canManageGroup(members, "b"), false);
  assert.equal(activeMemberFor(members, "c"), undefined);
});

test("members only see messages from their current join boundary", () => {
  const joined = activeMemberFor(members, "b");
  assert.equal(canReadMessageForMember({ created_at: "2026-10-01T11:00:00.000Z" }, joined), false);
  assert.equal(canReadMessageForMember({ created_at: "2026-10-02T10:00:00.000Z" }, joined), true);
  assert.equal(canReadMessageForMember({ created_at: "2026-10-02T10:00:00.000Z" }, activeMemberFor(members, "c")), false);
});

test("unread counts are per member, incoming-only, read-receipt aware and duplicate safe", () => {
  const messages = [
    { id: "old", sender_id: "a", created_at: "2026-10-01T12:00:00.000Z" },
    { id: "new-1", sender_id: "a", created_at: "2026-10-02T12:00:00.000Z" },
    { id: "new-2", sender_id: "b", created_at: "2026-10-02T13:00:00.000Z" },
    { id: "new-3", sender_id: "a", created_at: "2026-10-02T14:00:00.000Z" },
    { id: "new-4", sender_id: "b", created_at: "2026-10-02T15:00:00.000Z" },
  ];
  assert.equal(countUnreadForMember([...messages, messages[1]], activeMemberFor(members, "b"), "b", new Set(["new-1"])), 1);
  assert.equal(countUnreadForMember(messages, activeMemberFor(members, "a"), "a", new Set()), 2);
  assert.equal(countUnreadForMember(messages, activeMemberFor(members, "c"), "c", new Set()), 0);
});

test("member selection deduplicates and excludes the current user", () => {
  assert.deepEqual(normalizeMemberIds("me", ["other", "other", "me", " "]), ["other"]);
  assert.equal(normalizeMemberIds("me", ["valid", 42]), null);
});

test("message merges sort chronologically without duplicating replayed events", () => {
  const older = { id: "a", sender_id: "x", created_at: "2026-10-01T10:00:00.000Z", content: "old" };
  const newer = { id: "b", sender_id: "y", created_at: "2026-10-01T11:00:00.000Z", content: "new" };
  const merged = mergeMessagesById([newer], [older, { ...newer, content: "new updated" }]);
  assert.deepEqual(merged.map((message) => message.id), ["a", "b"]);
  assert.equal(merged[1].content, "new updated");
});

test("a delayed stale snapshot does not undo a persisted read receipt", () => {
  const read = { id: "m1", sender_id: "b", created_at: "2026-10-01T10:00:00.000Z", read_at: "2026-10-01T10:01:00.000Z" };
  const stale = { ...read, read_at: null };
  assert.equal(mergeMessagesById([read], [stale])[0].read_at, read.read_at);
});

test("group read receipts from different members merge idempotently", () => {
  const original = { id: "m1", sender_id: "a", created_at: "2026-10-01T10:00:00.000Z", read_by: ["b"] };
  const next = { ...original, read_by: ["c"] };
  assert.deepEqual(mergeMessagesById([original], [next])[0].read_by, ["b", "c"]);
});
