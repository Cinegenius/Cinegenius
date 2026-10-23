"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompanyInvitationAccept({ token, companyName }: { token: string; companyName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function accept() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/company-invitations/accept", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Die Einladung konnte nicht angenommen werden.");
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Einladung konnte nicht angenommen werden.");
    } finally { setBusy(false); }
  }

  if (complete) return <div className="mt-6 space-y-3"><p role="status" className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success">Deine Anfrage für {companyName} wurde gesendet. Die Firma muss den Beitritt noch bestätigen.</p><button onClick={() => router.push("/companies")} className="min-h-11 rounded-xl bg-gold px-4 text-sm font-bold text-bg-primary">Firmen ansehen</button></div>;
  return <div className="mt-6 space-y-3">{error && <p role="alert" className="rounded-xl border border-crimson/30 bg-crimson/10 p-3 text-sm text-crimson-light">{error}</p>}<button onClick={() => void accept()} disabled={busy} className="min-h-12 w-full rounded-xl bg-gold px-4 text-sm font-bold text-bg-primary disabled:opacity-60">{busy ? "Anfrage wird gesendet …" : "Einladung annehmen und Beitritt anfragen"}</button></div>;
}
