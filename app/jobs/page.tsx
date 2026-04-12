import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import JobsContent from "./JobsContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Film Jobs & Stellenanzeigen — Regie, Kamera, Produktion",
  description: "Aktuelle Jobs in der Filmbranche: Regie, Kamera, Licht, Ton, Produktion, Social Media, Fotografie. Für Freelancer und Festanstellungen im DACH-Raum.",
  keywords: ["Film Jobs Deutschland", "Filmjobs München", "Filmjobs Berlin", "Kameramann gesucht", "Regisseur Job", "Social Media Creator Job"],
  openGraph: {
    title: "Film Jobs & Stellenanzeigen — CineGenius",
    description: "Jobs in Film, Social Media und Fotografie — alle Gewerke, alle Städte.",
  },
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function JobsPage() {
  const { data } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("published", true)
    .eq("type", "job")
    .order("created_at", { ascending: false });

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
    rate: l.price > 0 ? `${l.price} €/Tag` : "Nach Vereinbarung",
    union: "Non-Union",
    shootDates: "Auf Anfrage",
    urgent: false,
    tags: ["Neu"],
    posted: "Aktuell",
    description: l.description ?? "",
    isReal: true,
    jobType: (l.job_type ?? "freelance") as "freelance" | "festanstellung" | "praktikum",
  }));

  return <JobsContent serverJobs={serverJobs} />;
}
