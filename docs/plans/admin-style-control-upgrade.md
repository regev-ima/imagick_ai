# Admin Style Control Upgrade — Work Plan

> Execution model: tasks T0–T7 below. T0 must land first (foundation).
> T1, T2, T3, T5, T6 can then run **in parallel** (separate agents, separate
> worktrees). T4 depends on T2+T3. T7 is the final integration/polish pass.
> Every task lists its files, exact steps, and acceptance criteria.

## Product requirements (from the owner, verbatim intent)

1. Admin must see a style's full BEFORE/AFTER training gallery, with large
   image viewing (lightbox).
2. When a style finishes training, automatically edit its own SOURCE
   collection with the new style.
3. Three-way compare: source photo · photographer's edit · model's edit.
4. Show total upload time for the training material.
5. File count — BEFORE set.
6. File count — AFTER set.
7. File types breakdown for BEFORE and AFTER — a list of filenames with
   their type (RAW variants, JPG, …).
8. Beyond training start/end timestamps, show total duration as hours+minutes.
9. A "Retrain" button → creates a **new** style (confirmation dialog),
   same training collections, fresh training; lineage must be recorded
   (which style it was retrained from) with navigation to the parent.
10. Retrain with the **same BEFORE material but a different AFTER set**
    (photographers edit the same shoot in several looks): popup to upload the
    new AFTER files + new style name; copy all details incl. source images.

## Codebase facts (verified — do not re-research)

- **Training file layout (B2)**: `styles/{userId}/{styleId}/before/` and
  `.../after/`. Original filenames are PRESERVED (sanitized: `/\\`→`_`,
  whitespace→`_`) — pairing before↔after is by filename stem. Local uploads:
  `CreateGalleryPage`-style hand-rolled PUT loop in
  `src/pages/dashboard/CreateStylePage.tsx` → `uploadStyleFiles()` (lines
  ~290-390), signed URLs via `image-upload` edge fn, PUT to the CF→B2 proxy.
- **Drive imports**: `gd-import` with `transferType: "style-before"|"style-after"`,
  `use_uuid4:false` (names preserved), callback → **train-webhook Branch A**
  (discriminated by `!!body.file_mappings`), which counts
  `import_transfers_completed` vs `total` and then POSTs `train-style`.
- **`train-style`** (`supabase/functions/train-style/index.ts`): body
  `{styleId, modelType, beforeDirs, afterDirs}` — **dirs are arbitrary, caller
  controlled** (this is what makes retrain-from-parent-dirs possible). It sets
  `status:'training'`, `training_start_date`, `style_id_external =
  style_<id>_<rand8>`. NOTE: outgoing payload hardcodes `modelType:"event"`.
- **`train-webhook` Branch B** (training completion): sets `status:'ready'`,
  `training_completion_date`, optional `style_id_external` from body; sends
  email/WhatsApp; runs `autoProcessShowcase()` (edits the `__showcase__`
  gallery via `process-images` with service-role auth — **service-role calls
  skip user credit reservation**, verified in process-images `isFirstCall`).
- **styles columns that already exist** (see `src/integrations/supabase/types.ts`
  → styles Row): `before_image_urls[]`, `after_image_urls[]`,
  `google_before_urls[]`, `google_after_urls[]`, `father_style_id` (FK →
  styles.id, already in DB!), `import_start_date`, `import_completion_date`,
  `training_start_date`, `training_completion_date`, `upload_method`,
  `import_transfers_total/completed`, `total_images_to_import/imported`
  (currently never written), `training_sessions_count`, `error_details[]`.
- **Gaps**: Drive-imported styles have EMPTY `before/after_image_urls` (only
  local uploads write them). Local uploads never write `import_start/completion`
  dates. There is NO gallery row for a style's training material.
- **Admin UI home**: `src/pages/dashboard/admin/StyleDetailsSheet.tsx` (full
  per-style drawer, already shows Training data / Timeline / Diagnostics) and
  `src/pages/dashboard/admin/StylesManagement.tsx` (table). User-facing page:
  `src/pages/dashboard/StyleDetailsPage.tsx` (has 2-way `BeforeAfterSlider`,
  pairs via image_edits join on the showcase gallery; fallback pairs raw
  arrays by sorted index).
