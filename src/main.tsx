import { Sentry } from "./lib/sentry";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// After a fresh deploy, lazy-imported chunks renamed by Vite are no longer
// at the URLs the open tab's index.html references. The next route change
// throws "Failed to fetch dynamically imported module". Vite emits the
// `vite:preloadError` event for exactly this case — recover with a hard
// reload so the browser picks up the new index.html (and the new hashes).
// sessionStorage guard prevents an infinite loop if the new bundle is also
// broken for some reason.
const RELOAD_FLAG = "imagick.chunk-reload-attempted";
window.addEventListener("vite:preloadError", (event) => {
  if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
  sessionStorage.setItem(RELOAD_FLAG, "1");
  event.preventDefault();
  window.location.reload();
});
// Same recovery for promise rejections that aren't routed through the Vite
// event (older browsers or hand-rolled dynamic imports).
window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event.reason?.message || event.reason || "");
  if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
    if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    event.preventDefault();
    window.location.reload();
  }
});
// Clear the guard once the app actually mounts successfully so a future
// deploy can recover the same way.
window.addEventListener("load", () => {
  setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 5000);
});

function isStaleChunkError(error: unknown): boolean {
  const msg = String((error as { message?: string } | null | undefined)?.message ?? error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg);
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={({ error, resetError }) => {
      // Belt-and-suspenders: if the lazy() chunk failure slipped past the
      // global vite:preloadError listener, the ErrorBoundary still catches
      // it here. Trigger a single hard reload so the user lands on the
      // new bundle without ever seeing the fallback.
      if (isStaleChunkError(error) && sessionStorage.getItem(RELOAD_FLAG) !== "1") {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
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
