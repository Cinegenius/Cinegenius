"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import MediaImage from "@/components/MediaImage";
import ProfileCardPhoto from "@/components/ProfileCardPhoto";
import { profileCoverStyle } from "@/lib/profile-cover";
import type { UserProfile } from "@/lib/profile-types";
import type { ProfileLayout } from "@/lib/profile-layout";

/** A presentation choice only. The profession-specific body stays mounted below. */
export default function ProfileLayoutHeader({ profile, layout, children, onOpenPhoto }: {
  profile: UserProfile; layout: ProfileLayout; children: ReactNode; onOpenPhoto: (src: string) => void;
}) {
  const t = useTranslations("profileHeader");
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = profile.cover_image_url || profile.avatar_url || null;
  const large = layout === "large-photo" && !!image && failedImage !== image;
  return <section data-profile-layout={layout} data-profile-presentation={large ? "large-photo" : "compact"}
    className="mx-auto w-full min-w-0 max-w-5xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
    {large && <button type="button" aria-label={t("openPhoto")} onClick={() => onOpenPhoto(image)}
      className="relative block h-[360px] w-full overflow-hidden rounded-3xl bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold sm:h-[440px] lg:h-[520px]">
      <MediaImage src={image} alt={profile.display_name ?? ""} fill sizes="(max-width: 1024px) 100vw, 960px" unoptimized
        className="object-cover" style={profile.cover_image_url ? profileCoverStyle(profile.focal_point) : { objectPosition: `${profile.focal_point?.x ?? 50}% ${profile.focal_point?.y ?? 33}%` }}
        onError={() => setFailedImage(image)} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-primary/30" />
    </button>}
    <div className={`relative z-10 min-w-0 rounded-2xl border border-border bg-bg-secondary p-4 sm:p-6 ${large ? "mx-3 -mt-12 shadow-lg sm:mx-6 sm:-mt-16" : ""}`}>
      <div className="flex min-w-0 items-start gap-3 sm:gap-5">
        {profile.avatar_url && <button type="button" onClick={() => onOpenPhoto(profile.avatar_url!)} aria-label={t("openPhoto")}
          className="w-fit shrink-0 self-start rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
          <ProfileCardPhoto src={profile.avatar_url} name={profile.display_name ?? ""} focalPoint={profile.focal_point} className="h-16 w-16 rounded-xl sm:h-24 sm:w-24" sizes="(max-width: 640px) 64px, 96px" />
        </button>}
        <div className="min-w-0 flex-1 space-y-3 [overflow-wrap:anywhere]">{children}</div>
      </div>
    </div>
  </section>;
}
