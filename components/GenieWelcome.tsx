"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import styles from "./Genie.module.css";

const WELCOME_KEY = "cg_genie_welcome_v1";
const welcomedSessions = new Set<string>();

function alreadyWelcomed(scope: string) {
  if (welcomedSessions.has(scope)) return true;
  try { return window.sessionStorage.getItem(WELCOME_KEY) === scope; }
  catch { return false; }
}

function markWelcomed(scope: string) {
  if (alreadyWelcomed(scope)) return false;
  welcomedSessions.add(scope);
  if (welcomedSessions.size > 20) welcomedSessions.delete(welcomedSessions.values().next().value!);
  // Only an opaque session identifier and a UI preference; no credentials or chat content.
  try { window.sessionStorage.setItem(WELCOME_KEY, scope); } catch { /* In-memory deduplication remains available. */ }
  return true;
}

function busyPage() {
  const activeElement = document.activeElement as HTMLElement | null;
  return document.visibilityState === "hidden"
    || !!document.querySelector("dialog[open]")
    || !!activeElement?.isContentEditable
    || !!activeElement?.closest(
    "input, textarea, select, [contenteditable='true'], [role='dialog'][aria-modal='true']",
  );
}

export default function GenieWelcome({ memoryScope, enabled, onOpen, onDismiss }: {
  memoryScope: string | null;
  enabled: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("Genie");
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const eligible = enabled && !/^\/(?:sign-in|sign-up|profile-setup)(?:\/|$)/.test(pathname);
  // Discard an interrupted announcement rather than reviving it when the
  // launcher becomes available again. The conditional reset settles before commit.
  if (visible && (!eligible || !memoryScope)) setVisible(false);

  useEffect(() => {
    if (!memoryScope || !eligible || alreadyWelcomed(memoryScope)) return;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      if (alreadyWelcomed(memoryScope)) return;
      timer = window.setTimeout(() => {
        if (!busyPage() && markWelcomed(memoryScope)) setVisible(true);
      }, 1500);
    };
    const contextChanged = () => {
      if (busyPage()) setVisible(false);
      schedule();
    };
    schedule();
    document.addEventListener("focusin", contextChanged);
    document.addEventListener("focusout", schedule);
    document.addEventListener("visibilitychange", contextChanged);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", contextChanged);
      document.removeEventListener("focusout", schedule);
      document.removeEventListener("visibilitychange", contextChanged);
    };
  }, [memoryScope, eligible, pathname]);

  useEffect(() => {
    if (!visible || hovered || focused) return;
    const timer = window.setTimeout(() => setVisible(false), 8000);
    return () => window.clearTimeout(timer);
  }, [visible, hovered, focused]);

  if (!visible || !eligible || !memoryScope) return null;
  const dismiss = () => { setVisible(false); onDismiss(); };

  return (
    <aside
      className={styles.welcome}
      aria-label={t("assistantLabel")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={event => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault(); event.stopPropagation(); dismiss();
        }
      }}
    >
      <button type="button" className={`${styles.iconButton} ${styles.welcomeClose}`} aria-label={t("dismissWelcome")} onClick={dismiss}>
        <X size={18} aria-hidden="true" />
      </button>
      <p role="status" className={styles.welcomeText}>{t("greeting")}</p>
      <button type="button" className={styles.welcomeAction} onClick={() => { setVisible(false); onOpen(); }}>{t("open")}</button>
    </aside>
  );
}
