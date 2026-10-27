"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { scheduleViewUrlReplace } from "@/lib/view-url-sync";

/** Query changes replace only the current list entry; navigation always takes priority. */
export function useViewUrl(href: string, delay = 300) {
  const router = useRouter();
  useEffect(() => scheduleViewUrlReplace(window, href, next => router.replace(next, { scroll: false }), delay), [href, delay, router]);
}
