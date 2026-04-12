import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/booking/checkout", "/booking/confirmation", "/profile", "/auth"],
      },
    ],
    sitemap: "https://cinegenius.com/sitemap.xml",
  };
}
