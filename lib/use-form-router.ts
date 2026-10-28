"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFormNavigation } from "@/contexts/FormDraftContext";

/** Protect explicit cancel/back buttons as well as document links. */
export function useFormRouter() {
  const router = useRouter();
  const { leave } = useFormNavigation();
  return useMemo(() => ({ ...router,
    push: (...args: Parameters<typeof router.push>) => leave(() => router.push(...args)),
    replace: (...args: Parameters<typeof router.replace>) => leave(() => router.replace(...args)),
    back: () => leave(() => router.back()),
    forward: () => leave(() => router.forward()),
  }), [router, leave]);
}
