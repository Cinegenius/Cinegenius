"use client";

import Image from "@/components/MediaImage";
import { useState } from "react";
import { Building2 } from "lucide-react";

/** Full logo canvas: preserve wordmarks and portrait logos without cropping. */
export default function CompanyLogo({ src, name, className = "" }: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <div className={`flex min-w-0 max-w-full items-center justify-center ${className}`}>
      {src && src !== failedSrc ? (
        <Image src={src} alt={name} width={640} height={320}
          sizes="(max-width: 640px) 90vw, 384px"
          className="h-full w-full min-w-0 object-contain p-0.5"
          onError={() => setFailedSrc(src)} />
      ) : (
        <span role="img" aria-label={`${name} – kein Logo`} className="flex h-full w-full items-center justify-center text-text-muted">
          <Building2 size={36} strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}
