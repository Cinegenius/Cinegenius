/** Platform optimizers validate these patterns before their shared cache.
 * Only repository-owned static assets are eligible as local sources: never a
 * permission-aware API, even while its underlying picture is briefly public.
 */
export function staticImagePatterns(publicFiles: string[]) {
  const assets = publicFiles.filter(file => /\.(avif|webp|png|jpe?g|gif|svg|ico)$/i.test(file)
    && !file.startsWith("api/") && !file.startsWith("profile-art/v2/") && !file.split("/").includes(".."));
  // Next accepts at most 25 local patterns. Group each repository-owned art
  // collection; never broaden the allowlist to API routes or private uploads.
  const artDirectories = new Set(assets.filter(file => /^profile-art\/v\d+\/[a-z0-9-]+\.webp$/.test(file)).map(file => file.slice(0, file.lastIndexOf("/"))));
  return [
    { pathname: "/_next/static/media/**", search: "" },
    ...assets.filter(file => !file.endsWith(".webp") || !artDirectories.has(file.slice(0, file.lastIndexOf("/"))))
      .map(file => ({ pathname: "/" + file, search: "" })),
    ...[...artDirectories].map(directory => ({ pathname: `/${directory}/*.webp`, search: "" })),
  ];
}

export const PUBLIC_SUPABASE_IMAGE_PATTERNS = [
  { protocol: "https" as const, hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
  { protocol: "https" as const, hostname: "*.supabase.co", pathname: "/storage/v1/render/image/public/**" },
];
