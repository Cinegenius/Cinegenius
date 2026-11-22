import { AUTH_TASK_URLS, isAuthSessionTaskKey } from "./auth-session-tasks";

export const NATIVE_APP_BOOT_READY = "data-native-app-boot-ready";
export type NativeBootSession = "unresolved" | "guest" | "member" | "pending";
type SessionInput = {
  authLoaded: boolean; sessionLoaded: boolean; signedIn: boolean | undefined;
  userId: string | null | undefined; sessionId: string | null | undefined;
  session: { id: string; status: string; user?: { id: string }; currentTask?: { key: string } | null } | null | undefined;
};

/** Presentation readiness only. Native and server routes still verify access. */
export function nativeBootSession(input: SessionInput): NativeBootSession {
  if (!input.authLoaded || !input.sessionLoaded) return "unresolved";
  const session = input.session;
  if (input.signedIn === false && !input.userId && !input.sessionId && !session) return "guest";
  if (input.signedIn && !!input.userId && !!input.sessionId && session?.status === "active"
    && session.id === input.sessionId && session.user?.id === input.userId && !session.currentTask) return "member";
  if (input.signedIn === false && session?.status === "pending" && !!session.currentTask
    && (!input.sessionId || input.sessionId === session.id) && (!input.userId || input.userId === session.user?.id)
    && isAuthSessionTaskKey(session.currentTask.key)) return "pending";
  return "unresolved";
}

let activeClaim: symbol | undefined;
type Options = { pathname: string; session: NativeBootSession; task?: string | null };

