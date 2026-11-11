export const AUTH_TASK_URLS = {
  "reset-password": "/sign-in/tasks/reset-password",
  "choose-organization": "/sign-in/tasks/choose-organization",
  "setup-mfa": "/sign-in/tasks/setup-mfa",
} as const;

export type AuthSessionTaskKey = keyof typeof AUTH_TASK_URLS;

export function isAuthSessionTaskKey(value: string): value is AuthSessionTaskKey {
  return Object.hasOwn(AUTH_TASK_URLS, value);
}
