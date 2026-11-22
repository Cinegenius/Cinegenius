import { lockBodyScroll } from "./body-scroll-lock";

export type NativeContentViewport = { top: number; height: number };
export type NativeContentRegion = { top: number; bottom: number; height: number; clearance: number };

const bounded = (value: number, fallback = 0) => Number.isFinite(value) ? Math.max(0, value) : fallback;

/** Paint/scroll through the visible viewport. Control clearance belongs to the
 * trailing content padding, independently of the launcher's draggable position. */
export function nativeAppContentRegion(viewport: NativeContentViewport, headerBottom: number | null, safeTop: number, safeBottom: number): NativeContentRegion {
  const visibleTop = bounded(viewport.top);
  const visibleBottom = visibleTop + bounded(viewport.height);
  const header = headerBottom !== null && Number.isFinite(headerBottom) ? headerBottom + 12 : visibleTop + bounded(safeTop) + 80;
  const top = Math.min(visibleBottom, Math.max(visibleTop + 12, header));
  return { top, bottom: visibleBottom, height: visibleBottom - top, clearance: bounded(safeBottom) + 160 };
}

/** Computed scroll padding describes the unobscured part of the larger canvas.
 * Clamp very short keyboard/rotation viewports instead of inventing space. */
export function nativeContentUnobscuredRegion(area: { top: number; bottom: number }, paddingTop: number, paddingBottom: number) {
  const bottom = Math.max(area.top, area.bottom);
  const top = Math.min(bottom, area.top + bounded(paddingTop));
  return { top, bottom: Math.max(top, bottom - bounded(paddingBottom)) };
}

export function nativeContentFocusDelta(field: { top: number; bottom: number }, region: { top: number; bottom: number }, gap = 8): number {
  const top = region.top + gap, bottom = Math.max(top, region.bottom - gap);
  if (field.bottom - field.top > bottom - top || field.top < top) return field.top - top;
  return field.bottom > bottom ? field.bottom - bottom : 0;
}

