import Image, { type ImageProps } from "next/image";
import { protectedMediaKey, isProtectedMediaOptimizerSource } from "@/lib/protected-media";

/** Auth-dependent media uses the checked endpoint, never the shared Next cache. */
export default function MediaImage(props: ImageProps) {
  const protectedSource = typeof props.src === "string" && protectedMediaKey(props.src);
  const guardedSource = typeof props.src === "string" && isProtectedMediaOptimizerSource(props.src, "https://www.cinegenius.co");
  const src = protectedSource ? `${(props.src as string).split("?")[0]}?size=${typeof props.width === "number" && props.width <= 640 ? "thumbnail" : "detail"}` : props.src;
  return <Image {...props} alt={props.alt} src={src} unoptimized={Boolean(guardedSource) || props.unoptimized} />;
}
