import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const BASE = "https://cinegenius.co";

const typeToPath: Record<string, string> = {
  location: "locations",
  creator: "creators",
  job: "jobs",
  prop: "props",
  vehicle: "vehicles",
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                        lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/locations`,         lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/creators`,          lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/jobs`,              lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/props`,             lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/vehicles`,          lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/marketplace`,       lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/companies`,         lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/pricing`,           lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/about`,             lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/trust`,             lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/help`,              lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/agb`,               lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/datenschutz`,       lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/impressum`,         lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];

  let dynamicListings: MetadataRoute.Sitemap = [];
  let profilePages: MetadataRoute.Sitemap = [];

  try {
    const [{ data: listings }, { data: profiles }, { data: companies }] = await Promise.all([
      db.from("listings")
        .select("id, type, created_at")
        .eq("published", true),

      db.from("profiles")
        .select("user_id, updated_at")
        .not("positions", "is", null)
        .neq("positions", "{}"),

      db.from("companies")
        .select("slug, updated_at")
        .eq("published", true),
    ]);

    dynamicListings = (listings ?? [])
      .filter((l: { id: string; type: string; created_at: string }) => typeToPath[l.type])
      .map((l: { id: string; type: string; created_at: string }) => ({
        url: `${BASE}/${typeToPath[l.type]}/${l.id}`,
        lastModified: l.created_at ?? now,
        changeFrequency: (l.type === "job" ? "daily" : "weekly") as "daily" | "weekly",
        priority: l.type === "job" ? 0.7 : 0.8,
      }));

    profilePages = (profiles ?? []).map((p: { user_id: string; updated_at: string }) => ({
      url: `${BASE}/creators/${p.user_id}`,
      lastModified: p.updated_at ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const companyPages: MetadataRoute.Sitemap = (companies ?? []).map(
      (c: { slug: string; updated_at: string }) => ({
        url: `${BASE}/companies/${c.slug}`,
        lastModified: c.updated_at ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })
    );

    return [...staticPages, ...dynamicListings, ...profilePages, ...companyPages];
  } catch {
    // DB not available at build time — return static pages only
  }

  return [...staticPages, ...dynamicListings, ...profilePages];
}
