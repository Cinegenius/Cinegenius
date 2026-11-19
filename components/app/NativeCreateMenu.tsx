"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import FloatingPanel from "@/components/FloatingPanel";
import NavigationIcon from "@/components/NavigationIcon";
import { NATIVE_CREATE_DESTINATIONS } from "@/lib/native-create-destinations";
import styles from "./NativeAppNavbar.module.css";

/** One small chooser points to the existing forms; opening it creates no content. */
export default function NativeCreateMenu({ disabled, onOpen }: { disabled: boolean; onOpen: () => void }) {
  const t = useTranslations(), pathname = usePathname(), id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // A route/account-readiness transition dismisses transient presentation only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname, disabled]);
  const label = t("NativeAppChrome.createEntry");
  return <>
    <button ref={button} type="button" className={`${styles.action} ${styles.createButton}`} data-native-create-trigger="v1" aria-label={label} title={label}
      aria-expanded={open} aria-controls={open ? id : undefined} disabled={disabled}
      onClick={() => { onOpen(); setOpen(value => !value); }}><Plus size={23} aria-hidden="true" /></button>
    {open && !disabled && <FloatingPanel anchorRef={button} onClose={() => setOpen(false)} id={id} label={label} width={272} className={styles.createMenu}>
      <h2 className={styles.createTitle}>{label}</h2>
      {NATIVE_CREATE_DESTINATIONS.map(item => <Link key={item.id} href={item.href} prefetch={false} data-native-create={item.id}
        className={styles.profileLink} onClick={() => setOpen(false)}><NavigationIcon name={item.icon} size={19} /><span>{t(item.label)}</span></Link>)}
    </FloatingPanel>}
  </>;
}
