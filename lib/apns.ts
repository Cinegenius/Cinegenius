import { createPrivateKey, sign, type KeyObject } from "node:crypto";

export type ApnsEnvironment = "sandbox" | "production";
export type ApnsConfiguration = { teamId: string; keyId: string; privateKey: string; bundleId: string; environment: ApnsEnvironment };
export type ApnsDelivery = { id: string; deviceToken: string; body: string; destination: "messages" | "notifications"; expiresAt: number };
export type ApnsRequest = { endpoint: string; headers: Record<string, string>; body: string };
export type ApnsResponse = { status: number; reason?: string; timestamp?: number; requestId?: string };
export type ApnsResult = { kind: "accepted" | "expired" | "configuration" | "rejected" } | { kind: "invalid-device"; invalidSince?: number } | { kind: "retry"; retryAfterMs: number };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** APNs token length can change. Bound input without assuming a fixed byte count. */
export const validApnsDeviceToken = (value: unknown): value is string => typeof value === "string"
  && value.length >= 2 && value.length <= 1024 && value.length % 2 === 0 && /^[a-f0-9]+$/i.test(value);

export function apnsResponseResult(response: ApnsResponse, requestId: string): ApnsResult {
  if (response.status === 200) return response.requestId === requestId ? { kind: "accepted" } : { kind: "retry", retryAfterMs: 60_000 };
  if (response.status === 410 || (response.status === 400 && ["BadDeviceToken", "DeviceTokenNotForTopic"].includes(response.reason ?? ""))) {
    return { kind: "invalid-device", ...(Number.isFinite(response.timestamp) && response.timestamp! > 0 ? { invalidSince: response.timestamp } : {}) };
  }
  if (response.status === 403 || (response.status === 400 && ["BadTopic", "MissingTopic", "TopicDisallowed"].includes(response.reason ?? ""))) return { kind: "configuration" };
  if (response.status === 429 || response.status >= 500) return { kind: "retry", retryAfterMs: 15 * 60_000 };
  if (response.status === 0) return { kind: "retry", retryAfterMs: 60_000 };
  return { kind: "rejected" };
}

/** Server protocol builder. Body is generic catalog copy, never message text or private links. */
export function createApnsRequestBuilder(configuration: ApnsConfiguration, now: () => number = Date.now) {
  if (!/^[A-Z0-9]{10}$/.test(configuration.teamId) || !/^[A-Z0-9]{10}$/.test(configuration.keyId)
      || !/^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)+$/.test(configuration.bundleId) || configuration.bundleId.length > 160
      || !["sandbox", "production"].includes(configuration.environment) || configuration.privateKey.length > 16_384) throw new Error("apns_configuration");
  let key: KeyObject;
  try {
    key = createPrivateKey(configuration.privateKey);
    if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") throw new Error();
  } catch { throw new Error("apns_configuration"); }
  let token = "", issuedAt = 0;
  return (delivery: ApnsDelivery): ApnsRequest | null => {
    const time = now(), seconds = Math.floor(time / 1000);
    if (!Number.isFinite(time) || !uuid.test(delivery.id) || !validApnsDeviceToken(delivery.deviceToken)
        || !["messages", "notifications"].includes(delivery.destination) || typeof delivery.body !== "string"
        || !delivery.body.trim() || delivery.body.length > 512 || !Number.isFinite(delivery.expiresAt)) throw new Error("apns_invalid_delivery");
    if (delivery.expiresAt <= time) return null;
    if (delivery.expiresAt - time > 24 * 60 * 60_000) throw new Error("apns_invalid_delivery");
    if (!token || seconds - issuedAt >= 50 * 60 || seconds < issuedAt) {
      const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: configuration.keyId })).toString("base64url");
      const claims = Buffer.from(JSON.stringify({ iss: configuration.teamId, iat: seconds })).toString("base64url");
      const input = `${header}.${claims}`;
      token = `${input}.${sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
      issuedAt = seconds;
    }
    const body = JSON.stringify({ aps: { alert: { title: "CineGenius", body: delivery.body }, sound: "default" }, cg_destination: delivery.destination });
    if (Buffer.byteLength(body) > 4096) throw new Error("apns_invalid_delivery");
    return { endpoint: configuration.environment === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com",
      headers: { ":method": "POST", ":path": `/3/device/${delivery.deviceToken.toLowerCase()}`, authorization: `bearer ${token}`,
        "apns-topic": configuration.bundleId, "apns-push-type": "alert", "apns-priority": "10", "apns-id": delivery.id.toLowerCase(),
        "apns-collapse-id": `cg-${delivery.id.toLowerCase()}`, "apns-expiration": String(Math.floor(delivery.expiresAt / 1000)) }, body };
  };
}
