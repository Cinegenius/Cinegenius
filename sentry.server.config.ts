import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === "production",

  // Server-seitig alle Fehler + wenige Traces
  tracesSampleRate: 0.1,
  sampleRate: 1.0,
});
