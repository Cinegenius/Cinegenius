import { isAppLocale, type AppLocale } from "./i18n/locales";

export const NATIVE_PUSH_CONTRACT = "cinegenius.push.v1" as const;
export type PushEnvironment = "sandbox" | "production";
export type PushPreferences = { messages: boolean; notices: boolean };
export type PushBinding = "own" | "different-account" | "absent";
export type PushCapabilities = { register: boolean; dispatch: boolean };
export type PushRegistration = { expectedRevision: string | null; deviceToken: string; authorization: "authorized"; environment: PushEnvironment; locale: AppLocale; preferences: PushPreferences };
export type PushRegistrationView = { installationId: string; revision: string | null; binding: PushBinding; preferences?: PushPreferences; locale?: AppLocale };
export type PushEnvelope = { contract: typeof NATIVE_PUSH_CONTRACT; accountId: string | null; serverNow: string; capabilities: PushCapabilities };
export type PushErrorCode = "unauthorized" | "account_changed" | "invalid" | "not_found" | "conflict" | "unavailable" | "rate_limited";
export const isPushId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
// Canonical Base64URL of32 random bytes. Native Keychain only; never a DOM value.
export const isPushInstallationProof = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value);
export const isPushDeviceToken = (value: unknown): value is string => typeof value === "string" && value.length >= 2 && value.length <= 1024 && value.length % 2 === 0 && /^[a-f0-9]+$/i.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function readPushRevision(value: unknown): { expectedRevision: string | null } | null {
  if (!object(value) || Object.keys(value).length !== 1 || !(value.expectedRevision === null || isPushId(value.expectedRevision))) return null;
  return { expectedRevision: value.expectedRevision };
}
export function readPushRegistration(value: unknown): PushRegistration | null {
  if (!object(value) || Object.keys(value).sort().join(",") !== "authorization,deviceToken,environment,expectedRevision,locale,preferences"
      || !(value.expectedRevision === null || isPushId(value.expectedRevision)) || !isPushDeviceToken(value.deviceToken)
      || value.authorization !== "authorized" || !["sandbox", "production"].includes(String(value.environment)) || !isAppLocale(value.locale)
      || !object(value.preferences) || Object.keys(value.preferences).sort().join(",") !== "messages,notices"
      || typeof value.preferences.messages !== "boolean" || typeof value.preferences.notices !== "boolean") return null;
  return { expectedRevision: value.expectedRevision, deviceToken: value.deviceToken.toLowerCase(), authorization: "authorized", environment: value.environment as PushEnvironment,
    locale: value.locale, preferences: { messages: value.preferences.messages, notices: value.preferences.notices } };
}
