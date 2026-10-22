type Listener = () => void;

let unreadSnapshot: { userId: string | null; count: number } = { userId: null, count: 0 };
const listeners = new Set<Listener>();

export function getUnreadCountSnapshot(userId: string | null) {
  return unreadSnapshot.userId === userId ? unreadSnapshot.count : 0;
}

export function getUnreadCountServerSnapshot() {
  return 0;
}

export function subscribeToUnreadCount(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishUnreadCount(userId: string | null, count: number) {
  const nextCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (userId === unreadSnapshot.userId && nextCount === unreadSnapshot.count) return;
  unreadSnapshot = { userId, count: nextCount };
  listeners.forEach((listener) => listener());
}
