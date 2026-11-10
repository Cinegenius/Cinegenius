"use client";

import { useState, useRef } from "react";
import FloatingPanel from "@/components/FloatingPanel";
import { Flag } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";




interface Props {
  listingId: string;
  listingType?: "listing" | "review";
}


function getLocalizedREASONS(translate: (key: string) => string): { value: string; label: string }[] {
  return ([
  { value: "spam",                  label: translate("Ui.text_a19d03a7f3b485") },
  { value: "inappropriate_content", label: translate("Ui.text_3a6f6d61b35e21") },
  { value: "fake_profile",          label: translate("Ui.text_25b646d29bc418") },
  { value: "scam",                  label: translate("Ui.text_d28814f82e2a6c") },
  { value: "other",                 label: translate("Ui.text_eeae51a8a5bf24") },
]);
}

export default function ReportButton({ listingId, listingType = "listing" }: Props) {
  const uiText = useTranslations();
  const REASONS = getLocalizedREASONS(uiText);


  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!userId) return null;

  async function submit() {
    if (!reason) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: listingType, target_id: listingId, reason }),
      });
      if (!res.ok) {
        const d = await res.json();
        setErrorMsg(d.error ?? uiText("Ui.text_2f735929919577"));
        setStatus("error");
        return;
      }
      setStatus("done");
      setOpen(false);
    } catch {
      setErrorMsg(uiText("Ui.text_e232416aafa1dc"));
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <span className="text-xs text-emerald-400 flex items-center gap-1 px-2 py-1">{uiText.rich("Ui.text_ccdbcd6f8ebe77", { part1: () => (<Flag size={11} />) })}</span>
    );
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-400/10"
        title={uiText("Ui.text_f1d2cd7ee57f8f")}
      >{uiText.rich("Ui.text_b136e452a5a4fe", { part1: () => (<Flag size={12} />) })}</button>

      {open && (
        <FloatingPanel anchorRef={triggerRef} onClose={() => setOpen(false)} className="bg-bg-elevated border border-border rounded-xl shadow-xl p-2">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold px-2 py-1 mb-1">{uiText("Ui.text_e3cece5a2c2ef0")}</p>
          {REASONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setReason(value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                reason === value ? "bg-red-400/20 text-red-300" : "text-text-secondary hover:bg-bg-secondary"
              }`}
            >
              {label}
            </button>
          ))}
          {status === "error" && (
            <p className="text-xs text-red-400 px-2 pt-1">{errorMsg}</p>
          )}
          <button
            onClick={submit}
            disabled={!reason || status === "loading"}
            className="mt-2 w-full py-2 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "loading" ? uiText("Ui.text_754ed3f63a8843") : uiText("Ui.text_a11f461624489e")}
          </button>
        </FloatingPanel>
      )}
    </div>
  );
}
