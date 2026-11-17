"use client";

import { useEffect } from "react";
import { replaceViewUrl, scheduleViewUrlReplace } from "@/lib/view-url-sync";

/** Query changes replace only the current list entry; navigation always takes priority. */
export function useViewUrl(href: string, delay = 300, navigationKey = "") {
  // A new command can apply the same filters while adding a temporary launch
  // marker. Its navigation key must still trigger normalization of that URL.
  // These controls already filter locally. A server navigation would replace
  // their data, reset paginated profiles and flash intermediate result counts.
  // Keep Next's state and our actual history-entry view state intact.
  useEffect(() => scheduleViewUrlReplace(window, href,
    next => replaceViewUrl(window, next), delay), [href, delay, navigationKey]);
}
