import { parseJobDescription } from "@/lib/job-metadata";
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
    .select("id, user_id, type, title, city, price, description, created_at, published")
    .eq("id", slug)
    .eq("type", "job");
  query = previewOwnerId
    ? query.eq("user_id", previewOwnerId)
    : query.eq("published", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Job konnte nicht geladen werden: ${error.message}`);
  if (!data) return null;

  const parsed = parseJobDescription(data.description ?? "");

  return {
      id: data.id,
      title: data.title ?? uiDataText("AdminAccounts.contentKinds.job"),
      company: parsed.company ?? uiDataText("props.vendorPrivate"),
      projectType: parsed.projectType ?? "Film",
      location: data.city ?? "",
      rate: (data.price ?? 0) > 0 ? uiDataText("Ui.text_8a272aeab9d3a5", { amount: Number(data.price).toLocaleString(uiDataLocale) }) : uiDataText("common.byArrangement"),
      union: uiDataText("Ui.text_35c3daa1b53c44"),
      shootDates: parsed.shootDates ?? uiDataText("common.onRequest"),
      urgent: parsed.urgent ?? false,
      payType: parsed.payType,
      contentWarnings: parsed.contentWarnings,
      tags: data.created_at && (Date.now() - new Date(data.created_at as string).getTime() < 3 * 24 * 60 * 60 * 1000) ? [uiDataText("common.newBadge")] : [],
      posted: uiDataText("Ui.text_f4d865ae1b7722"),
      description: parsed.description,
      ownerId: data.user_id ?? "",
      ownerName: parsed.company ?? uiDataText("profile.catAnbieterLabel"),
      isReal: true,
  };
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
    description: pageCopy("p_29fb1f1278c6", { value0: String(projectTypeLabel(job.projectType, typeText)), value1: String(job.location), value2: String(job.rate), value3: String(job.urgent ? pageCopy("p_802ec227650b") : "") }),
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
  const uiText = await getTranslations();

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
    "description": ("description" in job && job.description) ? String(job.description) : pageCopy("p_84ba2ee0b343", { value0: String(job.company), value1: String(job.title), value2: String(projectTypeLabel(job.projectType, typeText)), value3: String(job.location) }),
    "hiringOrganization": {
      "@type": "Organization",
      "name": job.company,
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": job.location,
      },
    },
    "employmentType": "CONTRACTOR",
    "baseSalary": {
      "@type": "MonetaryAmount",
      "currency": "EUR",
      "value": {
        "@type": "QuantitativeValue",
        "value": job.rate,
        "unitText": "DAY",
      },
    },
    "datePosted": new Date().toISOString().split("T")[0],
    "validThrough": new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    "directApply": true,
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <JobDetail job={job} preview={preview} />
    </>
  );
}
