import { Sentry } from "./lib/sentry";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={({ resetError }) => (
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
    )}
  >
    <App />
  </Sentry.ErrorBoundary>,
);
