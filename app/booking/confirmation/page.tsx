"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Calendar, Share2, MessageSquare, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";


const typeLabels: Record<string, string> = {
  location: "Location",
  vehicle: "Fahrzeug",
  prop: "Requisite",
  creator: "Filmschaffende/r",
  job: "Job",
};

function formatDateDE(locale: string, iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
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
  const uiText = useTranslations();
  const uiLocale = useLocale();

  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") ?? "";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadedRef, setLoadedRef] = useState("");
  const [error, setError] = useState("");
  const loading = Boolean(ref) && loadedRef !== ref;

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    fetch(`/api/bookings?ref=${encodeURIComponent(ref)}`)
      .then((r) => r.json())
      .then(({ booking, error }) => {
        if (cancelled) return;
        if (error || !booking) setError(uiText("Ui.text_b5931e2b0e3692"));
        else setBooking(booking);
      })
      .catch(() => { if (!cancelled) setError(uiText("Ui.text_ad0850c1ba1b13")); })
      .finally(() => { if (!cancelled) setLoadedRef(ref); });
    return () => { cancelled = true; };
  }, [ref]);

  if (loading) {
    return (
      <div className="pt-32 min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gold" />
      </div>
    );
  }

  if (!ref || error || !booking) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
          <AlertCircle size={36} className="mx-auto text-text-muted opacity-40" />
          <p className="text-text-muted">{!ref ? uiText("Ui.text_b7c3fa7fce82a0") : error || uiText("Ui.text_893d034b3b8813")}</p>
          <Link href="/dashboard?tab=bookings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-lg text-sm hover:bg-gold-light transition-colors">{uiText("Ui.text_aceab55d5b6365")}</Link>
        </div>
      </div>
    );
  }

  const isPending = booking.status === "pending";
  const steps = [
    { label: uiText("Ui.text_dcdbf2ab96928d"), done: true, desc: uiText("Ui.text_826326ca4128b5", { value1: String(booking.ref) }) },
    { label: uiText("Ui.text_d739950846941e"), done: !isPending, desc: isPending ? uiText("Ui.text_912a72e0f0efbe") : uiText("Ui.text_80f6f822ea79a9") },
    { label: uiText("Ui.text_ac164d66961c52"), done: false, desc: booking.start_date ? uiText("Ui.text_a3b54a67177886", { value1: String(formatDateDE(uiLocale, booking.start_date)) }) : uiText("Ui.text_8ad5ef4397f2f4") },
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
            {isPending ? uiText("Ui.text_3cc5126c50dc13") : uiText("Ui.text_b56903f2b70a1c")}
          </h1>
          <p className="text-text-muted mb-1">{uiText.rich("Ui.text_1581cb1d4e1728", { value2: () => (booking.ref), part1: chunks => (<span className="text-gold font-mono font-semibold">{chunks}</span>) })}</p>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mt-1 ${isPending ? "bg-gold/10 border border-gold/30 text-gold" : "bg-success/10 border border-success/20 text-success"}`}>
            <CheckCircle size={11} /> {isPending ? uiText("Ui.text_ab9996d3b2e110") : uiText("profile.notifBookingConfirmed")}
          </div>
        </div>

        {/* Buchungskarte */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden mb-6">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-text-primary mb-1">{booking.listing_title}</h2>
                <p className="text-sm text-text-muted flex items-center gap-1">{uiText.rich("Ui.text_013b588664af5a", { part1: () => (<Calendar size={13} />), value2: () => (booking.days), count3: booking.days, value4: () => (formatDateDE(uiLocale, booking.created_at)) })}</p>
              </div>
              <span className="px-2.5 py-1 bg-bg-elevated border border-border text-text-muted text-xs rounded-full shrink-0">
                {typeLabels[booking.listing_type] ?? booking.listing_type}
              </span>
            </div>

            {booking.start_date && booking.end_date && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-3 bg-bg-elevated border border-border rounded-lg text-center">
                  <div className="text-xs text-text-muted mb-1">{uiText("BookingRequest.from")}</div>
                  <div className="text-sm font-semibold text-text-primary">{formatDateDE(uiLocale, booking.start_date)}</div>
                </div>
                <div className="p-3 bg-bg-elevated border border-border rounded-lg text-center">
                  <div className="text-xs text-text-muted mb-1">{uiText("BookingRequest.until")}</div>
                  <div className="text-sm font-semibold text-text-primary">{formatDateDE(uiLocale, booking.end_date)}</div>
                </div>
              </div>
            )}

            {/* Kostenaufschlüsselung */}
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex justify-between text-sm">{uiText.rich("Ui.text_cbefb42b83905c", { value2: () => (booking.daily_rate.toLocaleString(uiLocale)), value3: () => (booking.days), count4: booking.days, part1: chunks => (<span className="text-text-muted">{chunks}</span>), value6: () => (booking.subtotal.toLocaleString(uiLocale)), part5: chunks => (<span className="text-text-primary">{chunks}</span>) })}</div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">{uiText.rich("Ui.text_4d5abaa43e067c", { part1: chunks => (<span className="text-text-primary">{chunks}</span>), value3: () => (booking.total.toLocaleString(uiLocale)), part2: chunks => (<span className="text-gold font-display text-lg">{chunks}</span>) })}</div>
            </div>
          </div>
        </div>

        {/* Nächste Schritte */}
        <div className="bg-bg-secondary border border-border rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-text-primary mb-4">{uiText("Ui.text_91f9dc15e1d9da")}</h3>
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
            onClick={() => navigator.share?.({ title: uiText("Ui.text_1d149a1865a989", { value1: String(booking.listing_title) }), text: uiText("Ui.text_6a1aa35ad6f0ae", { value1: String(booking.ref) }) }).catch(() => {})}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-border text-text-secondary text-sm rounded-lg hover:border-gold hover:text-gold transition-all"
          >{uiText.rich("Ui.text_5aea4a75e4a903", { part1: () => (<Share2 size={15} />) })}</button>
          <Link href="/dashboard?tab=messages" className="flex items-center justify-center gap-2 px-4 py-3 border border-border text-text-secondary text-sm rounded-lg hover:border-gold hover:text-gold transition-all">{uiText.rich("Ui.text_003661ebcf8ea9", { part1: () => (<MessageSquare size={15} />) })}</Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">{uiText.rich("Ui.text_24bf09d9c3298c", { part2: () => (<ArrowRight size={15} />), part1: chunks => (<Link
            href="/dashboard?tab=bookings"
            className="flex-1 text-center px-6 py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
          >{chunks}</Link>), part3: chunks => (<Link
            href="/locations"
            className="flex-1 text-center px-6 py-3 border border-border text-text-secondary rounded-lg hover:border-gold hover:text-gold transition-colors font-medium"
          >{chunks}</Link>) })}</div>
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
