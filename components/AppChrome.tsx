"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import LegalLanguageNotice from "@/components/LegalLanguageNotice";
import NavigationRestoration from "@/components/NavigationRestoration";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import PersonalAreaNavigation from "@/components/PersonalAreaNavigation";
import { ServerAdminContext } from "@/lib/server-admin-context";

export default function AppChrome({ children, initialIsSignedIn, initialAdminUserId = null }: { children: ReactNode; initialIsSignedIn: boolean; initialAdminUserId?: string | null }) {
  const pathname = usePathname();
  const guidedSetup = pathname.startsWith("/profile-setup");

  if (guidedSetup) {
    return <main className="flex-1">{children}</main>;
  }

  return <ServerAdminContext.Provider value={initialAdminUserId}>
    <NavigationRestoration />
    <Navbar initialIsSignedIn={initialIsSignedIn} initialAdminUserId={initialAdminUserId} />
    <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      <LegalLanguageNotice />
      <PersonalAreaNavigation>{children}</PersonalAreaNavigation>
    </main>
    {pathname !== "/messages" && <Footer />}
    <BottomNav />
  </ServerAdminContext.Provider>;
}
