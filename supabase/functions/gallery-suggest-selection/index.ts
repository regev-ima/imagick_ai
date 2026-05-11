/**
 * gallery-suggest-selection
 *
 * AI PRE-SELECTION. Given a target count, pick the strongest images from
 * a gallery using a heuristic ranking (ai_rating + is_liked + diversity).
 * Then mark them with `is_ai_suggested=true` and create pre-seeded rows in
 * `gallery_selections` under the sentinel email `__ai_suggested__` so the
 * photographer can preview the proposal before sending it to clients.
 *
 * Auth required (Bearer). The user must own the gallery.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_SUGGESTED_SENTINEL = "__ai_suggested__";

interface SuggestRequest {
  galleryId: string;
  targetCount: number;
}

interface ImageRow {
  id: string;
  ai_rating: number | null;
  is_liked: boolean | null;
  culling_label: string | null;
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 30; // 30 suggest calls per hour per user
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

/**
 * Heuristic ranking:
 *   base = (ai_rating * 10) + (is_liked ? 5 : 0)
 *   diversity_bonus = +2 if image's culling_label hasn't been picked yet
 * Performed as a greedy single pass — sort by base score desc, then walk
 * the list and award the diversity bonus on the fly so we naturally favour
 * unseen labels among ties.
 */
function rankAndSelect(images: ImageRow[], target: number): string[] {
  // Pre-compute base score and sort descending.
  const scored = images.map((img) => ({
    id: img.id,
    label: img.culling_label || "__unlabeled__",
    base: ((img.ai_rating ?? 0) * 10) + ((img.is_liked ?? false) ? 5 : 0),
  }));
  scored.sort((a, b) => b.base - a.base);

  const selected: string[] = [];
  const seenLabels = new Set<string>();

  // Two-phase walk: first prefer items that contribute a *new* label
  // (greedy diversity), then fall back to remaining top-scored items.
  const remaining: typeof scored = [];
  for (const item of scored) {
    if (selected.length >= target) break;
    if (!seenLabels.has(item.label)) {
      // diversity bonus applies — pick now
      selected.push(item.id);
      seenLabels.add(item.label);
    } else {
      remaining.push(item);
    }
  }
  for (const item of remaining) {
    if (selected.length >= target) break;
    selected.push(item.id);
  }
  return selected;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "Unauthorized - missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      return json({ success: false, error: "Unauthorized - invalid token" }, 401);
    }
    const userId = userData.user.id as string;

    if (!checkRateLimit(userId)) {
      return json({ success: false, error: "Too many suggestion requests. Please try again later." }, 429);
    }

    const { galleryId, targetCount }: SuggestRequest = await req.json();
    if (!galleryId || typeof targetCount !== "number" || targetCount <= 0) {
      return json({ success: false, error: "Missing or invalid: galleryId, targetCount" }, 400);
    }
    if (targetCount > 500) {
      return json({ success: false, error: "targetCount cannot exceed 500" }, 400);
    }

    // Verify ownership
    const { data: gallery, error: galleryError } = await supabase
      .from("galleries")
      .select("id, user_id")
      .eq("id", galleryId)
      .single();
    if (galleryError || !gallery) {
      return json({ success: false, error: "Gallery not found" }, 404);
    }
    if (gallery.user_id !== userId) {
      return json({ success: false, error: "Forbidden - you do not own this gallery" }, 403);
    }

    // Fetch ready images (service-role to avoid RLS round-tripping)
    const { data: images, error: imgError } = await supabaseAdmin
      .from("gallery_images")
      .select("id, ai_rating, is_liked, culling_label")
      .eq("gallery_id", galleryId)
      .eq("status", "ready");

    if (imgError) {
      console.error("[gallery-suggest-selection] fetch images failed:", imgError);
      return json({ success: false, error: "Failed to fetch gallery images" }, 500);
    }

    const ready = (images ?? []) as ImageRow[];
    if (ready.length === 0) {
      return json({ success: true, count: 0, imageIds: [] });
    }

    const chosenIds = rankAndSelect(ready, targetCount);

    // 1. Reset is_ai_suggested for the whole gallery, then mark the chosen.
    const { error: resetError } = await supabaseAdmin
      .from("gallery_images")
      .update({ is_ai_suggested: false })
      .eq("gallery_id", galleryId);
    if (resetError) {
      console.error("[gallery-suggest-selection] reset flag failed:", resetError);
      return json({ success: false, error: "Failed to reset suggestion flag" }, 500);
    }

    if (chosenIds.length > 0) {
      const { error: markError } = await supabaseAdmin
        .from("gallery_images")
        .update({ is_ai_suggested: true })
        .in("id", chosenIds);
      if (markError) {
        console.error("[gallery-suggest-selection] mark flag failed:", markError);
        return json({ success: false, error: "Failed to mark suggested images" }, 500);
      }
    }

    // 2. Clear previous AI-suggested selections rows, then re-create.
    const { error: delError } = await supabaseAdmin
      .from("gallery_selections")
      .delete()
      .eq("gallery_id", galleryId)
      .eq("client_email", AI_SUGGESTED_SENTINEL);
    if (delError) {
      console.error("[gallery-suggest-selection] clear previous selections failed:", delError);
      // Non-fatal — continue.
    }

    if (chosenIds.length > 0) {
      const rows = chosenIds.map((image_id) => ({
        gallery_id: galleryId,
        image_id,
        client_email: AI_SUGGESTED_SENTINEL,
        client_name: "AI Suggested",
        selected: true,
      }));
      const { error: insertError } = await supabaseAdmin
        .from("gallery_selections")
        .insert(rows);
      if (insertError) {
        console.error("[gallery-suggest-selection] insert selections failed:", insertError);
        return json({ success: false, error: "Failed to seed selections" }, 500);
      }
    }

    // Audit log
    const { error: auditError } = await supabaseAdmin
      .from("gallery_audit_log")
      .insert({
        gallery_id: galleryId,
        event_type: "ai_suggestion",
        metadata: { target_count: targetCount, actual_count: chosenIds.length, requested_by: userId },
      });
    if (auditError) {
      console.error("[gallery-suggest-selection] audit insert failed:", auditError);
    }

    return json({ success: true, count: chosenIds.length, imageIds: chosenIds });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[gallery-suggest-selection] error:", message);
    return json({ success: false, error: message }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(handler);