/** Geometry only: no navigation, account data, storage, or launcher positioning. */
export function installNativeAppContentRegion(content: HTMLElement): () => void {
  const html = document.documentElement;
  const properties = ["--cg-app-content-top", "--cg-app-content-height", "--cg-app-content-bottom", "--cg-app-content-clearance"] as const;
  const previous = properties.map(name => ({ value: html.style.getPropertyValue(name), priority: html.style.getPropertyPriority(name) }));
  const written = new Map<string, string>();
  const insets = document.createElement("div");
  insets.setAttribute("aria-hidden", "true");
  insets.setAttribute("data-native-content-insets", "true");
  Object.assign(insets.style, {
    position: "fixed", width: "0", height: "0", visibility: "hidden", pointerEvents: "none",
    paddingTop: "var(--cg-app-safe-top,env(safe-area-inset-top,0px))",
    paddingBottom: "var(--mobile-safe-area-height,var(--cg-app-safe-bottom,env(safe-area-inset-bottom,0px)))",
  });
  document.body.append(insets);
  let frame = 0, closed = false, focusRequested = false, scrollLocked = false;
  let header: HTMLElement | null = null;
  let lastContentFocus = document.activeElement instanceof HTMLElement && content.contains(document.activeElement) ? document.activeElement : null;
  let restoreModalFocus: HTMLElement | null = null;
  let activeModal: HTMLElement | undefined;
  const overflow = { value: content.style.getPropertyValue("overflow-y"), priority: content.style.getPropertyPriority("overflow-y") };
  const inertBackground = new Set<HTMLElement>();
  const restoreOverflow = () => {
    if (content.style.getPropertyValue("overflow-y") !== "hidden") return;
    if (overflow.value) content.style.setProperty("overflow-y", overflow.value, overflow.priority);
    else content.style.removeProperty("overflow-y");
  };
  const syncModalLock = () => {
    const locked = document.body.style.overflow === "hidden";
    const modal = locked ? Array.from(document.querySelectorAll<HTMLElement>('dialog[open],[aria-modal="true"]')).filter(node =>
      !node.hasAttribute("data-native-header-utility") && node.getClientRects().length > 0).at(-1) : undefined;
    const returningModal = activeModal && !activeModal.isConnected && modal;
    activeModal = modal;
    if (locked && !scrollLocked) content.style.setProperty("overflow-y", "hidden", "important");
    if (!locked && scrollLocked) restoreOverflow();
    scrollLocked = locked;
    const targets = new Set<HTMLElement>();
    if (modal && !modal.matches(":modal")) {
      // A portal can inert the whole page. A dialog within main must keep its
      // own ancestor branch usable, so only its background siblings are inert.
      // Native showModal already supplies background inertness itself.
      if (!content.contains(modal)) targets.add(content);
      else for (let branch: HTMLElement = modal; branch !== content && branch.parentElement; branch = branch.parentElement) {
        for (const sibling of branch.parentElement.children) if (sibling instanceof HTMLElement && sibling !== branch) targets.add(sibling);
      }
    }
    for (const node of inertBackground) if (!targets.has(node)) { node.inert = false; inertBackground.delete(node); }
    for (const node of targets) if (!node.inert) {
      if (!inertBackground.size) restoreModalFocus = lastContentFocus;
      node.inert = true; inertBackground.add(node);
    }
    if (returningModal && document.activeElement === document.body && !returningModal.closest("[inert]")) {
      returningModal.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]')?.focus({ preventScroll: true });
    }
    if (!locked && !inertBackground.size && restoreModalFocus) {
      // Existing custom dialogs return focus synchronously, before our observer
      // releases their background. Retry only when that attempt fell to body.
      const target = restoreModalFocus, active = document.activeElement;
      restoreModalFocus = null;
      if ((!active || active === document.body || active === html || !active.isConnected) && target.isConnected && !target.closest("[inert]")) target.focus({ preventScroll: true });
    }
  };
  const readInsets = () => {
    const style = getComputedStyle(insets);
    return { top: Number.parseFloat(style.paddingTop) || 0, bottom: Number.parseFloat(style.paddingBottom) || 0 };
  };
  const revealFocus = () => {
    const field = document.activeElement;
    if (scrollLocked || !(field instanceof HTMLElement) || !content.contains(field) || field.closest('dialog[open],[aria-modal="true"],[data-native-browse-toolbar]')) return;
    const area = content.getBoundingClientRect();
    if (area.height <= 16) return;
    const style = getComputedStyle(content);
    let padding = Math.max(8, Number.parseFloat(style.scrollPaddingTop) || Number.parseFloat(style.paddingTop) || 0);
    const paddingBottom = Math.max(8, Number.parseFloat(style.scrollPaddingBottom) || Number.parseFloat(style.paddingBottom) || 0);
    const anchor = content.querySelector<HTMLElement>("[data-native-browse-anchor]");
    const rail = anchor?.querySelector<HTMLElement>("[data-native-browse-toolbar]");
    if (anchor && rail && anchor.getBoundingClientRect().top < area.top) padding = Math.max(padding, rail.getBoundingClientRect().height + 12);
    const unobscured = nativeContentUnobscuredRegion(area, padding, paddingBottom);
    const delta = nativeContentFocusDelta(field.getBoundingClientRect(), unobscured, 0);
    if (delta) content.scrollTop += delta;
  };
  const update = () => {
    frame = 0;
    if (closed || !content.isConnected) return;
    syncModalLock();
    const nextHeader = document.querySelector<HTMLElement>('header[data-native-app-navbar="v1"]');
    if (nextHeader !== header) {
      if (header) resize.unobserve(header);
      header = nextHeader;
      if (header) resize.observe(header);
    }
    const safe = readInsets(), viewport = window.visualViewport;
    const box = header?.getBoundingClientRect();
    const region = nativeAppContentRegion({ top: viewport?.offsetTop ?? 0, height: viewport?.height ?? window.innerHeight }, box && box.height > 0 ? box.bottom : null, safe.top, safe.bottom);
    const values = [region.top, region.height, region.bottom, region.clearance];
    let geometryChanged = false;
    properties.forEach((name, index) => {
      const value = `${Math.round(values[index] * 100) / 100}px`;
      if (written.get(name) !== value) geometryChanged = true;
      written.set(name, value);
      if (html.style.getPropertyValue(name) !== value) html.style.setProperty(name, value);
    });
    if (focusRequested || geometryChanged) revealFocus();
    focusRequested = false;
  };
  const schedule = () => { if (!closed && !frame) frame = requestAnimationFrame(update); };
  const focusOrViewport = () => { focusRequested = true; schedule(); };
  const contentFocus = (event: FocusEvent) => {
    if (!scrollLocked && document.body.style.overflow !== "hidden" && event.target instanceof HTMLElement) lastContentFocus = event.target;
    focusOrViewport();
  };
  const contentBlur = (event: FocusEvent) => {
    if (document.body.style.overflow !== "hidden" && !(event.relatedTarget instanceof Node && content.contains(event.relatedTarget))) lastContentFocus = null;
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(content);
  const rootChanges = new MutationObserver(schedule);
  rootChanges.observe(html, { attributes: true, attributeFilter: ["style"] });
  const bodyChanges = new MutationObserver(schedule);
  bodyChanges.observe(document.body, { attributes: true, attributeFilter: ["style"] });
  const children = new MutationObserver(schedule);
  children.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "aria-modal"] });
  window.addEventListener("resize", focusOrViewport);
  window.addEventListener("orientationchange", focusOrViewport);
  window.visualViewport?.addEventListener("resize", focusOrViewport);
  window.visualViewport?.addEventListener("scroll", focusOrViewport);
  content.addEventListener("focusin", contentFocus);
  content.addEventListener("focusout", contentBlur);
  update();
  return () => {
    closed = true;
    cancelAnimationFrame(frame);
    resize.disconnect(); rootChanges.disconnect(); bodyChanges.disconnect(); children.disconnect();
    window.removeEventListener("resize", focusOrViewport);
    window.removeEventListener("orientationchange", focusOrViewport);
    window.visualViewport?.removeEventListener("resize", focusOrViewport);
    window.visualViewport?.removeEventListener("scroll", focusOrViewport);
    content.removeEventListener("focusin", contentFocus);
    content.removeEventListener("focusout", contentBlur);
    if (scrollLocked) restoreOverflow();
    for (const node of inertBackground) node.inert = false;
    insets.remove();
    properties.forEach((name, index) => {
      if (html.style.getPropertyValue(name) !== written.get(name)) return;
      if (previous[index].value) html.style.setProperty(name, previous[index].value, previous[index].priority);
      else html.style.removeProperty(name);
    });
  };
}


