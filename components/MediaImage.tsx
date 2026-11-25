import Image, { type ImageProps } from "next/image";
import { protectedMediaKey, isProtectedMediaOptimizerSource } from "@/lib/protected-media";

/** Auth-dependent media uses the checked endpoint, never the shared Next cache. */
export default function MediaImage({ mediaSize, ...props }: ImageProps & { mediaSize?: "thumbnail" | "detail" }) {
  const protectedSource = typeof props.src === "string" && protectedMediaKey(props.src);
  const guardedSource = typeof props.src === "string" && isProtectedMediaOptimizerSource(props.src, "https://www.cinegenius.co");
  const size = mediaSize ?? (typeof props.width === "number" && props.width <= 640 ? "thumbnail" : "detail");
  const reviewSource = typeof props.src === "string" && props.src.startsWith("/api/admin/reviews/");
  const src = protectedSource ? `${(props.src as string).split("?")[0]}?size=${size}`
    : reviewSource ? `${props.src}${(props.src as string).includes("?") ? "&" : "?"}size=${size}` : props.src;
  return <Image {...props} alt={props.alt} src={src} unoptimized={Boolean(guardedSource) || props.unoptimized} />;
}
