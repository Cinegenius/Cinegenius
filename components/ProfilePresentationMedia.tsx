"use client";

import { useTranslations } from "next-intl";
import type { UserProfile } from "@/lib/profile-types";
import { presentationPortrait, type ProfilePresentation } from "@/lib/profile-presentation";
import { profileCoverStyle } from "@/lib/profile-cover";
import ProfileCardPhoto from "@/components/ProfileCardPhoto";
import ResilientPublicImage from "@/components/ResilientPublicImage";

export function PresentationCover({ profile }: { profile: UserProfile }) {
  if (!profile.cover_image_url) return null;
  return <div data-presentation-cover className="relative mb-5 h-32 overflow-hidden rounded-xl bg-bg-secondary sm:h-48">
    <ResilientPublicImage src={profile.cover_image_url} alt="" className="absolute inset-0" imageClassName="h-full w-full object-cover" imageStyle={profileCoverStyle(profile.focal_point)} loading="eager" />
  </div>;
}


export function PresentationPhoto({ profile, mode, onOpen }: {
  profile: UserProfile; mode: ProfilePresentation; onOpen: (src: string) => void;
}) {
  const t = useTranslations("profileHeader");
  const src = presentationPortrait(profile);
  const large = mode === "portrait" && !!src;
  return <button type="button" onClick={() => src && onOpen(src)} disabled={!src} aria-label={t("openPhoto")}
    data-presentation-photo={large ? "portrait" : "compact"}
    className={`relative block shrink-0 overflow-hidden rounded-xl bg-bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold disabled:cursor-default ${large ? "aspect-[3/4] w-full max-w-[420px]" : "h-20 w-20 sm:h-24 sm:w-24"}`}>
    {large ? <ResilientPublicImage src={src} alt={profile.display_name ?? ""} className="absolute inset-0" imageClassName="h-full w-full object-contain" loading="eager" />
      : <ProfileCardPhoto src={src ?? ""} name={profile.display_name ?? ""} focalPoint={profile.focal_point} className="h-full w-full" sizes="(max-width: 640px) 80px, 96px" />}
  </button>;
}
