"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import PersonalAreaNavigation from "@/components/PersonalAreaNavigation";

export default function AppChrome({ children, initialIsSignedIn }: { children: ReactNode; initialIsSignedIn: boolean }) {
  const pathname = usePathname();
  const guidedSetup = pathname.startsWith("/profile-setup");

  if (guidedSetup) {
    return <main className="flex-1">{children}</main>;
  }

  return <>
    <Navbar initialIsSignedIn={initialIsSignedIn} />
    <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      <PersonalAreaNavigation>{children}</PersonalAreaNavigation>
    </main>
    {pathname !== "/messages" && <Footer />}
    <BottomNav />
  </>;
}
