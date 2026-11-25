"use client";

import { useRef, useSyncExternalStore, useLayoutEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import LegalLanguageNotice from "@/components/LegalLanguageNotice";
import NavigationRestoration from "@/components/NavigationRestoration";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import { ServerAdminContext } from "@/lib/server-admin-context";
import { SiteNavigationProvider } from "@/contexts/SiteNavigationContext";
import SiteNavigationMenu from "@/components/SiteNavigationMenu";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { useNativeAppContentRegion } from "@/lib/use-native-app-content-region";
import { useNativeAppBootReadiness } from "@/lib/use-native-app-boot-readiness";
import styles from "@/components/app/NativeAppSurface.module.css";
import {nativeWorkTeamContainerAvailable,nativeWorkTeamContainerServer,nativeWorkTeamContainerSubscribe} from "@/lib/native-work-team-container";

export default function AppChrome({ children, initialIsSignedIn, initialAdminUserId = null }: { children: ReactNode; initialIsSignedIn: boolean; initialAdminUserId?: string | null }) {
  const pathname = usePathname();
  const nativeAppearance = useNativeAppAppearance();
  const guidedSetup = pathname.startsWith("/profile-setup");
  const teamContainer=useSyncExternalStore(nativeWorkTeamContainerSubscribe,nativeWorkTeamContainerAvailable,nativeWorkTeamContainerServer)&&pathname==="/work/teams";
  useLayoutEffect(()=>{
    if(!teamContainer)return;
    const root=document.documentElement,previous=root.getAttribute('data-cg-native-work-team-container');
    const style=document.createElement('style');style.dataset.nativeWorkTeamBackground='v1';
    style.textContent='html[data-cg-native-work-team-container="v1"],html[data-cg-native-work-team-container="v1"] body{background:transparent!important;background-image:none!important;}';
    root.setAttribute('data-cg-native-work-team-container','v1');document.head.appendChild(style);
    return()=>{style.remove();if(previous===null)root.removeAttribute('data-cg-native-work-team-container');else root.setAttribute('data-cg-native-work-team-container',previous);};
  },[teamContainer]);
  const content = useRef<HTMLElement>(null);
  useNativeAppContentRegion(nativeAppearance && !guidedSetup, content);
  useNativeAppBootReadiness(nativeAppearance, pathname);

  if(teamContainer)return <ServerAdminContext.Provider value={initialAdminUserId}><SiteNavigationProvider><NavigationRestoration/><main data-native-work-team-container="v1" className="flex h-dvh max-h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-transparent">{children}</main></SiteNavigationProvider></ServerAdminContext.Provider>;

  if (guidedSetup) {
    return <main data-native-onboarding-surface="v1" className="flex-1">{children}</main>;
  }

  return <ServerAdminContext.Provider value={initialAdminUserId}>
    <SiteNavigationProvider>
    <NavigationRestoration />
    <Navbar initialIsSignedIn={initialIsSignedIn} initialAdminUserId={initialAdminUserId} />
    <main ref={content} data-native-app-surface={nativeAppearance ? "v1" : undefined} className={`site-main flex-1 pb-[var(--mobile-nav-clearance)] lg:pb-0 ${nativeAppearance ? styles.surface : ""}`}>
      <LegalLanguageNotice />
      {children}
    </main>
    {!nativeAppearance && pathname !== "/messages" && <Footer />}
    <BottomNav />
    <SiteNavigationMenu />
    </SiteNavigationProvider>
  </ServerAdminContext.Provider>;
}
