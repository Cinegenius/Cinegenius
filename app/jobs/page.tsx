import { parseJobDescription } from "@/lib/job-metadata";
import { placeReadFields } from "@/lib/places/catalog";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import JobsContent from "./JobsContent";
import { getTranslations, getLocale } from "next-intl/server";
import { getTranslations as getMetadataTranslations } from "next-intl/server";

export const revalidate = 60;

export async function generateMetadata(): Promise<import("next").Metadata> {
  const tMetadata = await getMetadataTranslations("Metadata");
  return {
  alternates: { canonical: "https://www.cinegenius.co/jobs" },
  title: tMetadata('m_ee4fa112a614'),
  description: tMetadata('m_ac9c7a10f5b9'),
  keywords: [tMetadata('m_debd69fc6894'), tMetadata('m_db89b62c8660'), tMetadata('m_bd64ac3f5b34'), tMetadata('m_7b16cc55476e'), tMetadata('m_74ea5275bc3d'), tMetadata('m_c9940d827d94')],
  openGraph: {
    title: tMetadata('m_9139157fc1c9'),
    description: tMetadata('m_2f826b1246f3'),
  },
};
}

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
    projectType: parseJobDescription(l.description ?? "").projectType ?? "",
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
