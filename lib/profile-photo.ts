export type ProfilePhotoCrop = { x: number; y: number; zoom: number };

function bounded(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Existing portrait focus remains the fallback; card cropping never moves the cover. */
export function profilePhotoCrop(value: unknown): ProfilePhotoCrop {
  const focal = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const crop = focal.card && typeof focal.card === "object" ? focal.card as Record<string, unknown> : {};
  return {
    x: bounded(crop.x, bounded(focal.x, 50, 0, 100), 0, 100),
    y: bounded(crop.y, bounded(focal.y, 33, 0, 100), 0, 100),
    zoom: bounded(crop.zoom, 1, 1, 3),
  };
}

export function profilePhotoStyle(value: unknown) {
  const { x, y, zoom } = profilePhotoCrop(value);
  return { objectPosition: `${x}% ${y}%`, transformOrigin: `${x}% ${y}%`, transform: `scale(${zoom})` };
}

export function dragProfilePhoto(start: ProfilePhotoCrop, delta: { x: number; y: number }, frame: { width: number; height: number }, image: { width: number; height: number }): ProfilePhotoCrop {
  if (Math.min(frame.width, frame.height, image.width, image.height) <= 0) return start;
  const scale = Math.max(frame.width / image.width, frame.height / image.height) * start.zoom;
  const overflowX = image.width * scale - frame.width;
  const overflowY = image.height * scale - frame.height;
  return {
    ...start,
    x: overflowX > 0.5 ? bounded(start.x - delta.x / overflowX * 100, start.x, 0, 100) : start.x,
    y: overflowY > 0.5 ? bounded(start.y - delta.y / overflowY * 100, start.y, 0, 100) : start.y,
  };
}

/** A portfolio fallback has a different subject, so never apply the portrait's crop to it. */
export function crewPhotoInput(creator: { avatar?: string; image?: string; focal_point?: unknown }) {
  const avatar = creator.avatar?.trim();
  return { src: avatar || creator.image?.trim() || "", focalPoint: avatar ? creator.focal_point : undefined };
}
