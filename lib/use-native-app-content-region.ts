"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { installNativeAppContentRegion, installNativeAppModalLock } from "@/lib/native-app-content-region";

export function useNativeAppContentRegion(active: boolean, content: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    if (!active || !content.current) return;
    return installNativeAppContentRegion(content.current);
  }, [active, content]);
}

/** Existing custom app dialogs retain their own close/draft decisions. */
export function useNativeAppModalLock(active: boolean, surface: RefObject<HTMLElement | null>, onDismiss: () => void) {
  const dismiss = useRef(onDismiss);
  useLayoutEffect(() => { dismiss.current = onDismiss; });
  useEffect(() => {
    if (!active || !surface.current) return;
    return installNativeAppModalLock(surface.current, () => dismiss.current());
  }, [active, surface]);
}
