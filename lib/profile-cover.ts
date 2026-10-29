export type CoverPosition = { x: number; y: number };
export type ProfileFocalPoint = { x: number; y: number; opacity?: number; cover?: CoverPosition; card?: { x: number; y: number; zoom: number } };

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Legacy opacity is the persisted brightness setting; cover position is independent of the portrait. */
export function profileCoverSettings(value: unknown) {
  const focal = value && typeof value === "object" ? value as Partial<ProfileFocalPoint> : {};
  return {
    x: bounded(focal.cover?.x, 50, 0, 100),
    y: bounded(focal.cover?.y, 50, 0, 100),
    brightness: bounded(focal.opacity, 0.4, 0.1, 1),
  };
}

export function profileCoverStyle(value: unknown) {
  const { x, y, brightness } = profileCoverSettings(value);
  return { objectPosition: `${x}% ${y}%`, filter: `brightness(${brightness})` };
}

/** Drag the rendered image, accounting for the actual overflow produced by object-fit: cover. */
export function dragCoverPosition(start: CoverPosition, delta: CoverPosition, frame: { width: number; height: number }, image: { width: number; height: number }): CoverPosition {
  if (Math.min(frame.width, frame.height, image.width, image.height) <= 0) return start;
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const overflowX = image.width * scale - frame.width;
  const overflowY = image.height * scale - frame.height;
  return {
    x: overflowX > 0.5 ? bounded(start.x - delta.x / overflowX * 100, start.x, 0, 100) : start.x,
    y: overflowY > 0.5 ? bounded(start.y - delta.y / overflowY * 100, start.y, 0, 100) : start.y,
  };
}

export function validProfileFocalPoint(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const numberIn = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (["x", "y"].some(key => item[key] !== undefined && !numberIn(item[key], 0, 100))) return false;
  if (item.opacity !== undefined && !numberIn(item.opacity, 0.1, 1)) return false;
  if (item.cover !== undefined) {
    if (!item.cover || typeof item.cover !== "object" || Array.isArray(item.cover)) return false;
    const point = item.cover as Record<string, unknown>;
    if (!numberIn(point.x, 0, 100) || !numberIn(point.y, 0, 100)) return false;
  }
  if (item.card !== undefined) {
    if (!item.card || typeof item.card !== "object" || Array.isArray(item.card)) return false;
    const crop = item.card as Record<string, unknown>;
    if (!numberIn(crop.x, 0, 100) || !numberIn(crop.y, 0, 100) || !numberIn(crop.zoom, 1, 3)) return false;
  }
  return true;
}
