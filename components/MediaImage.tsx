import Image, { type ImageProps } from "next/image";
import { protectedMediaKey } from "@/lib/protected-media";

/** Auth-dependent media uses the checked endpoint, never the shared Next cache. */
export default function MediaImage(props: ImageProps) {
  const protectedSource = typeof props.src === "string" && protectedMediaKey(props.src);
  const src = protectedSource ? `${(props.src as string).split("?")[0]}?size=${typeof props.width === "number" && props.width <= 640 ? "thumbnail" : "detail"}` : props.src;
  return <Image {...props} alt={props.alt} src={src} unoptimized={Boolean(protectedSource) || props.unoptimized} />;
}
