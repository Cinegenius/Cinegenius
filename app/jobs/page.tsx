import { placeReadFields } from "@/lib/places/catalog";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import JobsContent from "./JobsContent";
import { getTranslations, getLocale } from "next-intl/server";

export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "https://www.cinegenius.co/jobs" },
  title: "Film Jobs & Stellenanzeigen — Regie, Kamera, Produktion",
  description: "Aktuelle Jobs in der Filmbranche: Regie, Kamera, Licht, Ton, Produktion, Social Media, Fotografie. Für Freelancer und Festanstellungen im DACH-Raum.",
  keywords: ["Film Jobs Deutschland", "Filmjobs München", "Filmjobs Berlin", "Kameramann gesucht", "Regisseur Job", "Social Media Creator Job"],
  openGraph: {
    title: "Film Jobs & Stellenanzeigen — CineGenius",
    description: "Jobs in Film, Social Media und Fotografie — alle Gewerke, alle Städte.",
  },
};

export default async function JobsPage() {
  const locale = await getLocale();
  const tc = await getTranslations("common");

  const { data } = await db
    .from("listings")
    .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id, title, city, price, description, created_at")
    .eq("published", true)
    .eq("type", "job")
    .order("created_at", { ascending: false })
    .limit(200);

  const serverJobs = (data ?? []).map((l: {
    id: string; title: string; city: string;
    price: number; description: string; created_at: string;
    job_type?: string | null;
  }) => ({
    id: l.id,
    title: l.title,
    company: "",
    projectType: "Film",
    location: l.city ?? "",
    ...placeReadFields(l.city ?? "", l, locale),
    rate: l.price > 0 ? `${l.price} €${tc("perDay")}` : tc("onRequest"),
    union: "Non-Union",
    shootDates: tc("onRequest"),
    urgent: false,
    tags: [tc("newBadge")],
    posted: tc("today"),
    description: l.description ?? "",
    isReal: true,
    jobType: (l.job_type ?? "freelance") as "freelance" | "festanstellung" | "praktikum",
  }));

  return <JobsContent serverJobs={serverJobs} />;
}
