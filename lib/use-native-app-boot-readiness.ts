"use client";

import { useLayoutEffect } from "react";
import { useAuth, useSession } from "@clerk/nextjs";
import { useNativeCapability } from "./use-native-capability";
import { installNativeAppBootReadiness, nativeBootSession } from "./native-app-boot-readiness";

export function useNativeAppBootReadiness(nativeAppearance: boolean, pathname: string) {
  const auth = useAuth(), { session, isLoaded } = useSession();
  const installedBridge = useNativeCapability("workspace");
  const state = nativeBootSession({ authLoaded: auth.isLoaded, sessionLoaded: isLoaded, signedIn: auth.isSignedIn,
    userId: auth.userId, sessionId: auth.sessionId, session });
  const identityScope = JSON.stringify([auth.userId, auth.sessionId, session?.id, session?.user?.id, session?.status, session?.currentTask?.key]);
  useLayoutEffect(() => {
    if (!nativeAppearance && !installedBridge) return;
    return installNativeAppBootReadiness({ pathname, session: state, task: session?.currentTask?.key });
  }, [nativeAppearance, installedBridge, pathname, state, identityScope, session?.currentTask?.key]);
}
