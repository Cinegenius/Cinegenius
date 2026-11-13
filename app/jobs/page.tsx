import { jobRecord } from "@/lib/job-metadata";
import { placeReadFields } from "@/lib/places/catalog";
import { db } from "@/lib/db";
import JobsContent from "./JobsContent";
import DirectoryPage from "@/components/DirectoryPage";
import { getLocale } from "next-intl/server";
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
  const serverJobs = [];
  // Read complete bounded pages before applying client filters or geographic ordering.
  for (let offset = 0; ; offset += 250) {
    const { data, error } = await db.from("listings")
      .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id,title,category,city,price,description,created_at,job:metadata->job")
      .eq("published", true).eq("type", "job").order("created_at", { ascending: false }).order("id")
      .range(offset, offset + 249);
    if (error) throw new Error("jobs_read_failed");
    serverJobs.push(...(data ?? []).map(row => ({ ...jobRecord(row), ...placeReadFields(row.city ?? "", row, locale) })));
    if (!data || data.length < 250) break;
  }

  return <DirectoryPage area="jobs"><JobsContent serverJobs={serverJobs} /></DirectoryPage>;
}
