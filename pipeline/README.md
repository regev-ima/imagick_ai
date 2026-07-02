# Imagick pipeline — the cheap, production engine

The architecture decided for a platform that must scale cheaply from day one.
Reuses the existing stack (Backblaze B2 + Supabase/pgvector + Vercel +
OpenRouter) and adds **one** serverless-GPU layer (Modal) that scales to zero.

```
B2 (images, exists)
   │ url
Supabase Edge Function (orchestrate, exists)
   │ batch of image urls
Modal GPU  ── ONE pass per image ───────────────┐
   • CLIP ViT-L/14 embedding   → clustering + tags
   • aesthetic score (free over CLIP) → ranking
   • ArcFace face embedding    → face grouping
   └────────────────────────────────────────────┘
   │ results
Supabase + pgvector (store embeddings, scores, faces)
   │
OpenRouter (vision LLM) ── only on the top candidate per group ── tags + final score
   │
Vercel frontend ← reads ready results (instant)
```

## The three phases

| Phase | What | Runs on | Cost / 3k gallery |
| --- | --- | --- | --- |
| **A** clustering | CLIP clusters + ArcFace face groups | Modal (cheap, all images) | ~$0.12 |
| **B** ranking | sort each group best→worst by aesthetic | free (over CLIP) | ~$0 |
| **C** judgment | tags + detailed/overall score on candidates | OpenRouter (few images) | ~$0.05 |

Idle cost: **$0** (Modal scales to zero). Total per gallery: **~$0.20**, and
the unit price drops further with batching / a cheaper GPU as volume grows —
without rewriting anything (same code, swap the GPU tier).

## Deploy the GPU engine (Phase A)

```bash
pip install modal
modal token new                       # one-time auth (free account)
modal secret create imagick-pipeline-secret PIPELINE_TOKEN=<long-random-string>
modal deploy pipeline/modal_app.py
```

Modal prints a public URL. Call it from a Supabase Edge Function:

```jsonc
POST <modal-url>
{ "token": "<PIPELINE_TOKEN>",
  "images": [{ "id": "uuid", "url": "https://<b2>/compressed/IMG_0651.jpeg" }] }
```

Response per image: `{ id, clip: [768], aesthetic: 0-10, faces: [{ bbox, det_score, embedding: [512] }] }`.

## Why these choices
- **Modal, not Replicate:** Replicate is per-call and ~3–5× pricier; Modal runs
  our own batched container and scales to zero.
- **No Cloudflare migration:** the existing Supabase + B2 already cover storage,
  DB, pgvector, and orchestration.
- **InsightFace buffalo_l (ArcFace):** production-grade face recognition — the
  fix for the browser model's grouping errors.

## Next
Phase A wiring: a Supabase Edge Function that pulls a gallery's image URLs from
B2, calls this endpoint in batches, and writes `clip`/`aesthetic`/face
embeddings into pgvector, then clusters. (Built next.)
