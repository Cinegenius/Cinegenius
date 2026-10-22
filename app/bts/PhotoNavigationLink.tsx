"use client";

import Link from "next/link";
import { markPhotoNavigation } from "@/lib/photo-link";
import type { ReactNode } from "react";

export default function PhotoNavigationLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} onClick={markPhotoNavigation} className={className}>
      {children}
    </Link>
  );
}
