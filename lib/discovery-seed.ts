export type DiscoveryCursor = { key: string; id: string };

/** Presentation order only: a seed never changes visibility or grants access. */
export function isDiscoverySeed(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}

export function validDiscoveryCursor(value: unknown): value is DiscoveryCursor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).length === 2 && typeof row.key === "string" && /^[a-f0-9]{64}$/.test(row.key)
    && typeof row.id === "string" && row.id.length > 0 && row.id.length <= 200;
}
