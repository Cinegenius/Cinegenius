import { publicListingIds } from "@/lib/profile-privacy-server";
import { jobFacts, jobRecord, jobRateLabel } from "@/lib/job-metadata";
import { projectTypeLabel } from "@/lib/project-type-labels";
import { getTranslations as getPageTranslations } from "next-intl/server";
import JsonLd from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import JobDetail from "@/components/JobDetail";
import { auth } from "@clerk/nextjs/server";
import { getTranslations , getLocale } from "next-intl/server";


async function getJob(slug: string, previewOwnerId?: string) {
  const uiDataText = await getTranslations();
  const uiDataLocale = await getLocale();

  let query = db
    .from("listings")
    .select("id, user_id, type, title, city, price, description, created_at, published, category, job:metadata->job")
    .eq("id", slug)
    .eq("type", "job");
  query = previewOwnerId
    ? query.eq("user_id", previewOwnerId)
    : query.eq("published", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Job konnte nicht geladen werden: ${error.message}`);
  if (!data || (!previewOwnerId && !(await publicListingIds([data.id])).has(data.id))) return null;

  const record = jobRecord(data);
  const parsed = jobFacts(record);
  return { ...record, company: parsed.company, projectType: parsed.projectType,
    rate: jobRateLabel(record, uiDataText, uiDataLocale) };

}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}): Promise<Metadata> {
  const pageCopy = await getPageTranslations("PageCopy");
  const typeText = await getTranslations();
  if ((await searchParams).preview === "1") {
    return { robots: { index: false, follow: false } };
  }
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) return {};
  return {
    alternates: { canonical: `https://www.cinegenius.co/jobs/${encodeURIComponent(slug)}` },
    title: pageCopy("p_08d42bd8e216", { value0: String(job.title), value1: String(job.company) }),
    description: pageCopy("p_29fb1f1278c6", { value0: String(projectTypeLabel(job.projectType, typeText)), value1: String(job.location), value2: String(job.rate), value3: String(jobFacts(job).urgent ? pageCopy("p_802ec227650b") : "") }),
    openGraph: {
      title: `${job.title} | CineGenius Jobs`,
      description: pageCopy("p_84ba2ee0b343", { value0: String(job.company), value1: String(job.title), value2: String(projectTypeLabel(job.projectType, typeText)), value3: String(job.location) }),
    },
  };
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const pageCopy = await getPageTranslations("PageCopy");
  const typeText = await getTranslations();

  const { slug } = await params;
  const preview = (await searchParams).preview === "1";
  let previewOwnerId: string | undefined;
  if (preview) {
    const session = await auth();
    if (!session.userId) notFound();
    previewOwnerId = session.userId;
  }
  const job = await getJob(slug, previewOwnerId);
  if (!job) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": job.title,
    "description": jobFacts(job).description ? jobFacts(job).description : pageCopy("p_84ba2ee0b343", { value0: String(job.company), value1: String(job.title), value2: String(projectTypeLabel(job.projectType, typeText)), value3: String(job.location) }),
    ...(job.company ? { hiringOrganization: {
      "@type": "Organization",
      "name": job.company,
    } } : {}),
    ...(job.location ? { jobLocation: {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": job.location,
      },
    } } : {}),
    ...(job.schedule?.employmentType ? { employmentType: ({ freelance: "CONTRACTOR", festanstellung: "OTHER", praktikum: "INTERN" })[job.schedule.employmentType] } : {}),
    ...(job.createdAt ? { datePosted: job.createdAt } : {}),
    ...(job.price && (!jobFacts(job).payType || jobFacts(job).payType === "Paid" || jobFacts(job).payType === "Bezahlt") ? { baseSalary: { "@type": "MonetaryAmount", currency: "EUR", value: { "@type": "QuantitativeValue", value: job.price, unitText: "DAY" } } } : {}),
    "directApply": true,
  };

  return (
    <>
      {!preview && <JsonLd data={jsonLd} />}
      <JobDetail job={job} preview={preview} />
    </>
  );
}
