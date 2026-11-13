"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSession } from "@clerk/nextjs";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { clearConversation, readConversation } from "@/lib/genie-conversation";
import GenieWelcome from "./GenieWelcome";
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

function AvailableGenie({ memoryScope, mode }: { memoryScope: string | null; mode: "floating" | "tool" }) {
  const t = useTranslations("Genie");
  const tools = useTranslations("AiTools");
  const pathname = usePathname();
  const chatOpen = useSyncExternalStore(subscribeToMessageChat, messageChatOpen, () => false);
  const hideLauncher = pathname === "/messages" && chatOpen;
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const request = useRef<AbortController | null>(null);
  const id = useId();

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
        enabled={!open && !hasOpened && !hideLauncher}
        onOpen={() => { setHasOpened(true); setOpen(true); }}
        onDismiss={() => launcher.current?.focus({ preventScroll: true })}
      />
      {!open && !hideLauncher && (
        <button
          ref={launcher}
          type="button"
          className={mode === "tool" ? styles.toolLauncher : styles.launcher}
          aria-label={t("open")}
          aria-controls={hasOpened ? `${id}-panel` : undefined}
          aria-expanded={false}
          aria-haspopup="dialog"
          onClick={() => { setHasOpened(true); setOpen(true); }}
        >
          <GenieMark />
          {mode === "tool" ? <span className={styles.toolCopy}><strong>{t("name")}</strong><span>{tools("genieDescription")}</span></span> : (
          <span className={styles.launcherCopy}>
            <span className={styles.launcherName}>{t("name")}</span>
            <span className={styles.launcherLabel}>{t("assistantLabel")}</span>
          </span>
          )}
        </button>
      )}
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
  const cookieVisible = useSyncExternalStore(subscribeToCookieNotice, cookieNoticeVisible, () => true);
  useEffect(() => {
    if (!isLoaded) return;
    try {
      if (memoryScope) readConversation(window.sessionStorage, memoryScope);
      else clearConversation(window.sessionStorage);
    } catch {
      // A blocked browser store must not prevent using the in-memory chat.
    }
  }, [isLoaded, memoryScope]);
  // Unmounting also aborts and clears the chat if the cookie notice returns.
  const replacedByTool = mode === "floating" && (pathname === "/tools" || pathname.startsWith("/tools/"));
  if (mode === "tool" && (!isLoaded || cookieVisible)) return <div className={styles.toolLauncher}>
    <GenieMark />
    <div className={styles.toolCopy}><strong>{t("name")}</strong><span>{tools("genieDescription")}</span><span role="status">{isLoaded ? tools("noticeFirst") : t("loading")}</span></div>
  </div>;
  return !isLoaded || cookieVisible || replacedByTool ? null : <AvailableGenie key={memoryScope ?? "guest"} memoryScope={memoryScope} mode={mode} />;
}
