import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep groq-sdk (and other Node.js-only packages) out of the Edge bundle
  // so they don't crash the Clerk middleware running on the Edge runtime.
  serverExternalPackages: ["groq-sdk"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  // Provide build-time fallbacks so module-level Supabase clients don't throw
  // during static analysis. Real values come from environment variables at runtime.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiJ9.build.placeholder",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiJ9.build.placeholder",
  },
};

export default nextConfig;
