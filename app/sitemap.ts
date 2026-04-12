import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://cinegenius.com";

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

  // Real DB listings
  let dynamicListings: MetadataRoute.Sitemap = [];
  let profilePages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: listings } = await supabase
      .from("listings")
      .select("id, type, updated_at")
      .eq("published", true);

    dynamicListings = (listings ?? [])
      .filter((l: { id: string; type: string; updated_at: string }) => typeToPath[l.type])
      .map((l: { id: string; type: string; updated_at: string }) => ({
        url: `${BASE}/${typeToPath[l.type]}/${l.id}`,
        lastModified: l.updated_at ?? now,
        changeFrequency: (l.type === "job" ? "daily" : "weekly") as "daily" | "weekly",
        priority: l.type === "job" ? 0.7 : 0.8,
      }));

    // Creator profiles (users who have set positions)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, updated_at")
      .not("positions", "is", null)
      .neq("positions", "{}");

    profilePages = (profiles ?? []).map((p: { user_id: string; updated_at: string }) => ({
      url: `${BASE}/creators/${p.user_id}`,
      lastModified: p.updated_at ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    // Company profiles
    const { data: companies } = await supabase
      .from("companies")
      .select("slug, updated_at")
      .eq("published", true);

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
    // Supabase not available at build time — skip dynamic entries
  }

  return [...staticPages, ...dynamicListings, ...profilePages];
}
