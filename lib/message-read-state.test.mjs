import test from "node:test";
import assert from "node:assert/strict";
import {
  applyParticipantReadReceipts,
  applyReadReceiptTimestamps,
  incomingUnreadMessageIds,
  unreadIncomingMessageCount,
} from "./message-read-state.ts";

const currentUser = "user-a";
const otherUser = "user-b";
const messages = [
  { id: "incoming-1", sender_id: otherUser, read_at: null },
  { id: "incoming-2", sender_id: otherUser, read_at: "2026-10-16T10:00:00.000Z" },
  { id: "outgoing-1", sender_id: currentUser, read_at: null },
];

test("unread count includes only distinct, incoming, unread messages", () => {
  assert.equal(unreadIncomingMessageCount([...messages, messages[0]], currentUser), 1);
  assert.deepEqual(incomingUnreadMessageIds(messages, currentUser), ["incoming-1"]);
});

test("read receipts are scoped to the participant who read the message", () => {
  const forReader = applyParticipantReadReceipts(
    messages,
    [{ message_id: "incoming-1", user_id: currentUser, read_at: "2026-10-17T08:00:00.000Z" }],
    currentUser,
    otherUser,
  );
  assert.equal(forReader[0].read_at, "2026-10-17T08:00:00.000Z");

  const receiptForSenderDoesNotMarkTheReceiverAsRead = applyParticipantReadReceipts(
    messages,
    [{ message_id: "incoming-1", user_id: otherUser, read_at: "2026-10-17T08:00:00.000Z" }],
    currentUser,
    otherUser,
  );
  assert.equal(receiptForSenderDoesNotMarkTheReceiverAsRead[0].read_at, null);

  const messageFromCurrentUser = [{ id: "incoming-from-a", sender_id: currentUser, read_at: null }];
  const otherUserReceipt = applyParticipantReadReceipts(
    messageFromCurrentUser,
    [{ message_id: "incoming-from-a", user_id: otherUser, read_at: "2026-10-17T08:00:00.000Z" }],
    otherUser,
    currentUser,
  );
  assert.equal(otherUserReceipt[0].read_at, "2026-10-17T08:00:00.000Z");
});

test("a concurrent new message is not included in a previous read snapshot", () => {
  const snapshot = incomingUnreadMessageIds(messages, currentUser);
  const nowVisible = [...messages, { id: "arrived-during-read", sender_id: otherUser, read_at: null }];
  const read = applyReadReceiptTimestamps(
    nowVisible,
    snapshot.map((id) => ({ id, read_at: "2026-10-17T08:00:00.000Z" })),
  );
  assert.equal(read[0].read_at, "2026-10-17T08:00:00.000Z");
  assert.equal(read.at(-1).read_at, null);
});

test("replaying the same read response stays idempotent", () => {
  const receipt = [{ id: "incoming-1", read_at: "2026-10-17T08:00:00.000Z" }];
  const once = applyReadReceiptTimestamps(messages, receipt);
  const twice = applyReadReceiptTimestamps(once, receipt);
  assert.deepEqual(twice, once);
});
