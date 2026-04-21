import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  // Build-time fallbacks for the two public vars so static analysis doesn't fail
  // when env vars are not available (e.g. CI without secrets).
  // SUPABASE_SERVICE_ROLE_KEY is intentionally NOT listed here — the `env` block
  // inlines values into the client-side bundle. The service role key must never
  // reach the browser. The admin client is lazy so it never reads the key at
  // build time anyway.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiJ9.build.placeholder",
  },
};

export default nextConfig;
