import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/sign-in", "/sign-up", "/impressum", "/datenschutz", "/agb"]
    .map(path => ({ url: `https://www.cinegenius.co${path}` }));
}