- **Helpers**: `formatDuration(ms)` exists in `src/lib/cullingEta.ts` (returns
  "2h 14m"). `getPreviewUrl/getThumbnailUrl` in `src/lib/imageUrls.ts` build
  derivative URLs — **derivatives do NOT exist for `styles/...` paths** (the
  compression pipeline only runs for galleries). Any viewer of training files
  must load the ORIGINAL URL with an onError fallback, and must render a
  placeholder card for RAW files (browsers can't decode CR2/NEF/ARW…).
- **process-images** requires unique `style_id_external` per style (collision
  guard added 2026-07-08); a style without a model can still ride the legacy
  `"1"` key — retrained styles get their own id at train time, no conflict.

## Architecture decisions

- **Source gallery per style** (req 2+3): on training completion, materialize
  the style's BEFORE set as a hidden system gallery (`galleries.is_system =
  true`, `name = '__style_source__'`, `user_id = style.user_id`), insert
  `gallery_images` rows pointing at the existing B2 originals (no copy), save
  `styles.source_gallery_id`, then dispatch `process-images`
  `{galleryId, styleIds:[styleId]}` with service-role auth (no user charge).
  The resulting `image_edits` rows ARE the "model's edit" side of the
  three-way compare, joined by `image_id`.
- **Photographer's edit pairing** (req 3): match BEFORE filename stem to AFTER
  filename stem (case-insensitive, extension stripped) across
  `before_image_urls`/`after_image_urls`. Unmatched images still render with
  an empty pane.
- **Filenames/types** (req 5-7): single source = the URL arrays. Fix the Drive
  gap by harvesting `body.file_mappings` in train-webhook Branch A into the
  arrays. Types classified by extension.
- **Retrain = clone row + train with parent dirs** (req 9+10): new styles row,
  `father_style_id = parent.id`, copy metadata + BEFORE urls (+ AFTER urls in
  same-material mode), then call `train-style` with `beforeDirs =
  ['styles/{parentUserId}/{parentId}/before/']` and afterDirs either the
  parent's after dir (mode A) or the NEW style's own after dir after uploading
  fresh files (mode B). No file copying in B2 — dirs are caller-controlled.

---

## T0 — Foundation (must land first, small)

**Migration** `supabase/migrations/<ts>_style_control_upgrade.sql`:
- `ALTER TABLE public.galleries ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;`
- `ALTER TABLE public.styles ADD COLUMN IF NOT EXISTS source_gallery_id uuid REFERENCES public.galleries(id) ON DELETE SET NULL;`
- `CREATE INDEX IF NOT EXISTS idx_styles_father ON public.styles(father_style_id) WHERE father_style_id IS NOT NULL;`

**New lib** `src/lib/styleFiles.ts` (+ unit tests `styleFiles.test.ts`):
- `RAW_EXTENSIONS` set: cr2 cr3 crw nef nrw arw srf sr2 raf dng orf rw2 pef
  srw raw rwl 3fr fff iiq x3f.
- `parseStyleFile(url) → { filename, ext, kind }` where kind ∈
  `'raw'|'jpeg'|'png'|'heic'|'tiff'|'webp'|'other'` (jpeg covers jpg/jpeg;
  heic covers heic/heif). Must handle URL-encoded names and query strings.
- `breakdownFiles(urls) → { total, byKind: Record<kind, number>, files: ParsedFile[] }`.
- `stemOf(filename)` — lowercased, extension stripped (last dot only).
- `pairByStem(beforeUrls, afterUrls) → Array<{stem, before?, after?}>` sorted
  numerically by stem.

**Extract upload helper** `src/lib/uploadStyleFiles.ts`:
- Move `uploadStyleFiles` out of `CreateStylePage.tsx` verbatim (signature
  `(files, userId, styleId, subDir, onProgress) → string[] /* base URLs */`),
  import it back in CreateStylePage. Zero behavior change. This is reused by
  the retrain dialog (T6).

**Acceptance**: build + tests green; migration applies on a clean Postgres;
CreateStylePage flow unchanged.

## T1 — Complete source metadata (backend truth for req 4-7)

Files: `supabase/functions/train-webhook/index.ts`,
`src/pages/dashboard/CreateStylePage.tsx`.

1. **Drive gap**: in train-webhook **Branch A** (`isGDTransfer`), parse
   `body.file_mappings` (defensively — log its shape once; it maps source
   files → destination B2 keys). Build full B2 URLs (`https://s3.us-east-005.backblazeb2.com/imagick/<key>`
   — same base as `src/lib/imageUrls.ts` B2_BASE) and **append** them to
   `before_image_urls` or `after_image_urls` according to
   `callback_args.transferType` (`style-before`/`style-after`). Dedup. Also
   set `total_images_imported = before.length + after.length` and
   `total_images_to_import` when known.
