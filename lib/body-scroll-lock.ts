type ScrollLock = { overflow: string; holders: Set<symbol> };
const locks = new WeakMap<HTMLElement, ScrollLock>();

/** Nested surfaces may unmount in either order; only the final owner restores scrolling. */
export function lockBodyScroll() {
  const body = document.body;
  let lock = locks.get(body);
  if (!lock) {
    lock = { overflow: body.style.overflow, holders: new Set() };
    locks.set(body, lock);
  }
  const token = Symbol();
  lock.holders.add(token);
  body.style.overflow = "hidden";
  return () => {
    if (!lock.holders.delete(token) || lock.holders.size) return;
    body.style.overflow = lock.overflow;
    locks.delete(body);
  };
}
