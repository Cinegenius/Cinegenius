"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Star, CheckCircle, Calendar, Clock,
  MapPin, Package, Shield, Truck, ChevronRight, Phone, Expand,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

const Lightbox = dynamic(() => import("@/components/Lightbox"), { ssr: false });
import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";
import ReviewsSection from "@/components/ReviewsSection";

type Prop = {
  id: string;
  title: string;
  category: string;
  vendor: string;
  location: string;
  dailyRate: number;
  image: string;
  condition: string;
  era: string | null;
  delivery: boolean;
  description?: string;
  ownerId?: string;
  ownerName?: string;
};


const conditionColors: Record<string, string> = {
  "Neuwertig": "text-success border-success/30 bg-success/10",
  "Sehr gut": "text-gold border-gold/30 bg-gold-subtle",
  "Gut": "text-text-secondary border-border bg-bg-elevated",
  "Akzeptabel": "text-text-muted border-border bg-bg-elevated",
};

export default function PropDetail({ prop }: { prop: Prop }) {
  const router = useRouter();
  const [days, setDays] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const images = [prop.image].filter(Boolean) as string[];
  const { addToast } = useToast();

  const subtotal = prop.dailyRate * days;
  const deposit = Math.round(subtotal * 0.25);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date();
    const start = startDate || today.toISOString().split("T")[0];
    const end = new Date(new Date(start).getTime() + days * 86_400_000).toISOString().split("T")[0];
    router.push(
      `/booking/checkout?type=prop&id=${prop.id}` +
      `&title=${encodeURIComponent(prop.title)}` +
      `&price=${prop.dailyRate}&days=${days}` +
      `&startDate=${start}&endDate=${end}`
    );
  };

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/props" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors mb-6">
          <ArrowLeft size={14} /> Zurück zu Requisiten & Verleih
        </Link>

        {/* Bildergalerie */}
        <div className="relative grid grid-cols-4 gap-2 rounded-xl overflow-hidden h-72 sm:h-96 mb-8">
          <div
            className="col-span-2 overflow-hidden cursor-pointer"
            onClick={() => { setActiveImg(0); setLightboxOpen(true); }}
          >
            <Image
              src={images[activeImg]}
              alt={prop.title}
              fill
              className="object-cover hover:scale-105 transition-transform duration-500"
              sizes="50vw"
              priority
            />
          </div>
          {images.length > 1 && (
            <div className="col-span-2 grid grid-cols-2 gap-2">
              {images.slice(1).map((img, i) => (
                <div
                  key={i}
                  className={`overflow-hidden cursor-pointer rounded-sm ${i === 2 ? "col-span-2 h-24" : ""}`}
                  onClick={() => { setActiveImg(i + 1); setLightboxOpen(true); }}
                >
                  <Image
                    src={img}
                    alt=""
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-500"
                    sizes="25vw"
                  />
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-bg-primary/80 border border-border text-text-secondary text-xs rounded-lg hover:border-gold hover:text-gold transition-all backdrop-blur-sm"
          >
            <Expand size={13} /> Alle Fotos anzeigen
          </button>
        </div>

        {lightboxOpen && (
          <Lightbox
            images={images}
            activeIndex={activeImg}
            alt={prop.title}
            onClose={() => setLightboxOpen(false)}
            onPrev={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
            onNext={() => setActiveImg((i) => (i + 1) % images.length)}
          />
        )}

        <div className="flex gap-10 flex-col lg:flex-row">
          {/* LEFT */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-2.5 py-1 bg-bg-secondary border border-border text-text-muted text-xs rounded-full">
                {prop.category}
              </span>
              {prop.era && (
                <span className="px-2.5 py-1 bg-gold-subtle border border-gold/20 text-gold text-xs rounded-full">
                  {prop.era}
                </span>
              )}
              <span className={`px-2.5 py-1 border text-xs rounded-full font-medium ${conditionColors[prop.condition] ?? conditionColors["Gut"]}`}>
                {prop.condition}
              </span>
              {prop.delivery && (
                <span className="px-2.5 py-1 bg-success/10 border border-success/20 text-success text-xs rounded-full flex items-center gap-1">
                  <Truck size={11} /> Lieferung verfügbar
                </span>
              )}
            </div>

            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary">
                {prop.title}
              </h1>
              <FavoriteButton
                listingId={prop.id}
                listingType="prop"
                listingTitle={prop.title}
                listingCity={prop.location}
                listingPrice={prop.dailyRate}
                listingImage={prop.image}
                className="shrink-0 mt-1"
              />
            </div>

            <div className="flex items-center gap-3 text-sm text-text-muted mb-6">
              <span className="flex items-center gap-1"><Package size={14} className="text-gold" /> {prop.vendor}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><MapPin size={14} className="text-gold" /> {prop.location}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              {[
                { label: "Tagesrate", value: `${prop.dailyRate} €/Tag` },
                { label: "Zustand", value: prop.condition },
                { label: "Kategorie", value: prop.category },
                { label: "Abholung / Lieferung", value: prop.delivery ? "Beides möglich" : "Nur Abholung" },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 bg-bg-secondary border border-border rounded-xl text-center">
                  <div className="text-xs uppercase tracking-widest text-text-muted mb-1">{label}</div>
                  <div className="text-sm font-semibold text-text-primary">{value}</div>
                </div>
              ))}
            </div>

            <div className="mb-8">
              <h2 className="font-display text-xl font-bold text-text-primary mb-3">Über diesen Artikel</h2>
              {prop.description ? (
                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">{prop.description}</p>
              ) : (
                <p className="text-text-muted italic text-sm">Keine Beschreibung vorhanden.</p>
              )}
            </div>

            <div className="mb-8">
              <h2 className="font-display text-xl font-bold text-text-primary mb-4">Im Lieferumfang enthalten</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Artikel wie beschrieben, gereinigt und einsatzbereit",
                  "Vollständiger Zustandsbericht mit Fotos",
                  "Grundlegende Bedienungsanleitung",
                  "Anbieter-Kontakt während der Produktion",
                  "Rückgabeverpackung / Koffer (falls vorhanden)",
                  "Digitaler Mietvertrag",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                    <CheckCircle size={14} className="text-success mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>


            <div className="mb-8">
              <ReviewsSection
                targetId={prop.id}
                targetType="prop"
                targetName={prop.title}
              />
            </div>

            <div className="p-5 bg-bg-secondary border border-border rounded-xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Package size={20} className="text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary">{prop.vendor}</p>
                <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                  <MapPin size={11} /> {prop.location} · Mitglied seit 2023
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={11} className={i < 4 ? "text-gold fill-gold" : "text-border"} />
                  ))}
                  <span className="text-xs text-text-muted ml-1">4,8 · 34 Bewertungen</span>
                </div>
              </div>
              <button className="px-3 py-1.5 border border-border text-text-secondary text-xs font-medium rounded-lg hover:border-gold hover:text-gold transition-all shrink-0 flex items-center gap-1.5">
                <Phone size={12} /> Kontakt
              </button>
            </div>
          </div>

          {/* BOOKING SIDEBAR */}
          <div className="lg:w-[360px] shrink-0">
            <div className="sticky top-20">
              <div className="bg-bg-secondary border border-border rounded-xl p-6">
                <div className="flex items-end gap-1 mb-5">
                  <span className="text-3xl font-bold font-display text-text-primary">{prop.dailyRate} €</span>
                  <span className="text-text-muted mb-1">/Tag</span>
                </div>

                {prop.ownerId ? (
                  <InquiryForm
                    listingId={prop.id}
                    listingTitle={prop.title}
                    listingType="prop"
                    ownerId={prop.ownerId}
                    ownerName={prop.ownerName ?? "Anbieter"}
                  />
                ) : submitted ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={28} className="text-success" />
                    </div>
                    <h3 className="font-display text-xl font-bold text-text-primary mb-2">Anfrage gesendet!</h3>
                    <p className="text-text-muted text-sm leading-relaxed mb-4">
                      {prop.vendor} bestätigt die Verfügbarkeit innerhalb von 24 Stunden.
                    </p>
                    <button onClick={() => setSubmitted(false)} className="text-xs text-gold hover:text-gold-light transition-colors">
                      Weitere Anfrage stellen
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Startdatum</label>
                      <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold transition-colors">
                        <Calendar size={15} className="text-text-muted" />
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-transparent border-none py-2.5 text-sm flex-1 focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Mietdauer</label>
                      <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold transition-colors">
                        <Clock size={15} className="text-text-muted" />
                        <select
                          value={days}
                          onChange={(e) => setDays(Number(e.target.value))}
                          className="bg-transparent border-none py-2.5 text-sm flex-1 focus:outline-none"
                        >
                          {[1, 2, 3, 4, 5, 7, 10, 14, 21, 28].map((d) => (
                            <option key={d} value={d}>
                              {d} {d === 1 ? "Tag" : "Tage"}{d === 7 ? " (1 Woche)" : d === 14 ? " (2 Wochen)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {prop.delivery && (
                      <div>
                        <label className="text-xs uppercase tracking-widest text-text-muted font-semibold block mb-1.5">Abholmethode</label>
                        <select className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors">
                          <option>Selbst abholen ({prop.location})</option>
                          <option>Lieferung (Angebot auf Anfrage)</option>
                        </select>
                      </div>
                    )}

                    <div className="pt-4 border-t border-border space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">{prop.dailyRate} € × {days} {days === 1 ? "Tag" : "Tage"}</span>
                        <span className="text-text-primary">{subtotal.toLocaleString()} €</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Kaution (25%)</span>
                        <span className="text-text-primary">{deposit.toLocaleString()} €</span>
                      </div>
                      <div className="flex justify-between font-semibold text-text-primary pt-2 border-t border-border">
                        <span>Heute fällig</span>
                        <span className="text-gold font-display text-lg">{deposit.toLocaleString()} €</span>
                      </div>
                      <p className="text-xs text-text-muted">
                        Verbleibende {(subtotal - deposit).toLocaleString()} € bei Abholung fällig.
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-gold text-bg-primary font-semibold rounded-lg hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
                    >
                      <Package size={15} /> Miete anfragen
                    </button>
                    <p className="text-center text-xs text-text-muted flex items-center justify-center gap-1">
                      <Shield size={11} /> Sichere Zahlung · Keine Belastung vor Bestätigung
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
