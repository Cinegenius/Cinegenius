"use client";

import Image from "next/image";
import { useState } from "react";
import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { companyLogoSurface } from "@/lib/company-logo";

/** Full logo canvas: preserve wordmarks and portrait logos without cropping. */
export default function CompanyLogo({ src, name, background, className = "" }: {
  src?: string | null;
  name: string;
  background?: string | null;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const t = useTranslations("companyLogo");
  return (
    <span data-company-logo data-logo-background={background ?? "auto"}
      style={{ backgroundColor: src && src !== failedSrc ? companyLogoSurface(background) : undefined }}
      className={`flex min-w-0 max-w-full items-center justify-center overflow-hidden rounded-lg ${className}`}>
      {src && src !== failedSrc ? (
        <Image src={src} alt={name} width={640} height={320}
          sizes="(max-width: 640px) 360px, 384px"
          className="h-full w-full min-w-0 object-contain p-2"
          onError={() => setFailedSrc(src)} />
      ) : (
        <span role="img" aria-label={t("missing", { name })} className="flex h-full w-full items-center justify-center text-text-muted">
          <Building2 size={36} strokeWidth={1.5} />
        </span>
      )}
    </span>
  );
}