/** One current-document signal; no requests, identity exports, timers or navigation. */
export function installNativeAppBootReadiness({ pathname, session, task }: Options): () => void {
  const root = document.documentElement, claim = Symbol();
  activeClaim = claim;
  let closed = false, suspended = false, frame = 0, previous: number[] | null = null;
  const measured = new Set<Element>();
  const watch = (node: Element) => { if (!measured.has(node)) { measured.add(node); resize.observe(node); } };
  const clear = () => { if (activeClaim === claim && root.getAttribute(NATIVE_APP_BOOT_READY) === "v1") root.removeAttribute(NATIVE_APP_BOOT_READY); };
  clear();
  const eligible = () => !closed && activeClaim === claim && !suspended && document.visibilityState !== "hidden"
    && window.top === window.self && location.protocol === "https:" && location.pathname === pathname;
  const visible = (node: Element | null): node is HTMLElement => {
    if (!(node instanceof HTMLElement) || !node.isConnected) return false;
    const style = getComputedStyle(node), box = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility === "visible" && Number(style.opacity) !== 0 && box.width > 0 && box.height > 0;
  };
  const sample = (): number[] | null => {
    if (!eligible() || session === "unresolved") return null;
    const width = window.visualViewport?.width ?? window.innerWidth, height = window.visualViewport?.height ?? window.innerHeight;
    if (!(width > 0 && height > 0)) return null;
    const nodes: HTMLElement[] = [];
    const authRoute = /^\/sign-(in|up)(\/|$)/.test(pathname);
    if (authRoute) {
      // A signed-in credential form is a departing page, not a usable guest view.
      const pendingTask = session === "pending" && task && isAuthSessionTaskKey(task) && pathname === AUTH_TASK_URLS[task];
      if (session !== "guest" && !pendingTask) return null;
      const form = document.querySelector<HTMLElement>('[data-native-auth-ready="v1"]');
      if (!visible(form) || !(Array.from(form.querySelectorAll('input:not([type="hidden"]),select,button')).some(visible)
        || form.getAttribute("data-native-auth-recovery") === "v1" && Array.from(form.querySelectorAll('a[href]')).some(visible))) return null;
      nodes.push(form);
    } else if (pathname === "/profile-setup" || pathname.startsWith("/profile-setup/")) {
      if (session !== "member") return null;
      const setup = document.querySelector<HTMLElement>('[data-native-onboarding-surface="v1"]');
      if (!visible(setup) || !setup.querySelector('h1,[role="alert"]')
        || !Array.from(setup.querySelectorAll('input,button,a[href]')).some(visible)) return null;
      nodes.push(setup);
    } else {
      if (session === "pending" || root.getAttribute("data-cg-native-community-appearance") !== "app") return null;
      const header = document.querySelector<HTMLElement>('header[data-native-app-navbar="v1"]');
      const content = document.querySelector<HTMLElement>('main[data-native-app-surface="v1"]');
      const dock = document.querySelector<HTMLElement>('nav[data-native-app-bottom-nav="v1"][data-native-app-gesture-ready="v1"]');
      for (const node of [header, content, dock]) if (node) watch(node);
      if (!visible(header) || !visible(content) || !visible(dock)) return null;
      const profile = header.querySelector<HTMLButtonElement>('[data-native-app-action="profile"]');
      if (session === "member" && (!profile || profile.disabled)) return null;
      const measuredTop = Number.parseFloat(root.style.getPropertyValue("--cg-app-content-top"));
      const measuredHeight = Number.parseFloat(root.style.getPropertyValue("--cg-app-content-height"));
      if (!Number.isFinite(measuredTop) || !Number.isFinite(measuredHeight) || measuredHeight <= 0) return null;
      const contentBox = content.getBoundingClientRect();
      if (getComputedStyle(content).position !== "fixed" || Math.abs(contentBox.top - measuredTop) > .5 || Math.abs(contentBox.height - measuredHeight) > .5) return null;
      const terminalError = content.querySelector<HTMLElement>('[data-native-route-error="v1"]');
      const recoveryReady = visible(terminalError) && !!terminalError.querySelector('h1,[role="alert"]')
        && Array.from(terminalError.querySelectorAll('button,a[href]')).some(visible);
      if (!recoveryReady && ["/creators", "/props", "/locations", "/companies", "/jobs", "/projects", "/vehicles", "/tiere", "/marketplace"].includes(pathname)
        && !content.querySelector('[data-native-browse-toolbar="v1"]')) return null;
      const landing = content.querySelector<HTMLElement>('[data-native-smart-landing]');
      const shots = content.querySelector<HTMLElement>('[data-native-shots-ready="v1"]');
      const query = new URLSearchParams(location.search);
      const emptySmart = pathname === "/search" && query.get("smart") === "1" && !query.has("plan") && !query.get("q")?.trim() && !query.has("context");
      if (recoveryReady) nodes.push(terminalError);
      else if (pathname === "/app/shots") {
        if (!visible(shots)) return null;
        nodes.push(shots);
      }
      else if (emptySmart || landing) {
        if (!visible(landing) || landing.getAttribute("data-native-route-ready") !== "v1") return null;
        nodes.push(landing);
      } else if (!content.querySelector('h1,[role="alert"]')) return null;
      nodes.push(header, content, dock);
    }
    const geometry = [width, height];
    for (const node of nodes) {
      watch(node);
      const box = node.getBoundingClientRect();
      if (!(box.bottom > 0 && box.top < height && box.right > 0 && box.left < width)) return null;
      geometry.push(box.left, box.top, box.width, box.height);
    }
    return geometry;
  };
  const check = () => {
    frame = 0;
    const current = sample();
    if (!current) { previous = null; clear(); return; }
    // Once this current view is ready, normal card/layout updates do not start
    // another native identity proof. Actual readiness/session/lifecycle loss does.
    if (root.getAttribute(NATIVE_APP_BOOT_READY) === "v1") { previous = current; return; }
    if (previous && current.length === previous.length && current.every((value, index) => Math.abs(value - previous![index]) <= .5)) {
      if (root.getAttribute(NATIVE_APP_BOOT_READY) !== "v1") root.setAttribute(NATIVE_APP_BOOT_READY, "v1");
      return;
    }
    clear(); previous = current; frame = requestAnimationFrame(check);
  };
  const schedule = () => { if (!closed && !frame) frame = requestAnimationFrame(check); };
  const suspend = () => { suspended = true; previous = null; cancelAnimationFrame(frame); frame = 0; clear(); };
  const resume = () => { suspended = false; previous = null; schedule(); };
  const visibility = () => document.visibilityState === "hidden" ? suspend() : resume();
  const pop = () => { previous = null; clear(); schedule(); };
  const changes = new MutationObserver(records => {
    if (records.some(record => record.type !== "attributes" || record.attributeName !== "style"
      || record.target === root || measured.has(record.target as Element))) schedule();
  });
  changes.observe(root, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["class", "style", "hidden", "disabled", "aria-busy", "data-cg-native-community-appearance", "data-native-app-navbar", "data-native-app-surface", "data-native-app-bottom-nav", "data-native-app-gesture-ready", "data-native-auth-ready", "data-native-route-ready", "data-native-route-error", "data-native-shots-ready"] });
  const resize = new ResizeObserver(schedule); resize.observe(document.body);
  window.addEventListener("resize", schedule); window.visualViewport?.addEventListener("resize", schedule);
  window.addEventListener("blur", suspend); window.addEventListener("pagehide", suspend); window.addEventListener("cinegenius:native-workspace-presented", suspend);
  window.addEventListener("focus", resume); window.addEventListener("pageshow", resume); window.addEventListener("cinegenius:app-resume", resume);
  window.addEventListener("popstate", pop); document.addEventListener("visibilitychange", visibility);
  schedule();
  return () => {
    closed = true; cancelAnimationFrame(frame); changes.disconnect(); resize.disconnect(); clear();
    if (activeClaim === claim) activeClaim = undefined;
    window.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("resize", schedule);
    window.removeEventListener("blur", suspend); window.removeEventListener("pagehide", suspend); window.removeEventListener("cinegenius:native-workspace-presented", suspend);
    window.removeEventListener("focus", resume); window.removeEventListener("pageshow", resume); window.removeEventListener("cinegenius:app-resume", resume);
    window.removeEventListener("popstate", pop); document.removeEventListener("visibilitychange", visibility);
  };
}
