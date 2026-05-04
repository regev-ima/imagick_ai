// @ts-nocheck
// Edge function: detect faces in gallery images via Azure Face API, then group them
// Supports self-chaining for large galleries (detect phase processes 100 images per invocation)
// Chained calls use service role key to avoid JWT expiration issues
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const AZURE_ENDPOINT = "https://imagick-face-api.cognitiveservices.azure.com";
const DETECT_BATCH_SIZE = 10;
const DETECT_BATCH_SLEEP_MS = 3000;
const IMAGES_PER_INVOCATION = 100;
const GROUP_API_MAX = 1000;
const DETECTIONS_PAGE_SIZE = 1000;

interface RequestBody {
  galleryId: string;
  phase?: "detect" | "group";
  offset?: number;
  // Internal fields for self-chaining (not sent by frontend)
  _internal?: boolean;
  _userId?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert an original B2 URL to its compressed JPEG version.
 * Original: .../galleries/{userId}/{galleryId}/{filename}.JPG
 * Compressed: .../galleries/{userId}/{galleryId}/compressed/{filename}_reduced.jpeg
 */
function toCompressedJpegUrl(originalUrl: string): string {
  try {
    const lastSlash = originalUrl.lastIndexOf("/");
    if (lastSlash === -1) return originalUrl;
    const basePath = originalUrl.substring(0, lastSlash);
    const fullFilename = originalUrl.substring(lastSlash + 1);
    const lastDot = fullFilename.lastIndexOf(".");
    const filename = lastDot > 0 ? fullFilename.substring(0, lastDot) : fullFilename;
    return `${basePath}/compressed/${filename}_reduced.jpeg`;
  } catch {
    return originalUrl;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const azureKey = Deno.env.get("AZURE_FACE_API_KEY");

  if (!azureKey) {
    return new Response(
      JSON.stringify({ error: "AZURE_FACE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { galleryId, phase = "detect", offset = 0, _internal = false, _userId } = body;

    if (!galleryId) {
      return new Response(
        JSON.stringify({ error: "galleryId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for DB operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    let userId: string;

    if (_internal && _userId) {
      // Chained call — trust the userId from the chain payload
      // Verify this is actually a service-role call by checking the apikey header
      const apiKey = req.headers.get("apikey");
      if (apiKey !== supabaseServiceKey) {
        return new Response(
          JSON.stringify({ error: "Unauthorized internal call" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = _userId;
      console.log(`Chained call: phase=${phase}, offset=${offset}, gallery=${galleryId}`);
    } else {
      // Frontend call — verify user JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseClient.auth.getUser(token);
      if (claimsError || !claimsData?.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = claimsData.user.id;

      // Verify gallery ownership (only on initial call)
      const { data: gallery, error: galleryError } = await supabaseAdmin
        .from("galleries")
        .select("id, user_id, status")
        .eq("id", galleryId)
        .eq("user_id", userId)
        .single();

      if (galleryError || !gallery) {
        return new Response(
          JSON.stringify({ error: "Gallery not found or unauthorized" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // On first invocation: set status + clear old data
    if (phase === "detect" && offset === 0) {
      await supabaseAdmin
        .from("galleries")
        .update({
          face_search_status: "processing",
          face_search_started_at: new Date().toISOString(),
          face_search_completed_at: null,
          face_search_error: null,
        })
        .eq("id", galleryId);

      // Delete previous face data for re-run support
      await supabaseAdmin.from("face_detections").delete().eq("gallery_id", galleryId);
      await supabaseAdmin.from("face_clusters").delete().eq("gallery_id", galleryId);
    }

    if (phase === "detect") {
      return await handleDetectPhase(supabaseAdmin, supabaseUrl, supabaseServiceKey, azureKey, galleryId, userId, offset);
    } else {
      return await handleGroupPhase(supabaseAdmin, azureKey, galleryId);
    }
  } catch (error: unknown) {
    console.error("Error in process-gallery-faces:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleDetectPhase(
  supabaseAdmin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseServiceKey: string,
  azureKey: string,
  galleryId: string,
  userId: string,
  offset: number
) {
  // Fetch batch of images
  const { data: images, error: imgError } = await supabaseAdmin
    .from("gallery_images")
    .select("id, original_url")
    .eq("gallery_id", galleryId)
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .range(offset, offset + IMAGES_PER_INVOCATION - 1);

  if (imgError) {
    await setError(supabaseAdmin, galleryId, `Failed to fetch images: ${imgError.message}`);
    return errorResponse(`Failed to fetch images: ${imgError.message}`);
  }

  if (!images || images.length === 0) {
    // No more images to process — move to group phase
    console.log(`Detection complete for gallery ${galleryId}, moving to group phase`);
    return await selfChain(supabaseUrl, supabaseServiceKey, galleryId, userId, "group", 0);
  }

  console.log(`Detecting faces in ${images.length} images (offset=${offset}) for gallery ${galleryId}`);

  let successCount = 0;
  let failCount = 0;
  let firstError = "";

  // Log the first image URL for debugging
  if (images.length > 0) {
    const sampleUrl = toCompressedJpegUrl(images[0].original_url);
    console.log(`First image URL being sent to Azure: ${sampleUrl}`);
  }

  // Process in batches of DETECT_BATCH_SIZE
  for (let i = 0; i < images.length; i += DETECT_BATCH_SIZE) {
    const batch = images.slice(i, i + DETECT_BATCH_SIZE);

    for (const image of batch) {
      try {
        // Use compressed JPEG version — smaller file size + Azure-compatible format
        const imageUrl = toCompressedJpegUrl(image.original_url);
        const faces = await detectFaces(azureKey, imageUrl);
        successCount++;

        if (faces.length > 0) {
          console.log(`Image ${image.id}: found ${faces.length} face(s)`);
          const rows = faces.map((face: AzureFaceResult) => ({
            image_id: image.id,
            gallery_id: galleryId,
            bounding_box: face.faceRectangle,
            azure_face_id: face.faceId,
          }));

          const { error: insertError } = await supabaseAdmin
            .from("face_detections")
            .insert(rows);

          if (insertError) {
            console.error(`Failed to insert detections for image ${image.id}:`, insertError.message);
          }
        } else {
          console.log(`Image ${image.id}: no faces found`);
        }
      } catch (err) {
        failCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Face detection failed for image ${image.id}: ${errMsg}`);
        if (!firstError) firstError = errMsg;
        // Continue to next image
      }
    }

    // Sleep between batches to respect Azure free tier rate limits (20 calls/min)
    if (i + DETECT_BATCH_SIZE < images.length) {
      await sleep(DETECT_BATCH_SLEEP_MS);
    }
  }

  console.log(`Batch complete: ${successCount} succeeded, ${failCount} failed out of ${images.length}`);

  // If ALL images failed, save the error so the user can see it
  if (failCount > 0 && successCount === 0 && firstError) {
    await setError(supabaseAdmin, galleryId, `Azure Face API error: ${firstError}`);
    return errorResponse(`All images failed. First error: ${firstError}`);
  }

  // Check if more images remain
  const nextOffset = offset + IMAGES_PER_INVOCATION;
  const { count } = await supabaseAdmin
    .from("gallery_images")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", galleryId)
    .eq("status", "ready");

  if (count && nextOffset < count) {
    // More images to process — self-chain
    console.log(`More images remain (${nextOffset}/${count}), chaining next detect batch`);
    return await selfChain(supabaseUrl, supabaseServiceKey, galleryId, userId, "detect", nextOffset);
  }

  // All images processed — move to group phase
  console.log(`All images detected for gallery ${galleryId}, moving to group phase`);
  return await selfChain(supabaseUrl, supabaseServiceKey, galleryId, userId, "group", 0);
}

async function handleGroupPhase(
  supabaseAdmin: ReturnType<typeof createClient>,
  azureKey: string,
  galleryId: string
) {
  // Fetch ALL face detections with pagination (PostgREST defaults to 1000 rows)
  const allDetections: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("face_detections")
      .select("id, image_id, bounding_box, azure_face_id")
      .eq("gallery_id", galleryId)
      .not("azure_face_id", "is", null)
      .range(page * DETECTIONS_PAGE_SIZE, (page + 1) * DETECTIONS_PAGE_SIZE - 1);

    if (error) {
      await setError(supabaseAdmin, galleryId, `Failed to fetch detections: ${error.message}`);
      return errorResponse(`Failed to fetch detections: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    allDetections.push(...data);
    if (data.length < DETECTIONS_PAGE_SIZE) break;
    page++;
  }

  console.log(`Group phase: ${allDetections.length} face detections for gallery ${galleryId}`);

  if (allDetections.length === 0) {
    // No faces found at all
    await markCompleted(supabaseAdmin, galleryId);
    return successResponse({ message: "No faces detected in gallery", clusters: 0 });
  }

  // Build lookup: azure_face_id → detection
  const faceIdMap = new Map<string, (typeof allDetections)[0]>();
  for (const det of allDetections) {
    if (det.azure_face_id) {
      faceIdMap.set(det.azure_face_id, det);
    }
  }

  const allFaceIds = Array.from(faceIdMap.keys());

  if (allFaceIds.length === 1) {
    // Only one face — create a single cluster
    const det = faceIdMap.get(allFaceIds[0])!;
    const { data: cluster } = await supabaseAdmin
      .from("face_clusters")
      .insert({
        gallery_id: galleryId,
        representative_image_id: det.image_id,
        representative_bbox: det.bounding_box,
        face_count: 1,
      })
      .select("id")
      .single();

    if (cluster) {
      await supabaseAdmin
        .from("face_detections")
        .update({ cluster_id: cluster.id })
        .eq("id", det.id);
    }

    await markCompleted(supabaseAdmin, galleryId);
    return successResponse({ message: "Face grouping complete", clusters: 1 });
  }

  // Group faces using Azure Face Group API (max 1000 per call)
  try {
    let allGroups: string[][] = [];
    let allMessy: string[] = [];

    // Chunk into groups of GROUP_API_MAX
    for (let i = 0; i < allFaceIds.length; i += GROUP_API_MAX) {
      const chunk = allFaceIds.slice(i, i + GROUP_API_MAX);
      const result = await groupFaces(azureKey, chunk);
      allGroups.push(...result.groups);
      allMessy.push(...(result.messyGroup || []));
    }

    console.log(`Grouping result: ${allGroups.length} groups, ${allMessy.length} messy faces`);

    // Create clusters for each group
    let clusterCount = 0;
    for (const group of allGroups) {
      // Find representative: largest bounding box area
      let bestDet = faceIdMap.get(group[0])!;
      let bestArea = bboxArea(bestDet.bounding_box);

      for (const faceId of group) {
        const det = faceIdMap.get(faceId)!;
        const area = bboxArea(det.bounding_box);
        if (area > bestArea) {
          bestDet = det;
          bestArea = area;
        }
      }

      const { data: cluster } = await supabaseAdmin
        .from("face_clusters")
        .insert({
          gallery_id: galleryId,
          representative_image_id: bestDet.image_id,
          representative_bbox: bestDet.bounding_box,
          face_count: group.length,
        })
        .select("id")
        .single();

      if (cluster) {
        // Update all detections in this group
        const detectionIds = group.map((fid) => faceIdMap.get(fid)!.id);
        await supabaseAdmin
          .from("face_detections")
          .update({ cluster_id: cluster.id })
          .in("id", detectionIds);
        clusterCount++;
      }
    }

    // Each messy face becomes its own single-face cluster
    for (const faceId of allMessy) {
      const det = faceIdMap.get(faceId)!;
      const { data: cluster } = await supabaseAdmin
        .from("face_clusters")
        .insert({
          gallery_id: galleryId,
          representative_image_id: det.image_id,
          representative_bbox: det.bounding_box,
          face_count: 1,
        })
        .select("id")
        .single();

      if (cluster) {
        await supabaseAdmin
          .from("face_detections")
          .update({ cluster_id: cluster.id })
          .eq("id", det.id);
        clusterCount++;
      }
    }

    // Clear temporary azure_face_id values
    await supabaseAdmin
      .from("face_detections")
      .update({ azure_face_id: null })
      .eq("gallery_id", galleryId);

    await markCompleted(supabaseAdmin, galleryId);
    return successResponse({ message: "Face grouping complete", clusters: clusterCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Grouping failed";
    console.error("Face grouping error:", err);
    await setError(supabaseAdmin, galleryId, msg);
    return errorResponse(msg);
  }
}

// --- Azure Face API calls ---

interface AzureFaceResult {
  faceId: string;
  faceRectangle: { top: number; left: number; width: number; height: number };
}

async function detectFaces(azureKey: string, imageUrl: string): Promise<AzureFaceResult[]> {
  const url = `${AZURE_ENDPOINT}/face/v1.0/detect?returnFaceId=true&returnFaceLandmarks=false&recognitionModel=recognition_04&detectionModel=detection_03&faceIdTimeToLive=86400`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": azureKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: imageUrl }),
  });

  if (res.status === 429) {
    // Rate limited — wait and retry once
    console.warn("Azure rate limited, waiting 10s...");
    await sleep(10000);
    const retry = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": azureKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: imageUrl }),
    });
    if (!retry.ok) {
      throw new Error(`Azure Face Detect failed after retry: ${retry.status} ${await retry.text()}`);
    }
    return await retry.json();
  }

  if (!res.ok) {
    throw new Error(`Azure Face Detect failed: ${res.status} ${await res.text()}`);
  }

  return await res.json();
}

interface GroupResult {
  groups: string[][];
  messyGroup?: string[];
}

async function groupFaces(azureKey: string, faceIds: string[]): Promise<GroupResult> {
  const url = `${AZURE_ENDPOINT}/face/v1.0/group`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": azureKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ faceIds }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Azure Face Group failed: ${res.status} ${errorText}`);
  }

  return await res.json();
}

// --- Helpers ---

function bboxArea(bbox: { width: number; height: number }): number {
  return bbox.width * bbox.height;
}

async function selfChain(
  supabaseUrl: string,
  supabaseServiceKey: string,
  galleryId: string,
  userId: string,
  phase: "detect" | "group",
  offset: number
) {
  const chainUrl = `${supabaseUrl}/functions/v1/process-gallery-faces`;

  try {
    // Await the fetch to ensure it completes before the isolate shuts down
    const res = await fetch(chainUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
        apikey: supabaseServiceKey,
      },
      body: JSON.stringify({
        galleryId,
        phase,
        offset,
        _internal: true,
        _userId: userId,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Self-chain failed: ${res.status} ${text}`);
      // Don't throw — the current batch was already processed successfully
    }
  } catch (err) {
    console.error("Self-chain network error:", err);
  }

  return successResponse({
    message: `Chaining to ${phase} phase (offset=${offset})`,
    chained: true,
  });
}

async function setError(supabaseAdmin: ReturnType<typeof createClient>, galleryId: string, error: string) {
  await supabaseAdmin
    .from("galleries")
    .update({
      face_search_status: "error",
      face_search_error: error,
    })
    .eq("id", galleryId);
}

async function markCompleted(supabaseAdmin: ReturnType<typeof createClient>, galleryId: string) {
  await supabaseAdmin
    .from("galleries")
    .update({
      face_search_status: "completed",
      face_search_completed_at: new Date().toISOString(),
    })
    .eq("id", galleryId);
}

function successResponse(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
