import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Preserve v10 collection and batching defaults explicitly during the SDK update.
  traceLifecycle: "static",
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    },
    httpBodies: [],
    urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    graphQL: { document: false, variables: false },
  },
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Nur in Production aktiv
  enabled: process.env.NODE_ENV === "production",

  // 10% der Performance-Traces samplen (kostenlos Tier schonen)
  tracesSampleRate: 0.1,

  // Alle Fehler erfassen
  sampleRate: 1.0,

  // Session Replay stays disabled until its purpose, legal basis and consent flow are reviewed.
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
});