2. **Local uploads**: in CreateStylePage, stamp `import_start_date` when the
   upload loop starts and `import_completion_date` when both sets finish
   (before invoking train-style). Set `total_images_to_import` (files picked)
   and `total_images_imported` (successfully uploaded).
3. Do NOT touch the existing `import_transfers_*` counters.

**Acceptance**: create a style via local upload → row has both import dates +
totals; the arrays already worked. (Drive path verified by code review +
defensive parsing with logging; a wrong file_mappings shape must not break
the existing counter/training flow — wrap in try/catch.)

## T2 — Auto-edit the source collection on completion (req 2, enables 3)

Files: NEW `supabase/functions/_shared/style-source.ts`,
`supabase/functions/train-webhook/index.ts`,
NEW `supabase/functions/style-source-edit/index.ts` (+ `supabase/config.toml`
entry `verify_jwt = false`).

1. `_shared/style-source.ts` → `ensureStyleSourceGallery(admin, styleId)`:
   - Load style (need `user_id`, `before_image_urls`, `source_gallery_id`).
   - If `source_gallery_id` exists and the gallery exists → return it.
   - Else create gallery `{ user_id, name: '__style_source__', is_system: true,
     status: 'ready' }`, insert `gallery_images` rows from `before_image_urls`
     — only browser-renderable kinds (skip RAW: the engine + viewers read
     JPEG/PNG/WebP; RAW befores are listed in stats but not editable) — with
     `original_url`, `filename` (parsed from URL), `status:'ready'`. Batch
     inserts of 500. Save `styles.source_gallery_id`.
   - Idempotent: safe to call twice (upsert-ish by checking existing
     filenames).
2. `autoProcessStyleSource(admin, supabaseUrl, serviceKey, styleId)`:
   ensure gallery → collect image ids missing `image_edits` for this style →
   POST `process-images` `{galleryId, imageIds, styleIds:[styleId]}` with
   service-role Bearer (mirrors `autoProcessShowcase`, non-fatal).
3. Call it from train-webhook Branch B success, right after
   `autoProcessShowcase` (each in its own try/catch).
4. `style-source-edit` edge fn (admin-only: verify caller is admin via
   `user_roles`): body `{styleId}` → runs step 2 on demand. This backfills
   LEGACY styles and gives the admin a manual "Generate model edits" button.

**Guard**: `ensureStyleSourceGallery` must skip styles whose owner row is
missing and must never run for a style without `style_id_external`.

**Acceptance**: esbuild-clean; unit-test the pure parts if practical; after a
(simulated) webhook completion call, the style has `source_gallery_id`, the
gallery has N image rows, and a process-images dispatch was attempted.
System galleries must NOT appear in user gallery lists (see T7).

## T3 — Training gallery viewer with large lightbox (req 1)

Files: NEW `src/components/admin/StyleTrainingGalleryDialog.tsx`, wire from
`src/pages/dashboard/admin/StyleDetailsSheet.tsx` ("Open training gallery"
button in the Training data section).

- Near-fullscreen Dialog (`sm:max-w-[95vw] h-[92vh]`), header = style name +
  counts. Tabs: **Before (N)** / **After (N)** (+ **Compare** added by T4).
