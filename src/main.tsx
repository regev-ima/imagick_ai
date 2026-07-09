import { Sentry } from "./lib/sentry";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// After a fresh deploy, lazy-imported chunks renamed by Vite are no longer at
// the URLs the open tab's index.html references. The next route change fails
// to import its chunk ("Failed to fetch dynamically imported module"). We
// recover with a hard reload so the browser picks up the new index.html (and
// the new hashes). This must survive MANY deploys in a row (an old tab left
// open across several releases), so instead of a one-shot flag we throttle by
// time and cap the total attempts — enough to self-heal on every deploy, but
// never an infinite loop if a build is genuinely broken.
const RELOAD_TS = "imagick.chunk-reload-ts";
const RELOAD_COUNT = "imagick.chunk-reload-count";
const RELOAD_MIN_INTERVAL = 8000; // never auto-reload twice within 8s
const RELOAD_MAX = 3; // …or more than 3 times before showing the fallback

const STALE_CHUNK_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|dynamically imported module/i;

function isStaleChunkError(error: unknown): boolean {
  const msg = String((error as { message?: string } | null | undefined)?.message ?? error ?? "");
  return STALE_CHUNK_RE.test(msg);
}

function recoverFromStaleChunk(): boolean {
  const now = Date.now();
  const last = Number(sessionStorage.getItem(RELOAD_TS) || 0);
  const count = Number(sessionStorage.getItem(RELOAD_COUNT) || 0);
  if (now - last < RELOAD_MIN_INTERVAL) return false; // just reloaded — avoid a loop
  if (count >= RELOAD_MAX) return false; // give up and let the fallback show
  sessionStorage.setItem(RELOAD_TS, String(now));
  sessionStorage.setItem(RELOAD_COUNT, String(count + 1));
  window.location.reload();
  return true;
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  recoverFromStaleChunk();
});
// Same recovery for promise rejections that aren't routed through the Vite
// event (older browsers or hand-rolled dynamic imports).
window.addEventListener("unhandledrejection", (event) => {
  if (isStaleChunkError(event.reason)) {
    event.preventDefault();
    recoverFromStaleChunk();
  }
});
// Once the app has been stable for a while, forget the attempt count so a
// future deploy recovers cleanly from scratch.
window.addEventListener("load", () => {
  setTimeout(() => sessionStorage.removeItem(RELOAD_COUNT), 15000);
});

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={({ error, resetError }) => {
      // Belt-and-suspenders: if the lazy() chunk failure slipped past the
      // global vite:preloadError listener, the ErrorBoundary still catches
      // it here. Reload (throttled/capped) so the user lands on the new
      // bundle without ever seeing the fallback.
      if (isStaleChunkError(error) && recoverFromStaleChunk()) {
        return null;
      }
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground">
              We've been notified and are looking into it. You can try again.
            </p>
            <button
              onClick={resetError}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }}
  >
    <App />
  </Sentry.ErrorBoundary>,
);
