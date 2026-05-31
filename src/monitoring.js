// ─── Error monitoring ─────────────────────────────────────────────────────────
// Thin wrapper around Sentry. The SDK is dynamically imported ONLY when a DSN is
// configured, so it never touches the first-paint bundle and is a complete
// no-op otherwise. Monitoring must never break the app — every path swallows
// its own errors.

import { SENTRY_DSN } from './config.js';

let sentry = null;

export function initMonitoring() {
  if (!SENTRY_DSN) return; // no DSN → never load the SDK
  import('@sentry/browser')
    .then((S) => {
      S.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        // Errors only — no performance traces or session replay, to keep the
        // app fast and the data minimal (privacy-first, PH mobile data).
        tracesSampleRate: 0,
        sendDefaultPii: false,
      });
      sentry = S;
    })
    .catch(() => {
      /* monitoring is best-effort; never surface its own failure */
    });
}

// Report a caught error. Safe to call before/without init (just no-ops).
export function reportError(err, context) {
  try {
    if (sentry) {
      sentry.captureException(err, context ? { extra: context } : undefined);
    } else if (import.meta.env.DEV) {
      console.error('[monitoring]', err, context || '');
    }
  } catch {
    /* never throw from the reporter */
  }
}
