"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FolderKanban, MessageSquare, ScanLine, Sparkles } from "lucide-react";
import styles from "./Genie.module.css";

const steps = [
  { titleKey: "NativeAppChrome.smart", body: "smart", icon: Sparkles },
  { titleKey: "nav.projects", body: "projects", icon: FolderKanban },
  { titleKey: "NativeAppChrome.work", body: "work", icon: ScanLine },
  { titleKey: "nav.messages", body: "messages", icon: MessageSquare },
] as const;

export default function GenieAppGuide({ onFinish }: { onFinish: () => void }) {
  const t = useTranslations("Genie.appGuide"), ui = useTranslations();
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = steps[index], Icon = step.icon;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [index]);
  return <div className={styles.guide} data-genie-app-guide="v1">
    <div className={styles.guideTop}><span>{t("title")}</span><button type="button" onClick={onFinish}>{t("skip")}</button></div>
    <p className={styles.guideProgress} aria-live="polite">{t("step", { current: index + 1, total: steps.length })}</p>
    <Icon size={30} className={styles.guideIcon} aria-hidden="true" />
    <h3 ref={heading} tabIndex={-1}>{ui(step.titleKey)}</h3>
    <p className={styles.guideBody}>{t(step.body)}</p>
    <div className={styles.guideActions}>
      <button type="button" disabled={index === 0} onClick={() => setIndex(current => Math.max(0, current - 1))}>{t("back")}</button>
      <button type="button" className={styles.guideNext} onClick={() => index === steps.length - 1 ? onFinish() : setIndex(current => current + 1)}>{t(index === steps.length - 1 ? "done" : "next")}</button>
    </div>
  </div>;
}
