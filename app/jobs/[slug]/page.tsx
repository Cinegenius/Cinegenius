import JsonLd from "@/components/JsonLd";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import JobDetail from "@/components/JobDetail";
import { auth } from "@clerk/nextjs/server";

function parseJobDescription(raw: string) {
  const lines = raw.split("\n\n");
  if (lines.length < 2) return { company: undefined, projectType: undefined, shootDates: undefined, urgent: false, payType: undefined, contentWarnings: [] as string[], description: raw };
  const metaLine = lines[0];
  const description = lines.slice(1).join("\n\n");
  const inhalt = metaLine.match(/Inhalt: ([^·\n]+)/)?.[1]?.trim();
  return {
    company: metaLine.match(/Produktion: ([^·\n]+)/)?.[1]?.trim(),
    projectType: metaLine.match(/Typ: ([^·\n]+)/)?.[1]?.trim() ?? metaLine.match(/Projekttyp: ([^·\n]+)/)?.[1]?.trim(),
    shootDates: metaLine.match(/Drehtage: ([^·\n]+)/)?.[1]?.trim(),
    urgent: metaLine.includes("⚡ Dringend"),
    payType: metaLine.match(/Vergütung: ([^·\n]+)/)?.[1]?.trim(),
    contentWarnings: inhalt ? inhalt.split(",").map((s) => s.trim()).filter(Boolean) : [] as string[],
    description,
  };
}

async function getJob(slug: string, previewOwnerId?: string) {
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
      title: data.title ?? "Job",
      company: parsed.company ?? "Privatanbieter",
      projectType: parsed.projectType ?? "Film",
      location: data.city ?? "",
      rate: (data.price ?? 0) > 0 ? `${data.price} €/Tag` : "Nach Vereinbarung",
      union: "Non-Union",
      shootDates: parsed.shootDates ?? "Auf Anfrage",
      urgent: parsed.urgent,
      payType: parsed.payType,
      contentWarnings: parsed.contentWarnings,
      tags: data.created_at && (Date.now() - new Date(data.created_at as string).getTime() < 3 * 24 * 60 * 60 * 1000) ? ["Neu"] : [],
      posted: "Aktuell",
      description: parsed.description,
      ownerId: data.user_id ?? "",
      ownerName: parsed.company ?? "Anbieter",
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
  if ((await searchParams).preview === "1") {
    return { robots: { index: false, follow: false } };
  }
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) return {};
  return {
    title: `${job.title} bei ${job.company}`,
    description: `${job.projectType} · ${job.location} · ${job.rate}. ${job.urgent ? "Dringend gesucht — " : ""}Jetzt auf CineGenius bewerben.`,
    openGraph: {
      title: `${job.title} | CineGenius Jobs`,
      description: `${job.company} sucht ${job.title} für ${job.projectType} in ${job.location}.`,
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
    "description": ("description" in job && job.description)
      ? String(job.description)
      : `${job.company} sucht ${job.title} für ${job.projectType} in ${job.location}.`,
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