- Responsive thumbnail grid (CSS grid, ~180px cells, virtualization not
  required below 1k items — lazy `loading="lazy"` is enough).
- Each cell: image (ORIGINAL URL — no derivative exists for `styles/...`
  paths; `onError` → hide img and show the file-card), filename caption,
  type badge (from `styleFiles.ts`). RAW files always render as a file-card
  (icon + extension + filename), never as `<img>`.
- Click → lightbox layer inside the dialog: large image (`object-contain`,
  max h-full), ←/→ + keyboard nav, Esc back to grid, filename + index
  ("34/120"), "Open original" external link.
- Data source: `before_image_urls` / `after_image_urls` from the style row
  (already loaded in the sheet).

**Acceptance**: keyboard nav works; RAW never 404-flashes; 500-image set
scrolls smoothly; build green.

## T4 — Three-way compare (req 3) — depends on T2 + T3

Files: NEW `src/components/admin/TriCompare.tsx`, integrate as the
**Compare** tab of `StyleTrainingGalleryDialog`.

- Data assembly (in the dialog): rows = `pairByStem(before, after)` from
  `styleFiles.ts`; model edits fetched once:
  `image_edits.select('image_id, edited_url').eq('gallery_id', style.source_gallery_id).eq('style_id', style.id)`
  joined to `gallery_images(id, filename)` → map by `stemOf(filename)`.
  Each row: `{ stem, source?, photographerEdit?, modelEdit? }`.
