export type AvatarAssociationOutcome =
  | { status: "saved" }
  | { status: "conflict" }
  | { status: "failed" };

/** Confirms a specific upload when the HTTP response was lost after persistence. */
export function isAvatarUploadAssociated(url: unknown, uploadId: string): url is string {
  if (typeof url !== "string" || !/^[a-f0-9]{32}$/i.test(uploadId)) return false;
  try {
    const path = new URL(url).pathname;
    return path.split("/").some((segment) => new RegExp(`^${uploadId}\\.(?:jpg|png|webp)$`, "i").test(segment));
  } catch {
    return false;
  }
}

/**
 * Confirms the database association before reporting upload success. If the
 * write response is ambiguous, read the row before deciding whether the new
 * object is unused; never delete an object the profile may already reference.
 */
export async function persistAvatarAssociation(options: {
  url: string;
  path: string;
  update: () => Promise<{ updated: boolean; error: unknown | null }>;
  readCurrentUrl: () => Promise<{ ok: boolean; url: string | null }>;
  removeUnusedAsset: (path: string) => Promise<void>;
}): Promise<AvatarAssociationOutcome> {
  const result = await options.update();
  if (result.updated) return { status: "saved" };

  if (result.error) {
    const confirmed = await options.readCurrentUrl().catch(() => ({ ok: false, url: null }));
    if (confirmed.ok && confirmed.url === options.url) return { status: "saved" };
    if (confirmed.ok) await options.removeUnusedAsset(options.path).catch(() => {});
    return { status: "failed" };
  }

  await options.removeUnusedAsset(options.path).catch(() => {});
  return { status: "conflict" };
}
