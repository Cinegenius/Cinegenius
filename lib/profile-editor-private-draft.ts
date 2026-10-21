import { gunzipSync, gzipSync } from "node:zlib";

export function compressProfileEditorDraft(draft: Record<string, unknown>) {
  return gzipSync(Buffer.from(JSON.stringify(draft), "utf8")).toString("base64");
}

export function expandProfileEditorDraft(encoded: string): Record<string, unknown> {
  const value: unknown = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid profile editor draft");
  return value as Record<string, unknown>;
}

