import test from "node:test";
import assert from "node:assert/strict";
import {
  getUnreadCountSnapshot,
  publishUnreadCount,
  subscribeToUnreadCount,
} from "./unread-count-store.ts";

test("personal navigation unread badges are current-user scoped and deduplicated", () => {
  publishUnreadCount("user-a", 3);
  assert.equal(getUnreadCountSnapshot("user-a"), 3);
  assert.equal(getUnreadCountSnapshot("user-b"), 0);

  let notifications = 0;
  const unsubscribe = subscribeToUnreadCount(() => { notifications += 1; });
  try {
    publishUnreadCount("user-a", 3);
    assert.equal(notifications, 0);

    publishUnreadCount("user-a", 2);
    assert.equal(notifications, 1);
    assert.equal(getUnreadCountSnapshot("user-a"), 2);

    publishUnreadCount("user-b", 5);
    assert.equal(notifications, 2);
    assert.equal(getUnreadCountSnapshot("user-a"), 0);
    assert.equal(getUnreadCountSnapshot("user-b"), 5);
  } finally {
    unsubscribe();
    publishUnreadCount(null, 0);
  }
});