- UI: left = scrollable pair list (stem + availability dots for the 3
  sources); right = viewer with two modes:
  - **Side-by-side**: up to 3 panes (Source / Photographer / Model), missing
    pane renders "not available".
  - **Slider**: reuse `src/components/styles/BeforeAfterSlider.tsx` with two
    pickers choosing which two of the three to compare (default Photographer
    vs Model — that's the money shot).
- Empty state when `source_gallery_id` is null: explain + "Generate model
  edits" button → invoke `style-source-edit` (T2), then poll/refetch.

**Acceptance**: styles with full data show 3 panes; legacy styles degrade
gracefully; RAW sources show the file-card in their pane.

## T5 — Stats panel: counts, types, durations (req 4-8)

Files: `src/pages/dashboard/admin/StyleDetailsSheet.tsx` (Training data +
Timeline sections), reuse `styleFiles.ts` + `formatDuration` from
`src/lib/cullingEta.ts`.

- **Counts**: "Before: N files · After: M files" (from the arrays; fall back
  to `total_images_imported` when arrays are empty).
- **Type breakdown** per side: chips like `RAW 24 (CR2)` `JPG 96` `HEIC 3` —
  from `breakdownFiles`. Expandable full file list (scrollable, mono font):
  `IMG_1234.CR2 — RAW`, with dir=auto.
- **Durations** (both in the Timeline section, using `formatDuration`):
  - Upload: `import_completion_date − import_start_date` → "Upload took 42 min".
  - Training: `training_completion_date − training_start_date` → "Training
    took 5h 12m".
  - Missing endpoints → "—". An in-flight training shows a live elapsed value.
- Also surface the same two durations as compact chips on the user-facing
  `StyleDetailsPage` hero (it currently computes minutes inline — replace
  with `formatDuration`).

**Acceptance**: correct math across day boundaries; no NaN for legacy rows;
build green.

## T6 — Retrain flows (req 9 + 10)

Files: NEW `src/components/admin/RetrainStyleDialog.tsx`, wire from
`StyleDetailsSheet` (primary button "Retrain…") and optionally from the
styles table row menu. Uses `uploadStyleFiles` (T0) + `train-style`.

**Dialog** — two explicit modes (radio):
- **A. Same material** — retrain on the parent's exact BEFORE+AFTER dirs.
- **B. New AFTER set** — same BEFORE, upload a fresh AFTER set (the "same
  shoot, different look" case). Shows a dropzone (≥5 raster images, same rule
  as CreateStylePage: `f.type.startsWith("image/")`), with per-file progress.

Common fields: **new style name** (required; default `"<parent name> v<n+1>"`
where n = count of existing children+1), confirmation copy stating a NEW
style will be created and trained (costs training compute), and that the
parent stays untouched.

**Flow** (client-side, mirroring CreateStylePage):
1. Insert new styles row: copy from parent `description, category,
   associated_tags, upload_method, google_before_urls, google_before_metadata,
   before_image_urls` (+ in mode A also `after_image_urls`,
   `google_after_urls/metadata`); set `name`, `user_id = parent.user_id`,
   `visibility:'private'`, `is_preset:false`, `father_style_id: parent.id`,
   `status: mode A ? 'training' : 'uploading'`,
   `training_sessions_count: (parent.training_sessions_count ?? 0) + 1`.
2. Mode B: `uploadStyleFiles(files, parent.user_id, newStyleId, 'after')` →
   write `after_image_urls` + `import_start/completion_date` on the new row.
3. Invoke `train-style` `{ styleId: newStyleId, modelType: parent.category ||
   'event', beforeDirs: ['styles/${parent.user_id}/${parent.id}/before/'],
   afterDirs: mode A ? ['styles/${parent.user_id}/${parent.id}/after/']
                     : ['styles/${parent.user_id}/${newStyleId}/after/'] }`.
   (train-style accepts arbitrary dirs — verified.)
4. On failure of step 3 → mark the new row `status:'error'`,
   `error_details:['Retrain dispatch failed: …']`, keep it visible.
5. Success toast + navigate/open the NEW style in the sheet.

**Lineage UI** (both `StyleDetailsSheet` + `StyleDetailsPage`):
- If `father_style_id`: badge "Retrained from <parent name>" → click opens
  the parent (sheet: swap `detailStyle`; page: navigate).
- Children section: `styles.select('id,name,status,created_at').eq('father_style_id', id)`
  → list with links. Show training # (`training_sessions_count`).

**Acceptance**: mode A creates+trains a child pointing at parent dirs with
no uploads; mode B uploads then trains; both record lineage both ways;
cancel/failed dispatch never leaves a phantom "training" row.

## T7 — Integration & polish (last)

- **Hide system galleries everywhere users see galleries**: grep every
  `.from("galleries")` list query in `src/` (GalleriesPage, DashboardHome
  recent collections, admin galleries/KPI counts, storage usage if relevant)
  and add `.eq('is_system', false)` / `.neq(...)` where appropriate. The admin
  may keep an explicit "system" filter. Also exclude system galleries from
  `billing-cron` archival and from `admin_kpi_overview` if it counts galleries.
- Ensure `pipeline-watchdog`/culling paths ignore system galleries (they have
  no culling; nothing sets culling_status on them — verify).
- Regenerate/extend local Supabase types or cast narrowly (`is_system`,
  `source_gallery_id` won't be in generated types until after deploy — use
  `as any` casts consistent with the codebase style).
- Full verification: `npx tsc --noEmit`, `npm test`, `npm run build`, esbuild
  parse-check for every touched edge function, migration applied on a local
  Postgres 16 (pattern: scratchpad pgtest suite from July 2026 sessions).

## Risks / notes for implementers

- `file_mappings` exact shape is unverified — parse defensively, log, never
  throw (Branch A also drives the training kickoff counter).
- `styles/...` B2 objects have NO thumbnail/compressed derivatives — always
  render originals with onError fallback; RAW = file-card, never `<img>`.
- `train-style` hardcodes `modelType:"event"` in the outgoing payload — do
  NOT rely on modelType changing engine behavior; pass it anyway for
  forward-compat.
- Source-gallery editing consumes the external engine but NOT user credits
  (service-role process-images calls skip reservation) — still, don't
  auto-run it for styles with >500 befores without an admin click.
- `image-upload` enforces the OWNER's storage limit — mode-B retrain uploads
  count against the style owner's storage; surface the failure toast clearly.
- Keep all admin UI inside the existing LIGHTROOM design system (glass-card,
  aura-microlabel, folio, rounded-[--radius]) — no new fonts/colors.