/** App-only lifecycle for the existing custom modal surfaces. */
export function installNativeAppModalLock(dialog: HTMLElement, onDismiss: () => void): () => void {
  const previousFocus = document.activeElement;
  const unlock = lockBodyScroll();
  const previousMarker = dialog.getAttribute("data-native-app-modal");
  dialog.setAttribute("data-native-app-modal", "v1");
  const overlay = dialog.parentElement;
  const styles = overlay ? [[overlay, "top"], [overlay, "height"], [overlay, "bottom"], [dialog, "max-height"]] as const : [];
  const previousStyles = styles.map(([node, name]) => ({ value: node.style.getPropertyValue(name), priority: node.style.getPropertyPriority(name) }));
  const written = new Map<string, string>();
  const viewport = window.visualViewport;
  const position = () => {
    if (!overlay) return;
    const height = Math.max(0, (viewport?.height ?? window.innerHeight) - 24);
    const values = [`${(viewport?.offsetTop ?? 0) + 12}px`, `${height}px`, "auto", `${height}px`];
    styles.forEach(([node, name], index) => { node.style.setProperty(name, values[index]); written.set(name, values[index]); });
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && dialog.contains(focused)) {
      const delta = nativeContentFocusDelta(focused.getBoundingClientRect(), dialog.getBoundingClientRect());
      if (delta) dialog.scrollTop += delta;
    }
  };
  const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]'))
    .filter(node => !node.closest('[hidden],[inert]') && node.getClientRects().length > 0);
  const key = (event: KeyboardEvent) => {
    if (event.defaultPrevented || !(event.target instanceof Node) || !dialog.contains(event.target)) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onDismiss(); }
    if (event.key !== "Tab") return;
    const available = controls();
    if (!available.length) return;
    event.preventDefault();
    const current = available.indexOf(document.activeElement as HTMLElement);
    const index = current < 0 ? (event.shiftKey ? available.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + available.length) % available.length;
    available[index].focus({ preventScroll: true });
  };
  // Nested selectors get their existing React Escape handler first.
  document.addEventListener("keydown", key);
  viewport?.addEventListener("resize", position); viewport?.addEventListener("scroll", position);
  window.addEventListener("resize", position); dialog.addEventListener("focusin", position);
  position();
  controls()[0]?.focus({ preventScroll: true });
  return () => {
    document.removeEventListener("keydown", key);
    viewport?.removeEventListener("resize", position); viewport?.removeEventListener("scroll", position);
    window.removeEventListener("resize", position); dialog.removeEventListener("focusin", position);
    styles.forEach(([node, name], index) => {
      if (node.style.getPropertyValue(name) !== written.get(name)) return;
      if (previousStyles[index].value) node.style.setProperty(name, previousStyles[index].value, previousStyles[index].priority);
      else node.style.removeProperty(name);
    });
    if (dialog.getAttribute("data-native-app-modal") === "v1") {
      if (previousMarker === null) dialog.removeAttribute("data-native-app-modal");
      else dialog.setAttribute("data-native-app-modal", previousMarker);
    }
    unlock();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  };
}
