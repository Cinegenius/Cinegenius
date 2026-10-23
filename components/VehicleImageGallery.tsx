"use client";

import ListingPhotoGallery from "@/components/ListingPhotoGallery";

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
  return (
    <ListingPhotoGallery
      title={title}
      label="Fahrzeuggalerie"
      images={[image, ...extraImages]}
      focalPoint={focalPoint}
      fallback={<span aria-hidden="true" className="text-4xl">🚗</span>}
    />
  );
}
