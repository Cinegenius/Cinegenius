import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BASE = "https://www.cinegenius.co";

const typeToPath: Record<string, string> = {
  location: "locations",
  creator: "creators",
  job: "jobs",
  prop: "props",
  vehicle: "vehicles",
  animal: "tiere",
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                                  lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/locations`,                   lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/creators`,                    lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/jobs`,                        lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/props`,                       lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/vehicles`,                    lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/tiere`,                       lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/companies`,                   lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/projects`,                    lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE}/projects/film`,               lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/projects/foto`,               lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/projects/musikvideo`,         lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/projects/dokumentation`,      lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/projects/social-media`,       lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/projects/event`,              lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/projects/corporate`,          lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/projects/werbung`,            lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/bts`,                         lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/photo`,                       lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/social-media`,                lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/pricing`,                     lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/about`,                       lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/trust`,                       lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/help`,                        lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/agb`,                         lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/datenschutz`,                 lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/impressum`,                   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/ki-transparenz`,              lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/bildrechte`,                  lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  let dynamicListings: MetadataRoute.Sitemap = [];

  try {
    const [
      { data: listings },
      { data: companies },
      { data: projects },
    ] = await Promise.all([
      db.from("privacy_visible_listings")
        .select("id, type, created_at")
        .eq("published", true),

      db.from("companies")
        .select("slug, updated_at")
        .eq("published", true),

      db.from("projects")
        // `projects` contains public records only. Private working copies live
        // in `project_drafts` and are never included in the sitemap.
        .select("id, updated_at"),
    ]);

    dynamicListings = (listings ?? [])
      .filter((l: { id: string; type: string; created_at: string }) => typeToPath[l.type])
      .map((l: { id: string; type: string; created_at: string }) => ({
        url: `${BASE}/${typeToPath[l.type]}/${l.id}`,
        lastModified: l.created_at ?? now,
        changeFrequency: (l.type === "job" ? "daily" : "weekly") as "daily" | "weekly",
        priority: l.type === "job" ? 0.7 : 0.8,
      }));

    // Profile pages inherit noindex; unclaimed person pages require sign-in.
    // Neither belongs in the public search sitemap.
    const companyPages: MetadataRoute.Sitemap = (companies ?? []).map(
      (c: { slug: string; updated_at: string }) => ({
        url: `${BASE}/companies/${c.slug}`,
        lastModified: c.updated_at ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })
    );

    const projectPages: MetadataRoute.Sitemap = (projects ?? []).map(
      (p: { id: string; updated_at: string }) => ({
        url: `${BASE}/projects/${p.id}`,
        lastModified: p.updated_at ?? now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })
    );

    return [
      ...staticPages,
      ...dynamicListings,
      ...companyPages,
      ...projectPages,
    ];
  } catch {
    // DB not available at build time — return static pages only
  }

  return [...staticPages, ...dynamicListings];
}
