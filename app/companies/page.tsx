import type { Metadata } from "next";
import { db } from "@/lib/db";
import CompaniesContent from "./CompaniesContent";
import PageHeader from "@/components/PageHeader";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations("companies");
  const { data } = await db
    .from("companies")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(251,113,133,0.03) 0%, transparent 50%)" }}>
      <PageHeader
          badge={t("badge")}
          title={t("title")}
          titleHighlight={t("titleHighlight")}
          description={t("description")}
          accentRgb="251,113,133"
          ctaSecondary={{ label: t("allBrowse"), href: "/companies" }}
          cta={{ label: t("addCompany"), href: "/company-setup" }}
        />
      <CompaniesContent initialCompanies={data ?? []} />
    </div>
  );
}
