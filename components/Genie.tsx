"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSession } from "@clerk/nextjs";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { clearConversation, GENIE_IDLE_MS, GENIE_MEMORY_ACTIVITY, readConversationSnapshot } from "@/lib/genie-conversation";
import GenieWelcome from "./GenieWelcome";
import GenieLauncher, { type GeniePosition } from "./GenieLauncher";
import styles from "./Genie.module.css";

function GenieMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <path d="m6 8 13 8-13 8" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m25 3 1.5 4.5L31 9l-4.5 1.5L25 15l-1.5-4.5L19 9l4.5-1.5L25 3Z" fill="currentColor" />
    </svg>
  );
}

function LoadingPanel() {
  const t = useTranslations("Genie");
  return <p className={styles.loading} role="status">{t("loading")}</p>;
}

const GeniePanel = dynamic(() => import("./GeniePanel"), {
  ssr: false,
  loading: LoadingPanel,
});

function subscribeToCookieNotice(onChange: () => void) {
  window.addEventListener("cg-cookie-preference-change", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("cg-cookie-preference-change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function cookieNoticeVisible() {
  try {
    // Read only the existing banner preference here.
    return !window.localStorage.getItem("cg_cookies_ok");
  } catch {
    return true;
  }
}

function subscribeToMessageChat(onChange: () => void) {
  window.addEventListener("cinegenius:messages-chat-state", onChange);
  return () => window.removeEventListener("cinegenius:messages-chat-state", onChange);
}

function messageChatOpen() {
  return document.body.dataset.messagesChatOpen === "true";
}

function AvailableGenie({ memoryScope, mode, dismissed, position, onHide, onPositionChange }: { memoryScope: string | null; mode: "floating" | "tool"; dismissed: boolean; position: RefObject<GeniePosition | null>; onHide: () => void; onPositionChange: (point: GeniePosition) => void }) {
  const t = useTranslations("Genie");
  const tools = useTranslations("AiTools");
  const pathname = usePathname();
  const chatOpen = useSyncExternalStore(subscribeToMessageChat, messageChatOpen, () => false);
  const hideLauncher = pathname === "/messages" && chatOpen;
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const request = useRef<AbortController | null>(null);
  const id = useId();
  const launcherVisible = !open && !hideLauncher && (mode === "tool" || !dismissed);

  const close = useCallback((restoreFocus = true) => {
    request.current?.abort();
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => launcher.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus({ preventScroll: true });
    const viewport = window.visualViewport;
    let viewportFrame: number | null = null;
    let lastHeight: number | undefined;
    let lastOffset: number | undefined;
    let lastCompact: boolean | undefined;
    const updateViewport = () => {
      viewportFrame = null;
      if (!viewport || !panel.current) return;
      const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      if (viewport.height !== lastHeight) {
        panel.current.style.setProperty("--genie-viewport-height", `${viewport.height}px`);
        lastHeight = viewport.height;
      }
      if (keyboardOffset !== lastOffset) {
        panel.current.style.setProperty("--genie-keyboard-offset", `${keyboardOffset}px`);
        lastOffset = keyboardOffset;
      }
      const compact = viewport.height < 440;
      if (compact !== lastCompact) {
        panel.current.toggleAttribute("data-compact", compact);
        lastCompact = compact;
      }
    };
    const resize = () => {
      if (viewportFrame === null) viewportFrame = requestAnimationFrame(updateViewport);
    };
    updateViewport();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !event.isComposing) {
        event.preventDefault();
        close();
      }
    };
    let outsideGesture: { id: number; x: number; y: number; moved: boolean; ended: boolean } | null = null;
    const isOutside = (event: Event) => panel.current && !event.composedPath().includes(panel.current);
    const pointerDown = (event: PointerEvent) => {
      outsideGesture = event.isPrimary && event.button === 0 && isOutside(event)
        ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, ended: false }
        : null;
    };
    const pointerMove = (event: PointerEvent) => {
      if (outsideGesture?.id === event.pointerId && Math.hypot(event.clientX - outsideGesture.x, event.clientY - outsideGesture.y) > 10) {
        outsideGesture.moved = true;
      }
    };
    const pointerUp = (event: PointerEvent) => {
      pointerMove(event);
      if (outsideGesture?.id === event.pointerId) outsideGesture.ended = true;
    };
    const pointerCancel = () => { outsideGesture = null; };
    const outsideClick = (event: MouseEvent) => {
      const gesture = outsideGesture;
      outsideGesture = null;
      // A scroll/drag must not dismiss the bubble or abort an answer in progress.
      if (gesture?.ended && !gesture.moved && !event.defaultPrevented && isOutside(event)) close(false);
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointermove", pointerMove, { passive: true });
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerCancel);
    window.addEventListener("click", outsideClick);
    return () => {
      window.removeEventListener("keydown", escape);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerCancel);
      window.removeEventListener("click", outsideClick);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      if (viewportFrame !== null) cancelAnimationFrame(viewportFrame);
    };
  }, [open, close]);

  return (
    <>
      <GenieWelcome
        key={pathname}
        memoryScope={memoryScope}
        enabled={!open && !hasOpened && !hasMoved && !hideLauncher && !dismissed}
        onOpen={() => { setHasOpened(true); setOpen(true); }}
        onDismiss={() => launcher.current?.focus({ preventScroll: true })}
      />
      {mode === "floating" && <span id={`${id}-move-hint`} className={styles.inputLabel}>{t("moveLauncher")}</span>}
      <GenieLauncher position={position} visible={mode === "floating" && launcherVisible} onHide={onHide} onMoveStart={() => setHasMoved(true)} onPositionChange={onPositionChange}>
      {mode === "floating" && launcherVisible && (
        <button
          ref={launcher}
          type="button"
          data-genie-open=""
          className={styles.launcher}
          aria-label={t("open")}
          aria-describedby={`${id}-move-hint`}
          aria-controls={hasOpened ? `${id}-panel` : undefined}
          aria-expanded={false}
          aria-haspopup="dialog"
          onClick={() => { setHasOpened(true); setOpen(true); }}
        >
          <GenieMark />
          <span className={styles.launcherCopy}>
            <span className={styles.launcherName}>{t("name")}</span>
            <span className={styles.launcherLabel}>{t("assistantLabel")}</span>
          </span>
        </button>
      )}
      </GenieLauncher>
      {mode === "tool" && launcherVisible && <button ref={launcher} type="button" className={styles.toolLauncher} aria-label={t("open")} aria-haspopup="dialog" aria-expanded={false} aria-controls={hasOpened ? `${id}-panel` : undefined} onClick={() => { setHasOpened(true); setOpen(true); }}>
        <GenieMark /><span className={styles.toolCopy}><strong>{t("name")}</strong><span>{tools("genieDescription")}</span></span>
      </button>}
      {hasOpened && (
        <section
          ref={panel}
          id={`${id}-panel`}
          className={styles.panel}
          hidden={!open}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${id}-title`}
          tabIndex={-1}
        >
          <header className={styles.header}>
            <div className={styles.title}>
              <span className={styles.brandIcon}><GenieMark /></span>
              <h2 id={`${id}-title`}>{t("name")}</h2>
              <span className={styles.beta}>{t("beta")}</span>
            </div>
            <button type="button" className={styles.iconButton} onClick={() => close()} aria-label={t("close")}>
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <GeniePanel active={open} requestRef={request} memoryScope={memoryScope} />
        </section>
      )}
    </>
  );
}

export default function Genie({ mode = "floating" }: { mode?: "floating" | "tool" }) {
  const pathname = usePathname();
  const t = useTranslations("Genie");
  const tools = useTranslations("AiTools");
  const { isLoaded, session } = useSession();
  const memoryScope = session?.id ?? null;
  const [dismissed, setDismissed] = useState(false);
  const position = useRef<GeniePosition | null>(null);
  const rememberPosition = useCallback((point: GeniePosition) => { position.current = point; }, []);
  useEffect(() => {
    const reopen = () => setDismissed(false);
    const pageShow = (event: PageTransitionEvent) => { if (event.persisted) reopen(); };
    window.addEventListener("pageshow", pageShow);
    window.addEventListener("cinegenius:app-resume", reopen);
    return () => {
      window.removeEventListener("pageshow", pageShow);
      window.removeEventListener("cinegenius:app-resume", reopen);
    };
  }, []);
  const cookieVisible = useSyncExternalStore(subscribeToCookieNotice, cookieNoticeVisible, () => true);
  useEffect(() => {
    if (!isLoaded) return;
    let timer: number | undefined;
    const checkStoredHistory = () => {
      window.clearTimeout(timer);
      try {
        if (!memoryScope) { clearConversation(window.sessionStorage); return; }
        const snapshot = readConversationSnapshot(window.sessionStorage, memoryScope, Date.now());
        if (snapshot) timer = window.setTimeout(checkStoredHistory, Math.max(0, snapshot.updatedAt + GENIE_IDLE_MS - Date.now()));
      } catch { /* A blocked store must not prevent using the in-memory chat. */ }
    };
    // Remains active before the lazy panel opens and while the launcher is hidden.
    checkStoredHistory();
    const events = [GENIE_MEMORY_ACTIVITY, "pageshow", "focus", "cinegenius:app-resume"];
    events.forEach(event => window.addEventListener(event, checkStoredHistory));
    document.addEventListener("visibilitychange", checkStoredHistory);
    return () => {
      window.clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, checkStoredHistory));
      document.removeEventListener("visibilitychange", checkStoredHistory);
    };
  }, [isLoaded, memoryScope]);
  // Unmounting also aborts and clears the chat if the cookie notice returns.
  const replacedByTool = mode === "floating" && (pathname === "/tools" || pathname.startsWith("/tools/"));
  if (mode === "tool" && (!isLoaded || cookieVisible)) return <div className={styles.toolLauncher}>
    <GenieMark />
    <div className={styles.toolCopy}><strong>{t("name")}</strong><span>{tools("genieDescription")}</span><span role="status">{isLoaded ? tools("noticeFirst") : t("loading")}</span></div>
  </div>;
  return !isLoaded || cookieVisible || replacedByTool ? null : <AvailableGenie key={memoryScope ?? "guest"} memoryScope={memoryScope} mode={mode} dismissed={dismissed} position={position} onHide={() => setDismissed(true)} onPositionChange={rememberPosition} />;
}
