import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  MapPin, PawPrint, Users, Truck, Calendar, Shield, ArrowRight, Pencil,
} from "lucide-react";
import InquiryForm from "@/components/InquiryForm";
import FavoriteButton from "@/components/FavoriteButton";
import ReportButton from "@/components/ReportButton";
import ReviewsSection from "@/components/ReviewsSection";
import JsonLd from "@/components/JsonLd";

async function getAnimal(slug: string) {
  try {
    const { data, error } = await db
      .from("listings")
      .select("*")
      .eq("id", slug)
      .single();

    if (error || !data) return null;
    if (data.type !== "animal") return null;

    const ownerRes = data.user_id
      ? await db.from("profiles").select("display_name").eq("user_id", data.user_id).single()
      : { data: null };
    const ownerName = (ownerRes as { data: { display_name: string | null } | null }).data?.display_name ?? "Anbieter";

    const meta = (data.metadata ?? {}) as Record<string, unknown>;

    return {
      id: data.id,
      title: data.title,
      category: data.category ?? "Tier",
      location: data.city ?? "",
      dailyRate: data.price ?? 0,
      image: data.image_url ?? "",
      trainingLevel: (meta.training_level as string) ?? null,
      handlerIncluded: (meta.handler_included as boolean) ?? false,
      count: (meta.count as string) ?? "1 Tier",
      specialSkills: (meta.special_skills as string) ?? null,
      delivery: (meta.delivery as boolean) ?? false,
      focalPoint: (meta.focal_point as { x: number; y: number } | null) ?? null,
      description: data.description ?? "",
      ownerId: data.user_id ?? "",
      ownerName,
      extra_images: data.extra_images ?? [],
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const animal = await getAnimal(slug);
    if (!animal) return {};
    return {
      title: animal.title,
      description: `${animal.category} für Filmproduktionen — ${animal.dailyRate > 0 ? `ab ${animal.dailyRate.toLocaleString()} € / Tag` : "Preis auf Anfrage"}. Jetzt auf CineGenius buchen.`,
      openGraph: {
        title: `${animal.title} | CineGenius Film-Tiere`,
        description: `${animal.category} · ${animal.trainingLevel ?? "Auf Anfrage"} · ${animal.location}`,
        ...(animal.image ? { images: [{ url: animal.image, width: 800, height: 600, alt: animal.title }] } : {}),
      },
    };
  } catch {
    return {};
  }
}

export default async function AnimalDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const animal = await getAnimal(slug);
  if (!animal) notFound();

  const { userId } = await auth();
  const isOwner = !!userId && userId === animal.ownerId;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": animal.title,
    "description": animal.description || `${animal.category} für Filmproduktionen`,
    "image": animal.image,
    "category": animal.category,
    "offers": {
      "@type": "Offer",
      "price": animal.dailyRate,
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock",
      "seller": { "@type": "Person", "name": animal.ownerName },
    },
  };

  return (
    <div className="pt-16 min-h-screen">
      <JsonLd data={jsonLd} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-text-muted mb-6">
          <Link href="/" className="hover:text-gold transition-colors">Home</Link>
          <span>/</span>
          <Link href="/tiere" className="hover:text-gold transition-colors">Film-Tiere</Link>
          <span>/</span>
          <span className="text-text-secondary truncate">{animal.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main image */}
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-bg-elevated">
              {animal.image ? (
                <img
                  src={animal.image}
                  alt={animal.title}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: animal.focalPoint ? `${animal.focalPoint.x}% ${animal.focalPoint.y}%` : "50% 40%" }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PawPrint size={64} className="text-text-muted/20" />
                </div>
              )}
            </div>

            {/* Header */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="font-display text-3xl font-bold text-text-primary">{animal.title}</h1>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 bg-bg-elevated border border-border text-text-muted text-sm rounded-full">{animal.category}</span>
                  {isOwner && (
                    <Link href="/dashboard?tab=listings"
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gold/40 text-gold text-xs font-medium rounded-lg hover:bg-gold/10 transition-colors">
                      <Pencil size={12} /> Bearbeiten
                    </Link>
                  )}
                  <FavoriteButton
                    listingId={animal.id}
                    listingType="animal"
                    listingTitle={animal.title}
                    listingCity={animal.location}
                    listingPrice={animal.dailyRate}
                    listingImage={animal.image}
                  />
                  <ReportButton listingId={animal.id} />
                </div>
              </div>
              <p className="text-text-muted flex items-center gap-1 mb-4">
                <MapPin size={14} /> {animal.location} · {animal.ownerName}
              </p>
            </div>

            {/* Tier-Daten */}
            <div className="p-5 rounded-xl border border-border bg-bg-secondary">
              <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                <PawPrint size={16} className="text-gold" /> Tier-Details
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: "Tierart", value: animal.category },
                  { label: "Dressur-Level", value: animal.trainingLevel ?? "Auf Anfrage" },
                  { label: "Anzahl", value: animal.count },
                  { label: "Handler dabei", value: animal.handlerIncluded ? "Ja" : "Nein" },
                  { label: "Lieferung", value: animal.delivery ? "Verfügbar" : "Selbstabholung" },
                  ...(animal.specialSkills ? [{ label: "Besonderheiten", value: animal.specialSkills }] : []),
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-1">{label}</p>
                    <p className="text-sm text-text-primary font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {animal.description && (
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h2 className="font-semibold text-text-primary mb-3">Über dieses Tier</h2>
                <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">{animal.description}</p>
              </div>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-3">
              {animal.handlerIncluded && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary border border-border rounded-xl text-sm text-text-secondary">
                  <Users size={15} className="text-gold" /> Professioneller Handler inklusive
                </div>
              )}
              {animal.delivery && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary border border-border rounded-xl text-sm text-text-secondary">
                  <Truck size={15} className="text-gold" /> Anlieferung zum Set möglich
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="p-6 rounded-2xl border border-border bg-bg-secondary">
                <div className="mb-5">
                  <span className="font-display text-3xl font-bold text-gold">
                    {animal.dailyRate > 0 ? `${animal.dailyRate.toLocaleString()} €` : "Auf Anfrage"}
                  </span>
                  {animal.dailyRate > 0 && <span className="text-text-muted text-sm"> / Tag</span>}
                </div>

                {animal.dailyRate > 0 && (
                  <Link
                    href={`/booking/checkout?type=animal&id=${animal.id}&title=${encodeURIComponent(animal.title)}&price=${animal.dailyRate}`}
                    className="block w-full py-3.5 bg-gold text-bg-primary font-semibold text-center rounded-xl hover:bg-gold-light transition-colors flex items-center justify-center gap-2 mb-3"
                  >
                    <Calendar size={16} /> Jetzt buchen
                  </Link>
                )}

                {animal.ownerId ? (
                  <InquiryForm
                    listingId={animal.id}
                    listingTitle={animal.title}
                    listingType="animal"
                    ownerId={animal.ownerId}
                    ownerName={animal.ownerName}
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

              {/* Vendor */}
              <div className="p-5 rounded-xl border border-border bg-bg-secondary">
                <h3 className="font-semibold text-text-primary mb-3 text-sm">Anbieter</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center font-bold text-gold">
                    {animal.ownerName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{animal.ownerName}</p>
                    <p className="text-xs text-text-muted">Tierhalter / Trainer</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-10 pt-8 border-t border-border mb-12">
          <ReviewsSection
            targetId={animal.id}
            targetType="animal"
            targetName={animal.title}
          />
        </div>

        {/* Related */}
        <div className="pt-8 border-t border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold text-text-primary">Weitere Film-Tiere</h2>
            <Link href="/tiere" className="text-sm text-gold hover:text-gold-light flex items-center gap-1">
              Alle anzeigen <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
