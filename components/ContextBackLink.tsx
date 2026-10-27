"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import type { ComponentProps } from "react";
import { viewRecord } from "@/lib/navigation-context";

/** Use actual history for a return to the originating list; direct visits retain a normal link. */
export default function ContextBackLink(props: ComponentProps<typeof Link>) {
  const path = usePathname();
  const router = useRouter();
  const { userId } = useAuth();
  return <Link {...props} onClick={event => {
    props.onClick?.(event);
    if (event.defaultPrevented || (props.target && props.target !== "_self") || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const from = viewRecord(window.history.state, path, userId ?? "guest").from;
    const fallback = typeof props.href === "string" ? props.href.split("?")[0] : props.href.pathname;
    if (from && fallback && (from === fallback || from.startsWith(`${fallback}/`)) && window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
  }} />;
}
