"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Calendar, MapPin, Share2, MessageSquare, ArrowRight, Wallet } from "lucide-react";
import { calculateCommission } from "@/lib/commission";

const typeLabels: Record<string, string> = {
  location: "Drehort",
  vehicle: "Fahrzeug",
  prop: "Requisite",
  creator: "Filmschaffende/r",
};

function formatDateDE(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

function ConfirmationContent() {
  const searchParams = useSearchParams();

  const ref = searchParams.get("ref") ?? "CG-XXXXXX";
  const title = searchParams.get("title") ?? "Buchung";
  const listingType = searchParams.get("type") ?? "location";
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";
  const days = Number(searchParams.get("days") ?? 1);
  const dailyRate = Number(searchParams.get("price") ?? 0);

  const subtotal = dailyRate * days;
  const commission = calculateCommission(subtotal);

  const steps = [
    { label: "Buchung bestätigt", done: true, desc: `Referenz: ${ref}` },
    { label: "Zahlung eingegangen", done: true, desc: "Betrag gesichert — Freigabe nach Durchführung" },
    { label: "Anbieter meldet sich", done: false, desc: "Der Anbieter meldet sich innerhalb von 24 Stunden" },
    { label: "Drehtag", done: false, desc: startDate ? `Ab ${formatDateDE(startDate)}` : "Termin vereinbaren" },
  ];

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Erfolgs-Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={38} className="text-success" />
          </div>
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
            Buchung bestätigt!
          </h1>
          <p className="text-text-muted mb-1">
            Referenz: <span className="text-gold font-mono font-semibold">{ref}</span>
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-full text-success text-xs font-semibold mt-1">
            <CheckCircle size={11} /> Zahlung gesichert — Auszahlung nach Abschluss
          </div>
        </div>

        {/* Buchungskarte */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden mb-6">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-text-primary mb-1">{title}</h2>
                <p className="text-sm text-text-muted flex items-center gap-1">
                  <Calendar size={13} /> {days} Tag{days !== 1 ? "e" : ""}
                </p>
              </div>
              <span className="px-2.5 py-1 bg-bg-elevated border border-border text-text-muted text-xs rounded-full shrink-0">
                {typeLabels[listingType] ?? listingType}
              </span>
            </div>

            {startDate && endDate && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-3 bg-bg-elevated border border-border rounded-lg text-center">
                  <div className="text-xs text-text-muted mb-1 flex items-center justify-center gap-1">
                    <MapPin size={11} /> Von
                  </div>
                  <div className="text-sm font-semibold text-text-primary">{formatDateDE(startDate)}</div>
                </div>
                <div className="p-3 bg-bg-elevated border border-border rounded-lg text-center">
                  <div className="text-xs text-text-muted mb-1 flex items-center justify-center gap-1">
                    <MapPin size={11} /> Bis
                  </div>
                  <div className="text-sm font-semibold text-text-primary">{formatDateDE(endDate)}</div>
                </div>
              </div>
            )}

            {/* Transparente Provisionsaufschlüsselung */}
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">{dailyRate.toLocaleString()} € × {days} Tag{days !== 1 ? "e" : ""}</span>
                <span className="text-text-primary">{subtotal.toLocaleString()} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Plattformgebühr ({commission.rate} %)</span>
                <span className="text-text-primary">{commission.commission.toLocaleString()} €</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span className="text-text-primary">Gesamtbetrag</span>
                <span className="text-gold font-display text-lg">{(subtotal + commission.commission).toLocaleString()} €</span>
              </div>
              <div className="mt-3 p-3 bg-success/10 border border-success/20 rounded-lg flex items-center gap-2">
                <Wallet size={14} className="text-success shrink-0" />
                <div className="flex-1 flex justify-between items-center">
                  <span className="text-xs font-semibold text-success">Auszahlung an Anbieter</span>
                  <span className="text-sm font-bold text-success">{commission.payout.toLocaleString()} €</span>
                </div>
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
            onClick={() => navigator.share?.({ title: `Buchung: ${title}`, text: `Buchungsreferenz: ${ref}` }).catch(() => {})}
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
            href="/dashboard"
            className="flex-1 text-center px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
          >
            Zum Dashboard <ArrowRight size={15} />
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
    <Suspense fallback={<div className="pt-32 text-center text-text-muted">Laden...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
