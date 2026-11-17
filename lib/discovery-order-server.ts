import "server-only";
import { createHash, randomUUID } from "node:crypto";

/** Public pagination state, never an account identity or an authorization token. */
export function validDiscoverySeed(value: unknown): string | null {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value) ? value : null;
}

export function discoverySeed(value?: unknown): string {
  return validDiscoverySeed(value) ?? randomUUID().replaceAll("-", "");
}

/** Matches the database order, including when a legacy listing becomes a profile. */
export function discoveryOrder(seed: string, owner: string): string {
  return createHash("md5").update(`${seed}:${owner}`).digest("hex");
}
