/**
 * Extract the real error message from a supabase.functions.invoke failure.
 *
 * On a non-2xx response, supabase-js rejects with a FunctionsHttpError whose
 * `message` is always the generic "Edge Function returned a non-2xx status
 * code" — the function's actual JSON body ({ error: "..." }) is left unread
 * on `error.context` (a Fetch Response). Surfacing it turns an opaque failure
 * into an actionable one ("Failed to connect to transfer service", "Cannot
 * access this folder…", storage-limit messages, etc.).
 */
export async function extractFunctionError(
  error: unknown,
  fallback: string,
): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    try {
      const body = await ctx.clone().json();
      const message = body?.message || body?.error;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      /* body wasn't JSON — fall through */
    }
  }
  const message = (error as { message?: string })?.message;
  return message || fallback;
}
