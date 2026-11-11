"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const CommunityBoard = dynamic(() => import("@/components/CommunityBoard"));

/** Load the board near the viewport, then keep drafts and open forms mounted. */
export default function HomeCommunityBoard({ loggedIn }: { loggedIn: boolean }) {
  const t = useTranslations("home");
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    if (!root.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px 0px" });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  return <div ref={root}>
    {visible ? <CommunityBoard loggedIn={loggedIn} /> : <div className="site-container py-4"><Link href="/community" className="inline-flex min-h-11 items-center text-sm text-gold">{t("boardSeeAll")}</Link></div>}
  </div>;
}
