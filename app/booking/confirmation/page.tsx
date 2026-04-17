"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Calendar, Share2, MessageSquare, ArrowRight, Loader2, AlertCircle } from "lucide-react";

const typeLabels: Record<string, string> = {
  location: "Drehort",
  vehicle: "Fahrzeug",
  prop: "Requisite",
  creator: "Filmschaffende/r",
  job: "Job",
};

function formatDateDE(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

type Booking = {
  id: string;
  ref: string;
  listing_id: string | null;
  listing_title: string;
  listing_type: string;
  start_date: string;
  end_date: string;
  days: number;
  daily_rate: number;
  subtotal: number;
  platform_fee: number;
  total: number;
  notes: string | null;
  status: string;
  created_at: string;
};

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") ?? "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ref) { setLoading(false); return; }
    fetch(`/api/bookings?ref=${encodeURIComponent(ref)}`)
      .then((r) => r.json())
      .then(({ booking, error }) => {
        if (error || !booking) setError("Buchung nicht gefunden.");
        else setBooking(booking);
      })
      .catch(() => setError("Fehler beim Laden der Buchung."))
      .finally(() => setLoading(false));
  }, [ref]);

  if (loading) {
    return (
      <div className="pt-32 min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gold" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
          <AlertCircle size={36} className="mx-auto text-text-muted opacity-40" />
          <p className="text-text-muted">{error || "Buchung konnte nicht geladen werden."}</p>
          <Link href="/dashboard?tab=bookings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-lg text-sm hover:bg-gold-light transition-colors">
            Zu meinen Buchungen
          </Link>
        </div>
      </div>
    );
  }

  const isPending = booking.status === "pending";
  const steps = [
    { label: "Anfrage gesendet", done: true, desc: `Referenz: ${booking.ref}` },
    { label: "Anbieter bestätigt", done: !isPending, desc: isPending ? "Warte auf Bestätigung durch den Anbieter" : "Anbieter hat die Anfrage bestätigt" },
    { label: "Drehtag", done: false, desc: booking.start_date ? `Ab ${formatDateDE(booking.start_date)}` : "Termin nach Bestätigung" },
  ];

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={38} className="text-success" />
          </div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
            {isPending ? "Anfrage gesendet!" : "Buchung bestätigt!"}
          </h1>
          <p className="text-text-muted mb-1">
            Referenz: <span className="text-gold font-mono font-semibold">{booking.ref}</span>
          </p>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mt-1 ${isPending ? "bg-gold/10 border border-gold/30 text-gold" : "bg-success/10 border border-success/20 text-success"}`}>
            <CheckCircle size={11} /> {isPending ? "Warte auf Bestätigung des Anbieters" : "Buchung bestätigt"}
          </div>
        </div>

        {/* Buchungskarte */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden mb-6">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-text-primary mb-1">{booking.listing_title}</h2>
                <p className="text-sm text-text-muted flex items-center gap-1">
                  <Calendar size={13} /> {booking.days} Tag{booking.days !== 1 ? "e" : ""}
                  {" · "}gebucht am {formatDateDE(booking.created_at)}
                </p>
              </div>
              <span className="px-2.5 py-1 bg-bg-elevated border border-border text-text-muted text-xs rounded-full shrink-0">
                {typeLabels[booking.listing_type] ?? booking.listing_type}
              </span>
            </div>

            {booking.start_date && booking.end_date && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-3 bg-bg-elevated border border-border rounded-lg text-center">
                  <div className="text-xs text-text-muted mb-1">Von</div>
                  <div className="text-sm font-semibold text-text-primary">{formatDateDE(booking.start_date)}</div>
                </div>
                <div className="p-3 bg-bg-elevated border border-border rounded-lg text-center">
                  <div className="text-xs text-text-muted mb-1">Bis</div>
                  <div className="text-sm font-semibold text-text-primary">{formatDateDE(booking.end_date)}</div>
                </div>
              </div>
            )}

            {/* Kostenaufschlüsselung */}
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">{booking.daily_rate.toLocaleString()} € × {booking.days} Tag{booking.days !== 1 ? "e" : ""}</span>
                <span className="text-text-primary">{booking.subtotal.toLocaleString()} €</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span className="text-text-primary">Gesamtbetrag</span>
                <span className="text-gold font-display text-lg">{booking.total.toLocaleString()} €</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nächste Schritte */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-text-primary mb-4">Was passiert als nächstes?</h3>
          <div className="space-y-4">
            {steps.map(({ label, done, desc }, i) => (
              <div key={label} className="flex gap-4 items-start">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  done ? "bg-success/10 border border-success/20" : "bg-bg-elevated border border-border"
                }`}>
                  {done ? (
                    <CheckCircle size={14} className="text-success" />
                  ) : (
                    <span className="text-xs text-text-muted">{i + 1}</span>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${done ? "text-text-primary" : "text-text-secondary"}`}>{label}</p>
                  <p className="text-xs text-text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Aktionen */}
        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => navigator.share?.({ title: `Buchung: ${booking.listing_title}`, text: `Buchungsreferenz: ${booking.ref}` }).catch(() => {})}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-border text-text-secondary text-sm rounded-lg hover:border-gold hover:text-gold transition-all"
          >
            <Share2 size={15} /> Details teilen
          </button>
          <Link href="/dashboard?tab=messages" className="flex items-center justify-center gap-2 px-4 py-3 border border-border text-text-secondary text-sm rounded-lg hover:border-gold hover:text-gold transition-all">
            <MessageSquare size={15} /> Anbieter kontaktieren
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard?tab=bookings"
            className="flex-1 text-center px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
          >
            Zu meinen Buchungen <ArrowRight size={15} />
          </Link>
          <Link
            href="/locations"
            className="flex-1 text-center px-6 py-3 border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors font-medium"
          >
            Weitere Drehorte entdecken
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={<div className="pt-32 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-gold" /></div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
