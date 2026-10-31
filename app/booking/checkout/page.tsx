"use client";

import { useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {useLocale, useTranslations} from "next-intl";
import {bookingDateKey, bookingDays, submitBookingRequest} from "@/lib/booking-request";
import {
  Shield, CreditCard, Calendar, MapPin, Info, Lock,
  ChevronRight, CheckCircle, ArrowLeft, AlertCircle,
} from "lucide-react";

function CheckoutContent() {
  const t = useTranslations("BookingRequest");
  const locale = useLocale();
  const pending = useRef(false);
  const [submitError, setSubmitError] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const listingTitle = searchParams.get("title") ?? "";
  const listingPrice = Number(searchParams.get("price") ?? 0);
  const listingType = searchParams.get("type") ?? "location";

  const urlStart = searchParams.get("startDate") ?? "";
  const urlEnd   = searchParams.get("endDate") ?? "";
  const urlDays  = Number(searchParams.get("days") ?? 1);

  const [days, setDays] = useState(() => urlStart && urlEnd ? bookingDays(urlStart, urlEnd) : urlDays > 0 ? urlDays : 1);
  const [startDate, setStartDate] = useState(urlStart);
  const [endDate, setEndDate] = useState(urlEnd);
  const [notes, setNotes] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const today = bookingDateKey(new Date());

  // Auto-calculate days when both dates are set
  const calcDays = (start: string, end: string) => {
    if (!start || !end) return;
    setDays(bookingDays(start, end));
  };

  const subtotal = listingPrice * days;
  const total = subtotal;

  const canProceedStep1 = startDate >= today && endDate >= startDate && days >= 1;
  const canProceedStep2 = agreeTerms;

  const handleSubmit = async () => {
    if (pending.current || !canProceedStep1 || !canProceedStep2) return;
    pending.current = true;
    setLoading(true);
    setSubmitError(false);
    try {
      const ref = await submitBookingRequest({
        listingId: searchParams.get("id"), startDate, endDate, notes,
      });
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
      setSubmitError(true);
      pending.current = false;
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    location: t("typeLocation"),
    vehicle: t("typeVehicle"),
    prop: t("typeProp"),
    creator: t("typeCreator"),
  };

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="#" onClick={(e) => { e.preventDefault(); router.back(); }}
            aria-label={t("back")} className="min-w-11 min-h-11 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:border-gold hover:text-gold transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">{t("request")}</h1>
            <p className="text-xs text-text-muted">{t("step", {step})}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          {[{ n: 1, label: t("details") }, { n: 2, label: t("review") }].map(({ n, label }) => (
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
                    <Calendar size={16} className="text-gold" /> {t("choosePeriod")}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="request-start" className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{t("from")}</label>
                      <input
                        id="request-start" type="date"
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
                      <label htmlFor="request-end" className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">{t("until")}</label>
                      <input
                        id="request-end" type="date"
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
                      <span className="text-gold font-semibold">{t("days", {count: days})}</span> · {(listingPrice * days).toLocaleString(locale)} €
                    </p>
                  )}
                </div>

                <div className="p-6 rounded-2xl border border-border bg-bg-secondary">
                  <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Info size={16} className="text-gold" /> {t("notes")}
                  </h2>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    aria-label={t("notes")} placeholder={t("notesPlaceholder")}
                    rows={4}
                    className="w-full py-2.5 px-3 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold transition-colors resize-none"
                  />
                </div>

                {/* Direct request terms */}
                <div className="flex items-start gap-3 p-4 bg-bg-elevated border border-gold/20 rounded-xl">
                  <AlertCircle size={16} className="text-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-text-primary mb-1">{t("directAgreement")}</p>
                    <p className="text-xs text-text-muted leading-relaxed">
                      {t("directTerms")}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="w-full py-3.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {t("continue")} <ChevronRight size={16} />
                </button>
              </>
            )}

            {/* Step 2: Confirmation */}
            {step === 2 && (
              <>
                <div className="p-6 rounded-2xl border border-border bg-bg-secondary">
                  <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-gold" /> {t("review")}
                  </h2>


                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-text-muted">{t("listing")}</span>
                      <span className="text-text-primary font-medium truncate max-w-[200px]">{listingTitle}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-text-muted">{t("period")}</span>
                      <span className="text-text-primary font-medium">{startDate} → {endDate}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-text-muted">{t("duration")}</span>
                      <span className="text-text-primary font-medium">{t("days", {count: days})}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-text-muted font-semibold">{t("estimatedTotal")}</span>
                      <span className="text-gold font-bold font-display">{total.toLocaleString(locale)} €</span>
                    </div>
                  </div>
                </div>

                {/* Request workflow */}
                <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                  <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2 text-sm">
                    <Shield size={15} className="text-gold" /> {t("howItWorks")}
                  </h3>
                  <div className="space-y-3">
                    {[
                      { step: "1", text: t("flow1") },
                      { step: "2", text: t("flow2") },
                      { step: "3", text: t("flow3") },
                      { step: "4", text: t("flow4") },
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
                    {t.rich("acknowledgement", {terms: chunks => <Link href="/agb" className="text-gold hover:text-gold-light">{chunks}</Link>})}
                  </span>
                </label>

                {submitError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{t("submitError")}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="px-5 py-3.5 border border-border text-text-secondary rounded-xl hover:border-gold hover:text-gold transition-all text-sm font-medium"
                  >
                    {t("back")}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canProceedStep2 || loading}
                    className="flex-1 py-3.5 bg-gold text-bg-primary font-semibold rounded-xl hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-bg-primary/40 border-t-bg-primary rounded-full animate-spin" />
                        {t("sending")}
                      </>
                    ) : (
                      <>
                        <CheckCircle size={15} /> {t("send")}
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
                <h2 className="font-semibold text-text-primary mb-5">{t("summary")}</h2>

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
                    <span className="text-text-muted">{listingPrice.toLocaleString(locale)} € × {t("days", {count: days})}</span>
                    <span className="text-text-primary">{subtotal.toLocaleString(locale)} €</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-text-primary pt-3 border-t border-border">
                    <span>{t("estimatedTotal")}</span>
                    <span className="text-gold font-display text-lg">{total.toLocaleString(locale)} €</span>
                  </div>
                </div>

                {/* Trust badges */}
                <div className="space-y-2 text-xs text-text-muted">
                  {[
                    { icon: Shield, text: t("requestOnly") },
                    { icon: CheckCircle, text: t("noCommission") },
                    { icon: Lock, text: t("directTerms") },
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
  const t = useTranslations("common");
  return (
    <Suspense fallback={<div className="pt-32 text-center text-text-muted">{t("loading")}</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
