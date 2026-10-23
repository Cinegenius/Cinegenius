export type PasswordSignInAction = "complete" | "mfa" | "unsupported";

type FinalizeNavigation = {
  navigate: (params: { decorateUrl: (url: string) => string }) => void | Promise<unknown>;
};

type FinalizeResult = { error: unknown | null };

/**
 * Clerk invokes its navigation callback while finalizing the session. Capture
 * the Safari-aware URL there, but navigate only after finalize() resolves so
 * the new session cookie is active before the destination is requested.
 */
export async function finalizeThenNavigate(
  finalize: (params: FinalizeNavigation) => Promise<FinalizeResult>,
  destination: string,
  navigate: (url: string) => void,
): Promise<FinalizeResult> {
  let decoratedDestination = destination;
  const result = await finalize({
    navigate: ({ decorateUrl }) => {
      decoratedDestination = decorateUrl(destination);
    },
  });

  if (!result.error) navigate(decoratedDestination);
  return result;
}

/** Keep same-origin redirects on the app host while preserving Clerk's HTTPS ITP URL. */
export function resolveAuthNavigationUrl(url: string, currentOrigin: string, fallback: string): string {
  try {
    const target = new URL(url, currentOrigin);
    if (target.origin === currentOrigin) return `${target.pathname}${target.search}${target.hash}`;
    if (target.protocol === "https:") return target.href;
  } catch {
    // Fall back to the already validated destination supplied by the page.
  }
  return fallback;
}

export function shouldRedirectForActiveSession(
  isLoaded: boolean,
  isSignedIn: boolean,
  signInAttemptStarted: boolean,
): boolean {
  return isLoaded && isSignedIn && !signInAttemptStarted;
}

export function getPasswordSignInAction(status: string | null | undefined): PasswordSignInAction {
  if (status === "complete") return "complete";
  if (status === "needs_second_factor" || status === "needs_client_trust") return "mfa";
  return "unsupported";
}

export type SecondFactorStrategy = "email_code" | "phone_code" | "totp" | "backup_code";
export type MfaResendChannel = "email" | "phone";

const SECOND_FACTOR_PREFERENCE: readonly SecondFactorStrategy[] = ["email_code", "phone_code", "totp", "backup_code"];

export function selectSecondFactor(supported: readonly string[]): SecondFactorStrategy | null {
  return SECOND_FACTOR_PREFERENCE.find((strategy) => supported.includes(strategy)) ?? null;
}

export function getMfaResendChannel(factor: string | null | undefined): MfaResendChannel | null {
  if (factor === "email_code") return "email";
  if (factor === "phone_code") return "phone";
  return null;
}
