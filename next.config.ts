import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { readdirSync } from "node:fs";
import { getPublicIconRedirects } from "./lib/public-icon-redirects";
import { staticImagePatterns, PUBLIC_SUPABASE_IMAGE_PATTERNS } from "./lib/image-optimization-policy";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const nextConfig: NextConfig = {
  redirects: getPublicIconRedirects,
  images: {
    localPatterns: staticImagePatterns(readdirSync("public", { recursive: true, encoding: "utf8" })),
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      ...PUBLIC_SUPABASE_IMAGE_PATTERNS,
    ],
    formats: ["image/avif", "image/webp"],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiJ9.build.placeholder",
  },
};

export default withNextIntl(nextConfig);
