import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  MapPin, CheckCircle, Star, Car, Calendar, Shield,
  Truck, ArrowRight, Zap, Info,
} from "lucide-react";
import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";
import ReviewsSection from "@/components/ReviewsSection";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

async function getVehicle(slug: string) {
  const { data } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("id", slug)
    .eq("type", "vehicle")
    .single();

  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    type: "Fahrzeug",
    make: "Privatanbieter",
    model: data.title,
    year: 0,
    color: "",
    era: null as string | null,
    condition: "Gut",
    location: data.city ?? "",
    vendor: "Privatanbieter",
    dailyRate: data.price,
    image: data.image_url ?? "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80",
    tags: ["Neu"] as string[],
    instantBook: false,
    verified: false,
    delivery: false,
    description: data.description ?? "",
    ownerId: data.user_id ?? "",
    ownerName: "Anbieter",
  };
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getVehicle(slug);
  if (!vehicle) return {};
  return {
    title: vehicle.title,
    description: `${vehicle.type} — ab ${vehicle.dailyRate.toLocaleString()} € / Tag. Jetzt auf CineGenius für Filmproduktionen mieten.`,
    openGraph: {
      title: `${vehicle.title} | CineGenius`,
      description: `${vehicle.type} mieten für Film & Foto.`,
      images: [{ url: vehicle.image, width: 800, height: 600, alt: vehicle.title }],
    },
  };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vehicle = await getVehicle(slug);
  if (!vehicle) notFound();

  const commission = 0.10;
  const platformFee = Math.round(vehicle.dailyRate * commission);
  const providerPayout = vehicle.dailyRate - platformFee;

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-6">
          <Link href="/" className="hover:text-gold transition-colors">Home</Link>
          <span>/</span>
          <Link href="/vehicles" className="hover:text-gold transition-colors">Fahrzeuge</Link>
          <span>/</span>
          <span className="text-text-secondary truncate">{vehicle.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-bg-elevated">
              <img src={vehicle.image} alt={vehicle.title} className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4 flex gap-2">
                {vehicle.instantBook && (
                  <span className="px-3 py-1 bg-gold text-bg-primary text-xs font-semibold rounded-full flex items-center gap-1">
                    <Zap size={11} /> Sofortbuchung
                  </span>
                )}
                {vehicle.verified && (
                  <span className="px-3 py-1 bg-bg-primary/80 border border-border text-text-secondary text-xs rounded-full flex items-center gap-1">
                    <CheckCircle size={11} className="text-success" /> Verifiziert
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="font-display text-3xl font-bold text-text-primary">{vehicle.title}</h1>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 bg-bg-elevated border border-border text-text-muted text-sm rounded-full">{vehicle.type}</span>
                  <FavoriteButton
                    listingId={vehicle.id}
                    listingType="vehicle"
                    listingTitle={vehicle.title}
                    listingCity={vehicle.location}
                    listingPrice={vehicle.dailyRate}
                    listingImage={vehicle.image}
                  />
                </div>
              </div>
              <p className="text-text-muted flex items-center gap-1 mb-4">
                <MapPin size={14} /> {vehicle.location} · {vehicle.vendor}
              </p>
              <div className="flex flex-wrap gap-2">
                {vehicle.tags.map((t) => (
                  <span key={t} className="px-3 py-1 bg-bg-elevated border border-border text-text-secondary text-xs rounded-full">{t}</span>
                ))}
              </div>
            </div>

            {vehicle.make !== "Privatanbieter" && (
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Car size={16} className="text-gold" /> Fahrzeugdaten
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Marke", value: vehicle.make },
                    { label: "Modell", value: vehicle.model },
                    { label: "Baujahr", value: vehicle.year > 0 ? String(vehicle.year) : "—" },
                    { label: "Farbe", value: vehicle.color || "—" },
                    { label: "Ära", value: vehicle.era ?? "Modern" },
                    { label: "Zustand", value: vehicle.condition },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-1">{label}</p>
                      <p className="text-sm text-text-primary font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-5 rounded-xl border border-border bg-bg-secondary">
              <h2 className="font-semibold text-text-primary mb-3">Über dieses Fahrzeug</h2>
              <p className="text-text-secondary text-sm leading-relaxed">
                {"description" in vehicle && vehicle.description
                  ? String(vehicle.description)
                  : `Dieses authentische ${vehicle.make} ${vehicle.model}${vehicle.year > 0 ? ` aus dem Jahr ${vehicle.year}` : ""} ist in ${vehicle.condition.toLowerCase()} Zustand und speziell für Film- und Fernsehproduktionen aufbereitet.${vehicle.delivery ? " Lieferung zum Set ist verfügbar — kontaktiere den Anbieter für Details." : vehicle.location ? ` Selbstabholung am Standort ${vehicle.location}.` : ""}`
                }
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-bg-secondary">
              <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-gold" /> Buchungskonditionen
              </h2>
              <div className="space-y-3 text-sm text-text-secondary">
                <div className="flex justify-between py-2 border-b border-border">
                  <span>Mindestbuchungsdauer</span><span className="text-text-primary font-medium">1 Tag</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span>Stornierung bis 48h vorher</span><span className="text-success font-medium">Kostenlos</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span>Stornierung unter 48h</span><span className="text-crimson-light font-medium">50% Stornogebühr</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>Lieferung</span>
                  <span className={vehicle.delivery ? "text-success font-medium" : "text-text-muted"}>
                    {vehicle.delivery ? "Verfügbar" : "Selbstabholung"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="p-6 rounded-2xl border border-border bg-bg-secondary">
                <div className="mb-5">
                  <span className="font-display text-3xl font-bold text-gold">{vehicle.dailyRate.toLocaleString()} €</span>
                  <span className="text-text-muted text-sm"> / Tag</span>
                </div>

                <div className="p-3 rounded-lg bg-bg-elevated border border-border mb-5 text-xs space-y-2">
                  <p className="text-text-muted font-semibold uppercase tracking-widest flex items-center gap-1">
                    <Info size={11} /> Preistransparenz
                  </p>
                  <div className="flex justify-between text-text-secondary">
                    <span>Tagesrate</span><span>{vehicle.dailyRate.toLocaleString()} €</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Plattformgebühr (10%)</span><span>−{platformFee} €</span>
                  </div>
                  <div className="flex justify-between font-semibold text-success pt-1 border-t border-border">
                    <span>Anbieter erhält</span><span>{providerPayout} €</span>
                  </div>
                  <p className="text-text-muted text-[10px] pt-1">Kostenlos inserieren — wir verdienen nur, wenn du verdienst.</p>
                </div>

                <Link
                  href={`/booking/checkout?type=vehicle&id=${vehicle.id}&title=${encodeURIComponent(vehicle.title)}&price=${vehicle.dailyRate}`}
                  className="block w-full py-3.5 bg-gold text-bg-primary font-semibold text-center rounded-xl hover:bg-gold-light transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <Calendar size={16} /> Jetzt buchen
                </Link>

                {"ownerId" in vehicle && vehicle.ownerId ? (
                  <InquiryForm
                    listingId={vehicle.id}
                    listingTitle={vehicle.title}
                    listingType="vehicle"
                    ownerId={vehicle.ownerId as string}
                    ownerName={vehicle.ownerName as string}
                  />
                ) : (
                  <div className="mt-4 flex items-start gap-2 p-3 bg-gold-subtle rounded-lg border border-gold/20">
                    <Shield size={14} className="text-gold shrink-0 mt-0.5" />
                    <p className="text-xs text-text-muted leading-relaxed">
                      Sichere Zahlung über CineGenius. Geld wird erst nach Abschluss freigegeben.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-3 text-sm">Anbieter</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center font-bold text-gold">
                    {vehicle.vendor[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{vehicle.vendor}</p>
                    <div className="flex items-center gap-1">
                      <Star size={11} className="text-gold fill-gold" />
                      <span className="text-xs text-text-muted">4.8 (24 Bewertungen)</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Professioneller Fahrzeug-Verleiher, spezialisiert auf Film- und TV-Produktionen. Antwortet in der Regel innerhalb von 2 Stunden.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-border mb-12">
          <ReviewsSection
            targetId={vehicle.id}
            targetType="vehicle"
            targetName={vehicle.title}
          />
        </div>

        <div className="mt-0 pt-8 border-t border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold text-text-primary">Ähnliche Fahrzeuge</h2>
            <Link href="/vehicles" className="text-sm text-gold hover:text-gold-light flex items-center gap-1">
              Alle anzeigen <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
