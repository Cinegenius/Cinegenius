"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield, CreditCard, Calendar, MapPin, Info,
  ChevronRight, CheckCircle, ArrowLeft, AlertCircle,
} from "lucide-react";

const COMMISSION_RATE = 0.10;

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const listingTitle = searchParams.get("title") ?? "";
  const listingPrice = Number(searchParams.get("price") ?? 0);
  const listingType = searchParams.get("type") ?? "location";

  const urlStart = searchParams.get("startDate") ?? "";
  const urlEnd   = searchParams.get("endDate") ?? "";
  const urlDays  = Number(searchParams.get("days") ?? 1);

  const [days, setDays] = useState(() => urlDays > 0 ? urlDays : 1);
  const [startDate, setStartDate] = useState(urlStart);
  const [endDate, setEndDate] = useState(urlEnd);
  const [notes, setNotes] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const today = new Date().toISOString().split("T")[0];

  // Auto-calculate days when both dates are set
  const calcDays = (start: string, end: string) => {
    if (!start || !end) return;
    const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
    if (diff >= 1) setDays(diff);
  };

  const subtotal = listingPrice * days;
  const platformFee = Math.round(subtotal * COMMISSION_RATE);
  const total = subtotal + platformFee;
  const providerPayout = subtotal - Math.round(subtotal * COMMISSION_RATE);

  const canProceedStep1 = startDate && endDate && days >= 1;
  const canProceedStep2 = agreeTerms;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: searchParams.get("id"),
          listingTitle,
          listingType,
          startDate,
          endDate,
          days,
          dailyRate: listingPrice,
          notes,
        }),
      });
      const data = await res.json();
      const ref = res.ok ? data.ref : "CG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const params = new URLSearchParams({
        ref,
        title: listingTitle,
        type: listingType,
        startDate,
        endDate,
        days: String(days),
        price: String(listingPrice),
      });
      router.push(`/booking/confirmation?${params.toString()}`);
    } catch {
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    location: "Drehort",
    vehicle: "Fahrzeug",
    prop: "Requisite",
    creator: "Filmschaffende/r",
  };

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="#" onClick={(e) => { e.preventDefault(); router.back(); }}
            className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:border-gold hover:text-gold transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Sichere Buchung</h1>
            <p className="text-xs text-text-muted">Schritt {step} von 2</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          {[{ n: 1, label: "Buchungsdetails" }, { n: 2, label: "Zahlung" }].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                step === n ? "bg-gold text-bg-primary" :
                step > n ? "bg-success/10 text-success border border-success/20" :
                "bg-bg-elevated text-text-muted border border-border"
              }`}>
                {step > n ? <CheckCircle size={12} /> : <span>{n}</span>}
                {label}
              </div>
              {n < 2 && <ChevronRight size={14} className="text-text-muted" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Step 1: Booking Details */}
            {step === 1 && (
              <>
                <div className="p-6 rounded-2xl border border-border bg-bg-secondary">
                  <h2 className="font-semibold text-text-primary mb-5 flex items-center gap-2">
                    <Calendar size={16} className="text-gold" /> Zeitraum wählen
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Von</label>
                      <input
                        type="date"
                        value={startDate}
                        min={today}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStartDate(val);
                          if (endDate && endDate <= val) setEndDate("");
                          else calcDays(val, endDate);
                        }}
                        className="w-full py-2.5 px-3 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Bis</label>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate || today}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEndDate(val);
                          calcDays(startDate, val);
                        }}
                        className="w-full py-2.5 px-3 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-gold transition-colors"
                      />
                    </div>
                  </div>
                  {startDate && endDate && (
                    <p className="text-xs text-text-muted">
                      <span className="text-gold font-semibold">{days} Tag{days !== 1 ? "e" : ""}</span> · {(listingPrice * days).toLocaleString()} € Netto
                    </p>
                  )}
                </div>

                <div className="p-6 rounded-2xl border border-border bg-bg-secondary">
                  <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Info size={16} className="text-gold" /> Produktionsdetails (optional)
                  </h2>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Projektbeschreibung, Team-Größe, spezielle Anforderungen..."
                    rows={4}
                    className="w-full py-2.5 px-3 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
                  />
                </div>

                {/* Anti-bypass hinweis */}
                <div className="flex items-start gap-3 p-4 bg-bg-elevated border border-gold/20 rounded-xl">
                  <AlertCircle size={16} className="text-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-text-primary mb-1">Alle Kommunikation über die Plattform</p>
                    <p className="text-xs text-text-muted leading-relaxed">
                      Bitte tausche keine externen Kontaktdaten aus, bevor die Buchung abgeschlossen ist.
                      Unsere In-Plattform-Nachrichten schützen beide Seiten und sichern deine Zahlung.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="w-full py-3.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Weiter zur Zahlung <ChevronRight size={16} />
                </button>
              </>
            )}

            {/* Step 2: Confirmation */}
            {step === 2 && (
              <>
                <div className="p-6 rounded-2xl border border-border bg-bg-secondary">
                  <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-gold" /> Buchung bestätigen
                  </h2>

                  {/* Demo notice */}
                  <div className="p-4 mb-5 rounded-xl bg-gold/5 border border-gold/20 flex items-start gap-3">
                    <AlertCircle size={15} className="text-gold shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gold mb-0.5">Demo-Modus — keine echte Zahlung</p>
                      <p className="text-xs text-text-muted leading-relaxed">
                        Die Zahlungsintegration (Stripe) ist noch nicht aktiv. Deine Buchung wird gespeichert,
                        aber es wird keine Karte belastet. Die Stripe-Anbindung folgt in einem Update.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-text-muted">Inserat</span>
                      <span className="text-text-primary font-medium truncate max-w-[200px]">{listingTitle}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-text-muted">Zeitraum</span>
                      <span className="text-text-primary font-medium">{startDate} → {endDate}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-text-muted">Dauer</span>
                      <span className="text-text-primary font-medium">{days} Tag{days > 1 ? "e" : ""}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-text-muted font-semibold">Gesamtbetrag</span>
                      <span className="text-gold font-bold font-display">{total.toLocaleString()} €</span>
                    </div>
                  </div>
                </div>

                {/* Escrow Erklärung */}
                <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                  <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2 text-sm">
                    <Shield size={15} className="text-gold" /> Treuhand-System (Escrow)
                  </h3>
                  <div className="space-y-3">
                    {[
                      { step: "1", text: "Du zahlst den Gesamtbetrag sicher über CineGenius." },
                      { step: "2", text: "Das Geld wird von der Plattform treuhänderisch gehalten." },
                      { step: "3", text: "Zahlung wird nach erfolgreicher Nutzung freigegeben." },
                      { step: "4", text: "Anbieter erhält 90% — CineGenius behält 10% Provision." },
                    ].map(({ step: s, text }) => (
                      <div key={s} className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                          {s}
                        </span>
                        <p className="text-xs text-text-muted leading-relaxed">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AGB */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="accent-gold mt-0.5"
                  />
                  <span className="text-xs text-text-muted leading-relaxed">
                    Ich stimme den{" "}
                    <Link href="/help" className="text-gold hover:text-gold-light">Nutzungsbedingungen</Link>,{" "}
                    der <Link href="/help" className="text-gold hover:text-gold-light">Stornierungsrichtlinie</Link> und
                    der treuhänderischen Zahlungsabwicklung durch CineGenius zu.
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="px-5 py-3.5 border border-border text-text-secondary rounded-xl hover:border-gold hover:text-gold transition-all text-sm font-medium"
                  >
                    Zurück
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canProceedStep2 || loading}
                    className="flex-1 py-3.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-bg-primary/40 border-t-bg-primary rounded-full animate-spin" />
                        Zahlung wird verarbeitet...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={15} /> Buchung jetzt bestätigen
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <div className="p-6 rounded-2xl border border-border bg-bg-secondary">
                <h2 className="font-semibold text-text-primary mb-5">Buchungsübersicht</h2>

                <div className="flex items-start gap-3 pb-5 border-b border-border mb-5">
                  <div className="w-16 h-12 rounded-lg bg-bg-elevated border border-border overflow-hidden shrink-0">
                    <div className="w-full h-full bg-gradient-to-br from-gold/20 to-bg-elevated flex items-center justify-center">
                      <MapPin size={16} className="text-gold" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary leading-snug">{listingTitle}</p>
                    <span className="text-xs px-2 py-0.5 bg-bg-elevated border border-border text-text-muted rounded mt-1 inline-block">
                      {typeLabels[listingType] ?? listingType}
                    </span>
                  </div>
                </div>

                {/* Preisaufschlüsselung */}
                <div className="space-y-2.5 mb-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">{listingPrice.toLocaleString()} € × {days} Tag{days > 1 ? "e" : ""}</span>
                    <span className="text-text-primary">{subtotal.toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted flex items-center gap-1">
                      Plattformgebühr (10%)
                      <span className="text-[10px] px-1.5 py-0.5 bg-bg-elevated rounded border border-border ml-1">inkl.</span>
                    </span>
                    <span className="text-text-primary">{platformFee.toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-text-primary pt-3 border-t border-border">
                    <span>Gesamtbetrag</span>
                    <span className="text-gold font-display text-lg">{total.toLocaleString()} €</span>
                  </div>
                </div>

                {/* Auszahlungs-Transparenz */}
                <div className="p-3 bg-bg-elevated rounded-lg border border-border mb-4">
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-widest mb-2">Auszahlung an Anbieter</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Buchungsbetrag</span>
                    <span className="text-text-primary">{subtotal.toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">− CineGenius (10%)</span>
                    <span className="text-crimson-light">−{Math.round(subtotal * COMMISSION_RATE).toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-success pt-2 border-t border-border mt-2">
                    <span>Anbieter erhält</span>
                    <span>{providerPayout.toLocaleString()} €</span>
                  </div>
                </div>

                {/* Trust badges */}
                <div className="space-y-2 text-xs text-text-muted">
                  {[
                    { icon: Shield, text: "Geld in Treuhand bis zur Bestätigung" },
                    { icon: CheckCircle, text: "Kostenlose Stornierung bis 48h vorher" },
                    { icon: AlertCircle, text: "Stripe-Zahlung kommt in einem Update" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2">
                      <Icon size={12} className="text-gold shrink-0" />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="pt-32 text-center text-text-muted">Laden...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
