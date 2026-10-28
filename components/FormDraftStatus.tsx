"use client";

import { useTranslations } from "next-intl";
import type { FormDraftStatus as Status } from "@/lib/use-form-draft";

export default function FormDraftStatus({ draft }: { draft: { status: Status; error: string; flush: () => Promise<boolean>; reload: () => void; loaded: boolean } }) {
  const t = useTranslations("FormDraft");
  return <div className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted" data-draft-status>
    <span role="status" aria-live="polite">{t(draft.status === "error" && draft.error === "conflict" ? "conflict" : draft.status)}</span>
    {draft.status === "error" && <button type="button" onClick={() => draft.loaded ? void draft.flush() : draft.reload()} className="min-h-11 px-2 text-gold underline">{t(draft.loaded ? "retry" : "reload")}</button>}
  </div>;
}
