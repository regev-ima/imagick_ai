import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrandLogo } from "@/hooks/useBrandLogo";

type ViewState = "loading" | "retain" | "success" | "error";
type UnsubscribeKind = "lead" | "journey";

const TRACE_VERSION = "unsubscribe-retention-v2-2026-03-11";
// Use the same origin as the page, so this stays correct across staging
// previews and any future domain change without a code edit.
const AUTH_URL = `${typeof window !== "undefined" ? window.location.origin : ""}/auth`;
const REQUEST_TIMEOUT_MS = 9000;

// The AI mark — a royal-blue 4-point sparkle (the logo star).
function Sparkle({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ display: "block" }}
    >
      <path
        d="M12 0 C12.9 7.2 16.8 11.1 24 12 C16.8 12.9 12.9 16.8 12 24 C11.1 16.8 7.2 12.9 0 12 C7.2 11.1 11.1 7.2 12 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export default function UnsubscribePage() {
  const { logo: imagickLogo } = useBrandLogo();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("This link is invalid or has expired.");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const token = searchParams.get("token");
  const kind = useMemo<UnsubscribeKind | null>(() => {
    const raw = searchParams.get("kind");
    if (raw === "lead" || raw === "journey") return raw;
    return raw ? null : "journey";
  }, [searchParams]);

  const functionName = kind === "lead" ? "lead-unsubscribe" : "journey-unsubscribe";

  async function callUnsubscribeEndpoint(action: "validate" | "unsubscribe") {
    if (!token || !kind) {
      throw new Error("Invalid unsubscribe link");
    }

    const { data, error } = await withTimeout(
      supabase.functions.invoke(functionName, {
        body: { token, action },
      }),
    );

    if (error) {
      throw new Error(error.message || "Request failed");
    }

    if (!data?.success) {
      throw new Error(data?.message || "Request failed");
    }
  }

  useEffect(() => {
    if (!token) {
      setErrorMessage("Missing unsubscribe token.");
      setView("error");
      return;
    }
    if (!kind) {
      setErrorMessage("Unsupported unsubscribe link type.");
      setView("error");
      return;
    }

    console.info(`[${TRACE_VERSION}] validating unsubscribe token`, { kind });
    setView("loading");
    setErrorMessage("This unsubscribe link is invalid or has expired.");

    callUnsubscribeEndpoint("validate")
      .then(() => {
        console.info(`[${TRACE_VERSION}] token validated`, { kind });
        setView("retain");
      })
      .catch((error: unknown) => {
        console.error(`[${TRACE_VERSION}] validate failed`, error);
        const message = error instanceof Error ? error.message : "Unable to process your request.";
        setErrorMessage(message);
        setView("error");
      });
  }, [token, kind]);

  async function handleConfirmUnsubscribe() {
    setIsActionLoading(true);
    try {
      console.info(`[${TRACE_VERSION}] unsubscribe confirmed`, { kind });
      await callUnsubscribeEndpoint("unsubscribe");
      setView("success");
    } catch (error: unknown) {
      console.error(`[${TRACE_VERSION}] unsubscribe failed`, error);
      const message = error instanceof Error ? error.message : "Unable to process your request.";
      setErrorMessage(message);
      setView("error");
    } finally {
      setIsActionLoading(false);
    }
  }

  function goToSignup() {
    window.location.href = AUTH_URL;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl glass-card rounded-md overflow-hidden">
        {/* Header — brand row over a hairline */}
        <div className="flex items-center justify-between gap-2 border-b border-border bg-background/40 px-8 py-5">
          <div className="flex items-center">
            <img src={imagickLogo} alt="Imagick.ai" className="h-7" />
          </div>
          <span className="aura-microlabel">Email · Preferences</span>
        </div>

        <div className="px-8 py-9">
          {view === "loading" && (
            <div className="space-y-4 text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Checking your unsubscribe link...</p>
            </div>
          )}

          {view === "retain" && (
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/[0.08] px-3 py-1 caption text-accent">
                <Sparkle size={11} className="text-accent" />
                Before you go
              </div>
              <h1 className="font-sans text-3xl font-bold leading-tight tracking-tight text-foreground">
                Get free credits and faster edits with Imagick.ai
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Most photographers stay because they save hours every week and deliver galleries faster. You can keep
                these updates and start free with no commitment.
              </p>
              <ul className="space-y-2.5 text-sm text-foreground/85">
                {[
                  "Custom AI styles trained on your own look",
                  "Faster culling and less manual sorting",
                  "Client-ready galleries that look premium",
                  "Free trial access to test everything end-to-end",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Sparkle size={11} className="mt-1 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={goToSignup}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:opacity-90"
                >
                  Start for free
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goToSignup}
                  className="rounded-md border border-border bg-surface-2 px-5 py-3 text-sm font-medium text-foreground transition-colors duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:border-primary/40 hover:bg-muted"
                >
                  Keep me subscribed
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleConfirmUnsubscribe}
                  disabled={isActionLoading}
                  className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-60"
                >
                  {isActionLoading ? "Unsubscribing..." : "Unsubscribe anyway"}
                </button>
              </div>
            </div>
          )}

          {view === "success" && (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-14 w-14 text-secondary" />
              <h1 className="font-sans text-2xl font-bold tracking-tight text-foreground">You are unsubscribed</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You will no longer receive marketing emails from Imagick.ai. You can still start free anytime.
              </p>
              <button
                type="button"
                onClick={goToSignup}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:opacity-90"
              >
                Start for free
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {view === "error" && (
            <div className="space-y-4 text-center">
              <XCircle className="mx-auto h-14 w-14 text-destructive" />
              <h1 className="font-sans text-2xl font-bold tracking-tight text-foreground">
                We could not complete this request
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {errorMessage}
                <br />
                If this keeps happening, contact us at{" "}
                <a className="text-primary underline underline-offset-4 hover:no-underline" href="mailto:contact@imagick.ai">
                  contact@imagick.ai
                </a>
                .
              </p>
              <button
                type="button"
                onClick={goToSignup}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity duration-200 [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:opacity-90"
              >
                Start for free
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background/40 px-8 py-4 text-center">
          <p className="caption">© {new Date().getFullYear()} Imagick.ai</p>
          <p className="caption mt-1 opacity-60">{TRACE_VERSION}</p>
        </div>
      </div>
    </div>
  );
}
