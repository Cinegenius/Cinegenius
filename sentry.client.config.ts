import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Nur in Production aktiv
  enabled: process.env.NODE_ENV === "production",

  // 10% der Performance-Traces samplen (kostenlos Tier schonen)
  tracesSampleRate: 0.1,

  // Alle Fehler erfassen
  sampleRate: 1.0,

  // Replay nur bei echten Errors (spart Quota)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],
});
