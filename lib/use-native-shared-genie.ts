"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { useAuth, useSession } from "@clerk/nextjs";
import { nativeBootSession } from "./native-app-boot-readiness";
import { nativeGenieOwnerSnapshot, nativeGenieEmbeddedSnapshot, nativeGenieOwnerServerSnapshot, subscribeNativeGenieOwner,
  nativeGeniePresentation, publishNativeGeniePresentation, SHARED_GENIE_OPEN } from "./native-shared-genie";

export function useNativeSharedGenieOwner(): boolean | null {
  return useSyncExternalStore(subscribeNativeGenieOwner, nativeGenieOwnerSnapshot, nativeGenieOwnerServerSnapshot);
}

export function useNativeEmbeddedGenie(): boolean | null {
  return useSyncExternalStore(subscribeNativeGenieOwner, nativeGenieEmbeddedSnapshot, nativeGenieOwnerServerSnapshot);
}

export function useNativeSharedGenie({ enabled, owned, eligible, open, label, onOpen }: {
  enabled: boolean; owned: boolean | null; eligible: boolean; open: boolean; label: string; onOpen: () => void;
}) {
  const auth = useAuth(), current = useSession();
  const member = nativeBootSession({ authLoaded: auth.isLoaded, sessionLoaded: current.isLoaded,
    signedIn: auth.isSignedIn, userId: auth.userId, sessionId: auth.sessionId, session: current.session }) === "member";
  useLayoutEffect(() => {
    if (!enabled || owned !== true) return;
    const available = () => nativeGeniePresentation({ eligible: eligible && member, open });
    const publish = () => publishNativeGeniePresentation(available(), label);
    const receive = (event: Event) => {
      // A closed native UI action only. The original chat still owns its current
      // Clerk scope, draft, explicit Send and server/API authorization.
      if (event.cancelable && event.target === window && nativeGenieOwnerSnapshot() && available() === "available") {
        event.preventDefault();
        onOpen();
      }
    };
    const observer = new MutationObserver(publish);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["open", "hidden", "inert", "aria-modal", "style", "class", "data-messages-chat-open", "data-genie-panel-open", "data-cg-native-community-appearance"] });
    window.addEventListener(SHARED_GENIE_OPEN, receive);
    const events = ["pageshow", "resize", "cinegenius:messages-chat-state", "transitionend", "animationend"];
    events.forEach(name => window.addEventListener(name, publish));
    document.addEventListener("visibilitychange", publish);
    publish();
    return () => {
      observer.disconnect(); window.removeEventListener(SHARED_GENIE_OPEN, receive);
      events.forEach(name => window.removeEventListener(name, publish));
      document.removeEventListener("visibilitychange", publish);
      publishNativeGeniePresentation("hidden", label);
    };
  }, [enabled, owned, eligible, member, open, label, onOpen, auth.userId, auth.sessionId]);
}
