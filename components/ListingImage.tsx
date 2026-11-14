"use client";

import { useState, type ComponentProps } from "react";
import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import MediaImage from "@/components/MediaImage";

type Props = Omit<ComponentProps<typeof MediaImage>, "onError">;

function RecoveringImage(props: Props) {
  const t = useTranslations();
  const [failures, setFailures] = useState(0);

  if (failures >= 2) {
    return <span role="img"
      aria-label={props.alt ? t("Ui.text_7d605ca2709052", { value1: props.alt }) : t("MediaGallery.unavailable")}
      className={`${props.fill ? "absolute inset-0" : ""} inline-flex items-center justify-center overflow-hidden bg-bg-elevated text-text-muted ${props.className ?? ""}`}
      style={{ ...props.style, ...(!props.fill ? { width: props.width, height: props.height } : {}) }}>
      <ImageOff size={20} aria-hidden="true" />
    </span>;
  }

  // A fresh image element retries a transient failure once. Protected endpoints
  // remain permission-checked and no-store; no alternate public URL is used.
  return <MediaImage {...props} key={failures} onError={() => setFailures(count => Math.min(count + 1, 2))} />;
}

/** Offer images share bounded recovery; a new source starts a fresh load. */
export default function ListingImage(props: Props) {
  const source = typeof props.src === "string" ? props.src : "default" in props.src ? props.src.default.src : props.src.src;
  return <RecoveringImage {...props} key={source} />;
}
