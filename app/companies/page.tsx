import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import CompaniesContent from "./CompaniesContent";
import ImageStrip from "@/components/ImageStrip";
import CategoryHero from "@/components/CategoryHero";

export const metadata: Metadata = {
  title: "Firmenverzeichnis — Verleiher, Studios & Agenturen",
  description: "Alle Dienstleister der Filmbranche: Lichtverleih, Kameraverleih, Tonstudios, Postproduktion, Casting-Agenturen, VFX-Studios und mehr im DACH-Raum.",
  keywords: ["Filmdienstleister", "Kameraverleih Deutschland", "Lichtverleih München", "Tonstudio mieten", "Postproduktion Firma", "Casting Agentur Deutschland"],
  openGraph: {
    title: "Firmenverzeichnis — Dienstleister für Film & Medien",
    description: "Verleiher, Studios, Agenturen — alle Filmdienstleister auf einen Blick.",
  },
};

export const revalidate = 60;

export default async function CompaniesPage() {
  const { data } = await supabaseAdmin
    .from("companies")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  const logoImages = (data ?? [])
    .filter((c: { logo_url: string | null }) => c.logo_url?.includes("supabase.co/storage"))
    .map((c: { slug: string; name: string; logo_url: string }) => ({ src: c.logo_url, alt: c.name, href: `/companies/${c.slug}` }))
    .sort((a, b) => a.alt.localeCompare(b.alt));

  return (
    <>
      <div className="pt-16">
        <CategoryHero
          badge="Firmen & Dienstleister"
          title="Studios, Verleiher"
          titleHighlight="& Agenturen"
          description="Kameraverleih, Tonstudios, Postproduktion, Casting-Agenturen — alle Filmdienstleister im DACH-Raum."
          image="https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=1600&q=90"
          imagePosition="center 30%"
          overlay="left"
          height="sm"
          cta={{ label: "Firma eintragen", href: "/inserat" }}
        />
      </div>
      {logoImages.length >= 1 && (
        <div className="relative">
          <ImageStrip images={logoImages} aspectRatio="wide" height={100} speed="slow" />
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none" />
        </div>
      )}
      <CompaniesContent initialCompanies={data ?? []} />
    </>
  );
}
