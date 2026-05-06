import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    sendDefaultPii: true,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    beforeSend(event) {
      const msg = event.message || event.exception?.values?.[0]?.value || "";
      // Browser noise that's never actionable.
      if (/ResizeObserver loop|Non-Error promise rejection captured/i.test(msg)) {
        return null;
      }
      // Stale chunk after deploy — main.tsx already recovers with a reload,
      // and the user never sees the error. Suppress so we don't drown the
      // dashboard in one row per deploy × user-with-old-tab.
      if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
        return null;
      }
      return event;
    },
  });
}

export { Sentry };
