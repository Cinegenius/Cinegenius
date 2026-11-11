export type PasswordSignInAction = "complete" | "mfa" | "new-password" | "unsupported";

type FinalizeNavigation = {
  navigate: (params: { session?: { currentTask?: { key: string } | null } | null; decorateUrl: (url: string) => string }) => void | Promise<unknown>;
};

type FinalizeResult = { error: unknown | null };

/**
 * Clerk invokes navigate at its session commit point, before publishing the
 * new auth state to observers. Navigate there, not after finalize resolves:
 * otherwise the SDK can refresh the old route before our navigation starts.
 */
export async function finalizeThenNavigate(
  finalize: (params: FinalizeNavigation) => Promise<FinalizeResult>,
  destination: string,
  navigate: (url: string) => void | Promise<unknown>,
): Promise<FinalizeResult> {
  let navigationStarted = false;
  return finalize({
    navigate: ({ session, decorateUrl }) => {
      // Clerk redirects pending sessions to the configured taskUrls.
      // Do not send them to protected content before security tasks complete.
      if (session?.currentTask || navigationStarted) return;
      navigationStarted = true;
      return navigate(decorateUrl(destination));
    },
  });
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
  if (status === "needs_new_password") return "new-password";
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
