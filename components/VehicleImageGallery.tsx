"use client";

import ListingPhotoGallery from "@/components/ListingPhotoGallery";
import { useTranslations } from "next-intl";


export default function VehicleImageGallery({
  title,
  image,
  extraImages = [],
  focalPoint,
}: {
  title: string;
  image: string;
  extraImages?: string[];
  focalPoint?: { x: number; y: number } | null;
}) {
  const uiText = useTranslations();

  return (
    <ListingPhotoGallery
      title={title}
      label={uiText("Ui.text_53b55c6132b618")}
      images={[image, ...extraImages]}
      focalPoint={focalPoint}
      fallback={<span aria-hidden="true" className="text-4xl">🚗</span>}
    />
  );
}
