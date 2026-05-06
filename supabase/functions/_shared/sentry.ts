/**
 * Minimal Sentry client for Supabase Edge Functions (Deno).
 *
 * Posts events to Sentry's envelope endpoint via fetch — no SDK install,
 * no native deps. If SENTRY_DSN_BACKEND is not set, every call is a no-op,
 * so wrapping a handler is always safe.
 *
 * Usage:
 *   import { captureException } from "../_shared/sentry.ts";
 *   try {
 *     ...
 *   } catch (err) {
 *     await captureException(err, {
 *       tags: { fn: "image-webhook" },
 *       extra: { galleryId },
 *     });
 *     throw err;
 *   }
 */

interface CaptureOpts {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: { id?: string; email?: string };
  level?: "fatal" | "error" | "warning" | "info";
}

interface ParsedDsn {
  envelopeUrl: string;
  publicKey: string;
  projectId: string;
}

let cachedDsn: ParsedDsn | null | undefined;

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!projectId || !u.username) return null;
    return {
      envelopeUrl: `${u.protocol}//${u.host}/api/${projectId}/envelope/`,
      publicKey: u.username,
      projectId,
    };
  } catch (_) {
    return null;
  }
}

function getDsn(): ParsedDsn | null {
  if (cachedDsn !== undefined) return cachedDsn;
  const raw = Deno.env.get("SENTRY_DSN_BACKEND") || Deno.env.get("SENTRY_DSN");
  cachedDsn = raw ? parseDsn(raw) : null;
  if (raw && !cachedDsn) {
    console.warn("Sentry DSN is malformed; backend errors will not be reported");
  }
  return cachedDsn;
}

function buildEvent(err: unknown, opts: CaptureOpts): Record<string, unknown> {
  const isError = err instanceof Error;
  const message = isError ? err.message : String(err);
  const stack = isError && err.stack ? err.stack : undefined;

  const frames: Array<Record<string, unknown>> = [];
  if (stack) {
    const lines = stack.split("\n").slice(1, 21);
    for (const line of lines.reverse()) {
      const m = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/);
      if (m) {
        frames.push({
          function: m[1] || "?",
          filename: m[2],
          lineno: Number(m[3]),
          colno: Number(m[4]),
          in_app: !m[2].includes("deno.land/") && !m[2].includes("esm.sh/"),
        });
      }
    }
  }

  return {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: opts.level || "error",
    server_name: "supabase-edge",
    environment: Deno.env.get("SENTRY_ENVIRONMENT") || "production",
    tags: opts.tags,
    extra: opts.extra,
    user: opts.user,
    exception: {
      values: [
        {
          type: isError ? err.name : "Error",
          value: message,
          stacktrace: frames.length ? { frames } : undefined,
        },
      ],
    },
  };
}

export async function captureException(err: unknown, opts: CaptureOpts = {}): Promise<void> {
  const dsn = getDsn();
  if (!dsn) {
    console.error("Edge function error (Sentry not configured):", err);
    return;
  }

  const event = buildEvent(err, opts);
  const headers = {
    "Content-Type": "application/x-sentry-envelope",
    "X-Sentry-Auth":
      `Sentry sentry_version=7,sentry_key=${dsn.publicKey},sentry_client=imagick-edge/1.0`,
  };

  const envelope =
    `${JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() })}\n` +
    `${JSON.stringify({ type: "event" })}\n` +
    `${JSON.stringify(event)}\n`;

  try {
    const res = await fetch(dsn.envelopeUrl, {
      method: "POST",
      headers,
      body: envelope,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("Sentry envelope rejected:", res.status, body.slice(0, 200));
    }
  } catch (sendErr) {
    console.warn("Sentry send failed:", sendErr);
  }
}
