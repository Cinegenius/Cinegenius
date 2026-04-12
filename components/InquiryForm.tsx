"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Send, CheckCircle, Shield, Clock, ChevronRight, Loader2, LogIn } from "lucide-react";
import Link from "next/link";

type Props = {
  listingId: string;
  listingTitle: string;
  listingType: "creator" | "location" | "vehicle" | "prop" | "job";
  ownerId: string;
  ownerName: string;
};

export default function InquiryForm({ listingId, listingTitle, listingType, ownerId, ownerName }: Props) {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const [step, setStep] = useState<"form" | "sent">("form");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [projectTitle, setProjectTitle] = useState("");
  const [projectType, setProjectType] = useState("Spielfilm");
  const [message, setMessage] = useState("");

  const firstName = ownerName.split(" ")[0];
  const canSubmit = projectTitle.trim().length >= 2 && message.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSending(true);
    setError("");

    const body = [
      `Projekt: ${projectTitle}`,
      `Projekttyp: ${projectType}`,
      "",
      message.trim(),
    ].join("\n");

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          listing_title: listingTitle,
          listing_type: listingType,
          receiver_id: ownerId,
          content: body,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Senden");

      setStep("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Senden");
    } finally {
      setSending(false);
    }
  };

  if (!isLoaded) return null;

  if (!user) {
    return (
      <div className="bg-bg-secondary border border-border rounded-xl p-6 text-center space-y-4">
        <div className="w-12 h-12 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center mx-auto">
          <LogIn size={20} className="text-gold" />
        </div>
        <p className="text-sm text-text-secondary">Bitte melde dich an um eine Anfrage zu senden.</p>
        <Link
          href="/sign-in"
          className="block w-full py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors text-center"
        >
          Anmelden
        </Link>
      </div>
    );
  }

  if (step === "sent") {
    return (
      <div className="bg-bg-secondary border border-border rounded-xl p-6 text-center space-y-4">
        <div className="w-14 h-14 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle size={28} className="text-success" />
        </div>
        <h3 className="font-display text-lg font-bold text-text-primary">Anfrage gesendet!</h3>
        <p className="text-text-muted text-sm leading-relaxed">
          <strong className="text-text-primary">{firstName}</strong> wurde benachrichtigt und meldet sich üblicherweise innerhalb von 24 Stunden.
        </p>
        <div className="p-3 bg-gold-subtle border border-gold/20 rounded-lg text-xs text-text-muted text-left">
          <p className="font-semibold text-gold mb-1 flex items-center gap-1">
            <Clock size={11} /> Nächste Schritte
          </p>
          <p>Die Konditionen werden sicher und privat innerhalb der Plattform verhandelt.</p>
        </div>
        <button
          onClick={() => router.push("/dashboard?tab=messages")}
          className="w-full py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors"
        >
          Zur Nachrichtenübersicht
        </button>
        <button
          onClick={() => { setStep("form"); setProjectTitle(""); setMessage(""); }}
          className="text-xs text-text-muted hover:text-gold transition-colors"
        >
          Neue Anfrage senden
        </button>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-6 space-y-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-0.5">Buchungsanfrage</p>
        <h3 className="font-display text-lg font-bold text-text-primary">Projekt anfragen</h3>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">
          Konditionen werden privat verhandelt — keine öffentliche Preisangabe nötig.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
            Projektname <span className="text-crimson-light">*</span>
          </label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder={`z. B. Kurzfilm "Licht der Stadt"`}
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
            Projekttyp
          </label>
          <select
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors"
          >
            {["Spielfilm", "Kurzfilm", "Werbung", "Musikvideo", "Dokumentarfilm", "Corporate", "TV / Episodic", "Sonstiges"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">
            Nachricht <span className="text-crimson-light">*</span>
          </label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Hallo ${firstName}, ich würde gerne über mein Projekt sprechen...`}
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors resize-none"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || sending}
          className={`w-full py-3 font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
            canSubmit && !sending
              ? "bg-gold text-bg-primary hover:bg-gold-light"
              : "bg-border text-text-muted cursor-not-allowed"
          }`}
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {sending ? "Wird gesendet..." : "Anfrage senden"}
        </button>

        <p className="text-center text-xs text-text-muted flex items-center justify-center gap-1">
          <Shield size={11} /> Sicher & privat — Verhandlung innerhalb der Plattform
        </p>
      </form>

      <div className="pt-4 border-t border-border">
        <p className="text-xs font-semibold text-gold mb-2 flex items-center gap-1">
          <ChevronRight size={12} /> So läuft es ab
        </p>
        <ol className="space-y-1.5 text-xs text-text-muted">
          <li className="flex items-start gap-2"><span className="w-4 h-4 bg-gold/20 rounded-full flex items-center justify-center text-[10px] font-bold text-gold shrink-0 mt-0.5">1</span>Anfrage mit Projektdetails senden</li>
          <li className="flex items-start gap-2"><span className="w-4 h-4 bg-gold/20 rounded-full flex items-center justify-center text-[10px] font-bold text-gold shrink-0 mt-0.5">2</span>{firstName} antwortet mit Konditionen</li>
          <li className="flex items-start gap-2"><span className="w-4 h-4 bg-gold/20 rounded-full flex items-center justify-center text-[10px] font-bold text-gold shrink-0 mt-0.5">3</span>Preis & Details privat verhandeln</li>
          <li className="flex items-start gap-2"><span className="w-4 h-4 bg-gold/20 rounded-full flex items-center justify-center text-[10px] font-bold text-gold shrink-0 mt-0.5">4</span>Buchung bestätigen</li>
        </ol>
      </div>
    </div>
  );
}
