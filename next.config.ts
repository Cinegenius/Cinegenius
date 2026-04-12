import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry Organisation + Projekt (aus sentry.io Dashboard)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source Maps hochladen für bessere Fehlermeldungen (nur in CI/CD)
  silent: true,
  widenClientFileUpload: true,
});
