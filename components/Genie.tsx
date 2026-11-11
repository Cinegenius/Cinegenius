"use client";

import dynamic from "next/dynamic";
import { useSession } from "@clerk/nextjs";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { clearConversation, readConversation } from "@/lib/genie-conversation";
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

function AvailableGenie({ memoryScope }: { memoryScope: string | null }) {
  const t = useTranslations("Genie");
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
    const resize = () => {
      if (!viewport || !panel.current) return;
      const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      panel.current.style.setProperty("--genie-viewport-height", `${viewport.height}px`);
      panel.current.style.setProperty("--genie-keyboard-offset", `${keyboardOffset}px`);
      panel.current.toggleAttribute("data-compact", viewport.height < 440);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !event.isComposing) {
        event.preventDefault();
        close();
      }
    };
    const outside = (event: PointerEvent) => {
      if (panel.current && !event.composedPath().includes(panel.current)) close(false);
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", escape);
      window.removeEventListener("pointerdown", outside);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
    };
  }, [open, close]);

  return (
    <>
      {!open && (
        <button
          ref={launcher}
          type="button"
          className={styles.launcher}
          aria-label={t("open")}
          aria-controls={hasOpened ? `${id}-panel` : undefined}
          aria-expanded={false}
          aria-haspopup="dialog"
          onClick={() => { setHasOpened(true); setOpen(true); }}
        >
          <GenieMark />
          <span>{t("name")}</span>
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

export default function Genie() {
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
  return !isLoaded || cookieVisible ? null : <AvailableGenie key={memoryScope ?? "guest"} memoryScope={memoryScope} />;
}
