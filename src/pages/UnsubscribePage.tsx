import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ViewState = "loading" | "retain" | "success" | "error";
type UnsubscribeKind = "lead" | "journey";

const TRACE_VERSION = "unsubscribe-retention-v2-2026-03-11";
const AUTH_URL = "https://studio.imagick.ai/auth";
const REQUEST_TIMEOUT_MS = 9000;
const LOGO_DARK_URL =
  "https://nzfnqgmphepxgrjkkgkq.supabase.co/storage/v1/object/public/gallery-images/brand%2Fimagick-logo-dark.png";

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
    <div className="min-h-screen flex items-center justify-center bg-[#05050B] px-4 py-12">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b0b16] shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <div className="rounded-t-3xl bg-gradient-to-r from-[#12082a] via-[#1a0d3f] to-[#09091c] px-8 py-7 text-center">
          <img src={LOGO_DARK_URL} alt="Imagick.ai" className="mx-auto h-8 opacity-95" />
        </div>

        <div className="px-8 py-9 text-white">
          {view === "loading" && (
            <div className="space-y-4 text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#ff4ca0]" />
              <p className="text-sm text-white/80">Checking your unsubscribe link...</p>
            </div>
          )}

          {view === "retain" && (
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ff4ca0]/40 bg-[#ff4ca0]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#ff7bbd]">
                <Sparkles className="h-3.5 w-3.5" />
                Before you go
              </div>
              <h1 className="text-3xl font-bold leading-tight">Get free credits and faster edits with Imagick.ai</h1>
              <p className="text-sm leading-relaxed text-white/75">
                Most photographers stay because they save hours every week and deliver galleries faster. You can keep
                these updates and start free with no commitment.
              </p>
              <ul className="space-y-2.5 text-sm text-white/85">
                <li>Custom AI styles trained on your own look</li>
                <li>Faster culling and less manual sorting</li>
                <li>Client-ready galleries that look premium</li>
                <li>Free trial access to test everything end-to-end</li>
              </ul>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={goToSignup}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff4ca0] to-[#9f63ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  Start for free
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goToSignup}
                  className="rounded-xl border border-white/20 px-5 py-3 text-sm font-medium text-white/90 transition hover:bg-white/5"
                >
                  Keep me subscribed
                </button>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleConfirmUnsubscribe}
                  disabled={isActionLoading}
                  className="text-xs text-white/50 underline underline-offset-4 hover:text-white/70 disabled:opacity-60"
                >
                  {isActionLoading ? "Unsubscribing..." : "Unsubscribe anyway"}
                </button>
              </div>
            </div>
          )}

          {view === "success" && (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-14 w-14 text-green-400" />
              <h1 className="text-2xl font-bold">You are unsubscribed</h1>
              <p className="text-sm text-white/75">
                You will no longer receive marketing emails from Imagick.ai. You can still start free anytime.
              </p>
              <button
                type="button"
                onClick={goToSignup}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff4ca0] to-[#9f63ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Start for free
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {view === "error" && (
            <div className="space-y-4 text-center">
              <XCircle className="mx-auto h-14 w-14 text-red-400" />
              <h1 className="text-2xl font-bold">We could not complete this request</h1>
              <p className="text-sm text-white/75">
                {errorMessage}
                <br />
                If this keeps happening, contact us at{" "}
                <a className="text-[#ff7bbd] underline" href="mailto:contact@imagick.ai">
                  contact@imagick.ai
                </a>
                .
              </p>
              <button
                type="button"
                onClick={goToSignup}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff4ca0] to-[#9f63ff] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Start for free
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-8 py-4 text-center text-xs text-white/40">
          <p>© {new Date().getFullYear()} Imagick.ai</p>
          <p className="mt-1">{TRACE_VERSION}</p>
        </div>
      </div>
    </div>
  );
}
