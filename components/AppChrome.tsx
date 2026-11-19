"use client";

import type { ReactNode } from "react";
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
import styles from "@/components/app/NativeAppSurface.module.css";

export default function AppChrome({ children, initialIsSignedIn, initialAdminUserId = null }: { children: ReactNode; initialIsSignedIn: boolean; initialAdminUserId?: string | null }) {
  const pathname = usePathname();
  const nativeAppearance = useNativeAppAppearance();
  const guidedSetup = pathname.startsWith("/profile-setup");

  if (guidedSetup) {
    return <main className="flex-1">{children}</main>;
  }

  return <ServerAdminContext.Provider value={initialAdminUserId}>
    <SiteNavigationProvider>
    <NavigationRestoration />
    <Navbar initialIsSignedIn={initialIsSignedIn} initialAdminUserId={initialAdminUserId} />
    <main data-native-app-surface={nativeAppearance ? "v1" : undefined} className={`site-main flex-1 pb-[var(--mobile-nav-clearance)] lg:pb-0 ${nativeAppearance ? styles.surface : ""}`}>
      <LegalLanguageNotice />
      {children}
    </main>
    {!nativeAppearance && pathname !== "/messages" && <Footer />}
    <BottomNav />
    <SiteNavigationMenu />
    </SiteNavigationProvider>
  </ServerAdminContext.Provider>;
}
