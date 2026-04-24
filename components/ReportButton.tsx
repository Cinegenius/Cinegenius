"use client";

import { useState, useRef, useEffect } from "react";
import { Flag } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

const REASONS: { value: string; label: string }[] = [
  { value: "spam",                  label: "Spam oder Werbung" },
  { value: "inappropriate_content", label: "Unangemessener Inhalt" },
  { value: "fake_profile",          label: "Gefälschtes Inserat" },
  { value: "scam",                  label: "Betrug / Abzocke" },
  { value: "other",                 label: "Anderer Grund" },
];

interface Props {
  listingId: string;
  listingType?: "listing" | "review";
}

export default function ReportButton({ listingId, listingType = "listing" }: Props) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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
        setErrorMsg(d.error ?? "Fehler beim Melden");
        setStatus("error");
        return;
      }
      setStatus("done");
      setOpen(false);
    } catch {
      setErrorMsg("Netzwerkfehler. Bitte erneut versuchen.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <span className="text-xs text-emerald-400 flex items-center gap-1 px-2 py-1">
        <Flag size={11} /> Gemeldet
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-400/10"
        title="Inserat melden"
      >
        <Flag size={12} /> Melden
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-52 bg-bg-elevated border border-border rounded-xl shadow-xl p-2">
          <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold px-2 py-1 mb-1">
            Grund auswählen
          </p>
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
            {status === "loading" ? "Wird gesendet…" : "Melden"}
          </button>
        </div>
      )}
    </div>
  );
}
