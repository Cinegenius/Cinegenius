/** Platform optimizers validate these patterns before their shared cache.
 * Only repository-owned static assets are eligible as local sources: never a
 * permission-aware API, even while its underlying picture is briefly public.
 */
export function staticImagePatterns(publicFiles: string[]) {
  return [
    { pathname: "/_next/static/media/**", search: "" },
    ...publicFiles.filter(file => /\.(avif|webp|png|jpe?g|gif|svg|ico)$/i.test(file)
      && !file.startsWith("api/") && !file.split("/").includes(".."))
      .map(file => ({ pathname: "/" + file, search: "" })),
  ];
}

export const PUBLIC_SUPABASE_IMAGE_PATTERNS = [
  { protocol: "https" as const, hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
  { protocol: "https" as const, hostname: "*.supabase.co", pathname: "/storage/v1/render/image/public/**" },
];
