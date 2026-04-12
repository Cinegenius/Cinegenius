import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Metadata } from "next";
import JobDetail from "@/components/JobDetail";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

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

async function getJob(slug: string) {
  const { data } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("id", slug)
    .eq("type", "job")
    .single();

  if (!data) return null;

  const parsed = parseJobDescription(data.description ?? "");

  return {
    id: data.id,
    title: data.title,
    company: parsed.company ?? "Privatanbieter",
    projectType: parsed.projectType ?? "Film",
    location: data.city ?? "",
    rate: data.price > 0 ? `${data.price} €/Tag` : "Nach Vereinbarung",
    union: "Non-Union",
    shootDates: parsed.shootDates ?? "Auf Anfrage",
    urgent: parsed.urgent,
    payType: parsed.payType,
    contentWarnings: parsed.contentWarnings,
    tags: ["Neu"],
    posted: "Aktuell",
    description: parsed.description,
    ownerId: data.user_id ?? "",
    ownerName: parsed.company ?? "Anbieter",
    isReal: true,
  };
}

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getJob(slug);
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
    "validThrough": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    "directApply": true,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <JobDetail job={job} />
    </>
  );
}
