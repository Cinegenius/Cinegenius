import type { ComponentProps } from "react";

/**
 * Use for user-provided, external, or temporary blob URLs whose hosts are not
 * fixed at build time. These sources must be rendered directly instead of
 * routed through Next's image optimizer.
 */
export default function UnoptimizedImage({ alt = "", ...props }: ComponentProps<"img">) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Dynamic user uploads and blob previews cannot use a fixed Next image host allowlist.
    <img {...props} alt={alt} />
  );
}
