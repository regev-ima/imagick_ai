# DELIVER — the client collection flow

> How a photographer turns a finished gallery into the thing a client actually
> opens: a curated, branded, shareable **collection**. This is the functional
> spec the PRISM rollout named as a flagship ("Dashboard, Collections, **Client
> Gallery**"). It is grounded in the real schema and components — every column,
> RPC and file referenced below exists today unless marked **NEW**.

**Status:** design / decision-grade spec. No code shipped by this doc.

---

## 0. The one decision

Today a gallery is **born public and shows everything**. The moment a gallery
row is inserted, a trigger fills `galleries.client_link`
(`20260202195525_…sql:250`), and `get_client_gallery_images` returns every
image whose `status != 'deleted'`. There is no "which of these does the client
actually get" step, and no "is this even ready to be seen" gate.

DELIVER adds exactly two missing ideas and nothing else:

1. **A selection** — each image is either *in the client collection* or *not*.
   The photographer composes the collection by adding/removing frames; the link
   shows only what was added.
2. **A publish gate** — the link is dark until the photographer publishes, and
   re-publishing pushes an updated selection. "Has a link" stops meaning "is
   live."

Everything else in this doc is the experience built on those two ideas. The
photographer's mental model stays the one the founder stated: *choose the
photos, name it, send it.*

---

## 1. Today's model and the three gaps

What already works (keep all of it):

- Upload → AI culling (`culling_score`, `culling_label`, `similarity_group_1..3`)
  → optional face clustering (`face_clusters` / `face_detections.face_vector`).
- A real editor (`GalleryEditorPage.tsx`) with multi-select, `is_liked`,
  `is_hero`, soft-delete/trash, rating/label/tag filters, similarity grouping,
  and a "Faces" catalog mode.
- A real publish surface (`ShareGalleryModal.tsx`): six templates, dark mode,
  download toggle, watermark flag, PBKDF2 password + 24h sessions, email
  invites (`gallery_invites`), short links (`/g/:shortId`).
- A real client page (`ClientGalleryPage.tsx`): six templates, category nav
  from `culling_label`, **face self-search ("find your photos")**, per-device
  likes, per-photo feedback, downloads, view tracking.

The three gaps DELIVER closes:

| # | Gap | Symptom today | Root cause |
|---|-----|---------------|------------|
| **G1** | No curation set | Client sees *every* non-deleted frame — rejects, near-dupes, unedited RAWs included. The only way to hide a frame is to soft-delete it, which also removes it from the photographer's own workspace. | `get_client_gallery_images` filters on `status` only; no per-image "delivered" flag. |
| **G2** | No publish gate | Anyone with the auto-minted `client_link` can open a half-processed gallery. There is no "draft → live" boundary. | `client_link` is set by trigger at insert; no `published` state. |
| **G3** | Grouping is accidental | The client gets category pills if culling labels happen to exist, and face search if clusters happen to exist. The photographer never *chooses* how the collection reads. | No per-collection presentation settings; client UI infers from data. |

---

## 2. Vocabulary (so the UI and the schema agree)

- **Gallery / Workspace** — everything uploaded for a shoot: RAWs, edits,
  rejects, dupes, every face. The photographer's private editing surface. This
  is `galleries` + `gallery_images` exactly as they are.
- **Collection (the delivery)** — the curated, named, branded subset the client
  opens. In v1 a gallery has **one** collection (1:1); the schema is shaped so
  v3 can host several per gallery without a rewrite.
- **Selection** — the set of images flagged into the collection. The verb the
  founder used: *connect* a photo in, *pull* a photo out.
- **Presentation** — how the collection reads to the client: layout
  (`template`), grouping mode, sectioning, hero.
- **Access** — link, optional password, expiry, download, watermark.

---

## 3. The photographer's spine (end to end)

Seven moves, in order. The first four already exist; DELIVER adds 5–7 and a
selection layer over 4.

```
1 CREATE     name the shoot, choose styles + culling   (CreateGalleryPage)
2 PROCESS    upload → cull → (optional) face cluster    (existing pipeline)
3 EDIT       cull, rate, like, dedupe, retouch          (GalleryEditorPage)
─────────────────────────────────────────────────────────────────────────
4 SELECT     compose the client collection  ← NEW the heart   (§4)
5 PRESENT    template, grouping, sections, hero          ← NEW (§5,§6)
6 ACCESS     link, password, expiry, download, watermark      (ShareModal+)
7 PUBLISH    go live, share, then watch                  ← NEW gate (§7)
```

Crucially, **identity is never required** to do any of this. The photographer
names a *collection*, not a *person*. Who each guest is gets resolved later, by
the guest, at the link — see §6. This is the founder's "you don't identify the
client from the start": creation is about photos, not people.

---

## 4. The curation surface — the heart of the feature

This is what the founder flagged as most important: *which images enter the
client link, and the act of adding/removing them.* It lives as a mode inside
the existing editor, not a separate screen, so culling decisions and delivery
decisions share one grid.

### 4.1 Delivery mode

A segmented control at the top of `GalleryEditorPage` toggles the grid between:

- **Workspace** (today's view — all non-deleted images), and
- **Delivery** — the same grid, now expressing one bit per image: *in the
  collection* or *not*. Out-of-collection frames dim to ~40% with a hollow
  check; in-collection frames show a solid accent check and a quiet ribbon.

A persistent footer bar reads: **“128 of 412 photos in this collection · Preview
as client · Publish.”** The count is the product. Selection is the existing
multi-select (click, shift-range, checkbox) repurposed: the bulk action bar
gains **Add to collection** / **Remove from collection** instead of only Trash.

> Why a mode and not a new flag-per-click: photographers already think in
> multi-select + bulk in this grid. Reusing it means "select my 5-star ceremony
> shots → Add" is two gestures, and the muscle memory is already there.

### 4.2 Smart fill (the first draft of the selection)

An empty selection is hostile when there are 400 frames. So Delivery mode opens
with a one-tap **starting point**, derived from data we already compute:

- **Keepers** — `culling_score` ≥ threshold, minus near-dupes (keep the top of
  each `similarity_group`). This is the default and mirrors the existing
  DownloadGalleryModal "Top picks (≥4★)" logic.
- **My likes** — every `is_liked` frame.
- **Everything edited** — every image with an `edited_url`.
- **Everything** — for photographers who cull entirely on the client side.

Smart fill only *seeds* the selection; the photographer then adds/removes by
hand. Aura states it in one line: *"I put your 128 keepers in. Add or pull any."*

### 4.3 Pull-outs without losing the frame (fixes G1)

The decisive change from today: **removing a photo from the collection is not
deleting it.** The frame stays in the workspace, in trash-free state, fully
recoverable, and still counts toward the photographer's own picks. A separate
"Not in this collection" filter chip lets them review everything they left out.
Soft-delete (`status='deleted'`) remains a different, heavier action for "I
never want to see this again."

### 4.4 Preview as client

A **Preview as client** button renders the *exact* `ClientGalleryPage`
templates over the current selection + presentation settings, in a framed
device view, without publishing. It answers the question the photographer
actually has — *what will they see?* — before anyone gets the link. This also
becomes the natural home to sanity-check grouping (§5) and the cover.

### 4.5 What the data needs (minimal, additive)

`gallery_images` gains one nullable column (back-compat: NULL ⇒ treat as the
old "everything" behaviour until first publish):

```sql
-- NEW
ALTER TABLE gallery_images
  ADD COLUMN in_collection boolean;          -- true = delivered to client
  ADD COLUMN collection_sort integer;        -- client-facing order, distinct
                                             -- from editor sort_order
```

`get_client_gallery_images` adds one predicate and orders by the new column:

```sql
-- CHANGED: only deliver the selection, and only once published (see §7)
WHERE gi.gallery_id = p_gallery_id
  AND gi.status != 'deleted'
  AND COALESCE(gi.in_collection, true) = true   -- NEW
  AND g.published_at IS NOT NULL                 -- NEW (§7)
  AND g.client_link IS NOT NULL
  AND ( …existing password/session gate… )
ORDER BY COALESCE(gi.collection_sort, gi.sort_order) ASC;
```

`COALESCE(…, true)` means existing live galleries don't go dark on migration day
— they behave exactly as before until their owner opens Delivery mode once.

---

## 5. Presentation — what functions the client collection has

The photographer chooses, per collection, **how it reads**. This is the
"grouping or not grouping" question, made an explicit decision instead of an
accident of the data.

### 5.1 Grouping mode (one choice, four options)

| Mode | What the client sees | Built on |
|------|----------------------|----------|
| **Flat** | One curated stream in `collection_sort` order. Calm, gallery-wall feel. | Nothing new. |
| **By section** | Photographer-named chapters: "Getting ready · Ceremony · Party". | NEW `collection_sections` (§5.2). |
| **By category** | Pills from `culling_label` (today's `CategoryNav`), but only labels the photographer keeps. | Existing, made opt-in. |
| **By person** | "Find your photos" face self-search front-and-center (§6). | Existing `face_clusters`. |

Modes compose: a wedding can be **By section** *and* expose **By person** as a
secondary "find yourself" affordance. The photographer toggles each.

### 5.2 Sections (manual moments)

Sections are the one genuinely new presentation primitive, because shoots have a
narrative the AI can't reliably name. In Delivery mode the photographer can drag
a divider into the selection and title it; images above it belong to that
section until the next divider.

```sql
-- NEW
CREATE TABLE collection_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE gallery_images ADD COLUMN section_id uuid REFERENCES collection_sections(id);
```

Sections are optional; with none defined the collection is Flat.

### 5.3 Defaults per shoot type (so most people never touch this)

`CreateGalleryPage` already captures `galleryType`. Use it to pre-pick the mode
so the default is right ~80% of the time:

- **Wedding / Event** → By section (+ By person available)
- **Portrait / Newborn / Family** → Flat (small, narrative-light)
- **Commercial / Real estate / Food** → By category
- **Sports / Fashion shows** → By person (everyone wants *their* athlete/look)

### 5.4 Cover & branding

The collection cover reuses `is_hero` / `hero_image_url`. PRISM's
`--dynamic-primary` lets the cover photo tint the client page's chrome, so the
collection feels keyed to *these* photos. Studio logo + name come from the
existing branding settings; watermark (§7) finally gets rendered.

---

## 6. "You don't identify the client from the start" — anonymous self-ID

This is the conceptual centre of the founder's note, and the platform already
has the machinery; DELIVER just makes it the headline of the right collections.

### 6.1 The principle

The photographer composes a collection of *photos*, never a roster of *people*.
No "this folder is Dana's, this is Yossi's." Identity is resolved **at view
time, by the viewer**, with zero accounts and zero pre-tagging:

1. Client opens the link (optionally one shared password — still no identity).
2. If **By person** is on, the page leads with **"Find your photos"** — a row of
   anonymous face thumbnails (`face_clusters.representative_bbox` crops). These
   are "Person 1…N", never named.
3. The client taps the face they recognize as themselves (or their kid, their
   athlete). The grid filters to that cluster via `face_detections.cluster_id`.
   That tap *is* the identification — performed by the only person who reliably
   knows the answer, and stored nowhere as PII.

So a single link serves a 200-guest wedding where each guest privately pulls
their own ~30 frames out of the 800, and the photographer never built a single
per-guest gallery. That is the leverage.

### 6.2 What the photographer optionally curates here

- **Spotlight clusters** — pin the couple / the key subjects to the front of
  "Find your photos"; leave the long tail of guests below. (NEW: a
  `face_clusters.is_spotlit` flag, photographer-set in the editor's Faces mode.)
- **Hide a cluster** — drop the catering crew / passers-by from self-search
  without removing those frames from the collection. (NEW: `is_hidden`.)
- **Selection still wins** — face search only ever surfaces frames that are
  `in_collection`. A guest can never tap their face into a reject.

### 6.3 Optional named delivery (when identity *is* known)

For the case where the photographer *does* know the recipient (a paid client,
not a guest), the existing `gallery_invites` (email + `client_name`) becomes a
soft personalization layer: the link can greet "Hi Dana" and pre-apply her face
cluster if she's been spotlit — without changing that the underlying collection
is still anonymous-by-default. Identity is an *enhancement*, never a
*prerequisite*.

---

## 7. Publish & share (the gate, the link, the access)

`ShareGalleryModal` becomes a **Publish sheet** with a real state machine.

### 7.1 The publish gate (fixes G2)

```sql
-- NEW on galleries
ALTER TABLE galleries
  ADD COLUMN published_at timestamptz,       -- NULL = draft/dark
  ADD COLUMN last_published_at timestamptz;  -- for "you have unsent changes"
```

States: **Draft** (link resolves to a friendly "not ready yet" page) →
**Published** (live) → edits create **Unpublished changes** → **Re-publish**
pushes the new selection. The link/short-link stay stable across re-publishes,
so a shared URL never breaks. `get_public_gallery` and
`get_client_gallery_images` both require `published_at IS NOT NULL`.

### 7.2 The sheet, consolidated

One sheet, three calm groups (reusing every existing control):

- **Presentation** — template picker (the six, with `TemplateMiniPreview`),
  grouping mode (§5.1), dark mode, cover.
- **Access** — link + short link (copy), password (existing PBKDF2 edge fn),
  **expiry** (now *enforced*: `get_public_gallery` checks `expiry_date`),
  download toggle, **watermark** (now *rendered* in the templates over
  `original_url` previews — the flag has existed unused since day one).
- **Reach** — email invites (`gallery_invites`), and the post-publish
  analytics already collected in `client_interactions`
  (views / likes / feedback / downloads).

### 7.3 Closing the two stored-but-dead flags

DELIVER is the moment to make `watermark_enabled` and `expiry_date` real, since
both only matter at the client boundary this feature defines. Watermark: a CSS/
canvas overlay in `GalleryLightbox` + template tiles, studio name or logo,
diagonal, low-opacity, skipped on download only when `download_enabled`. Expiry:
a single `AND (expiry_date IS NULL OR expiry_date > now())` in
`get_public_gallery`, plus an "expired" client page.

---

## 8. Client experience deltas (mostly free)

The client page already renders templates, categories and face search. DELIVER's
client-side changes are small because the heavy lifting is photographer-side:

- Honour **grouping mode** (flat / sections / categories / people) from the new
  settings instead of inferring from data presence.
- Render **sections** as titled bands.
- Lead with **Find your photos** when By-person is on; respect spotlight / hidden
  clusters.
- Show **watermark**; enforce **expiry**; a friendly **draft/expired** page.
- Everything else (likes, feedback, downloads, lightbox, tracking) is unchanged.

---

## 9. Rollout

Vertical slices, each shippable and each useful on its own.

- **v1 — the gate + the selection (the heart).** `in_collection` +
  `collection_sort`, Delivery mode with smart-fill and bulk add/remove,
  "Preview as client", `published_at` gate, RPC predicates. Grouping stays
  Flat/Category (today's behaviour). This alone closes G1 + G2 and delivers the
  founder's core ask. No client redesign required.
- **v2 — presentation.** Grouping-mode picker, `collection_sections`, per-type
  defaults, spotlight/hidden clusters, watermark + expiry made real. Closes G3.
- **v3 — many collections per gallery.** Promote the selection to a first-class
  `collections` table (+ `collection_images` join), so one shoot can ship
  "Highlights", "Full set", "Ceremony", each with its own link/template/access.
  v1's columns migrate cleanly into the join.

### Migration safety

- `in_collection` defaults NULL and is read as `true` via `COALESCE`, so on the
  day v1 ships, **no existing live gallery changes what it shows.**
- The publish gate is the one behaviour change: pre-existing galleries get
  `published_at` backfilled to `created_at` in the same migration, so nothing
  that is live today goes dark.

---

## 10. Open product decisions

1. **One collection or many in v1?** This spec recommends **one per gallery**
   (1:1), schema-shaped for many later. Many-per-gallery (Highlights vs Full) is
   real demand but triples the surface; defer to v3 unless it's a launch need.
2. **Default selection on a brand-new gallery:** *empty* (deliberate curation,
   safer) vs *all keepers pre-filled* (faster, matches today's "everything"
   feel). Recommend **keepers pre-filled** via smart-fill, because the founder's
   framing is "choose your photos," not "build from zero," and an accidental
   empty publish is worse than an over-full one.
3. **Does removing the last category/section collapse to Flat automatically?**
   Recommend yes — never show an empty grouping chrome.
4. **Watermark on downloads:** never (downloads are the deliverable) vs always
   unless a paid/unlocked flag. Recommend **watermark preview, clean download**
   gated by `download_enabled`, matching client expectations.

---

## Appendix — schema change summary

```sql
-- gallery_images
ADD COLUMN in_collection   boolean;     -- the selection (G1)
ADD COLUMN collection_sort integer;     -- client-facing order
ADD COLUMN section_id      uuid;        -- → collection_sections (v2)

-- galleries
ADD COLUMN published_at      timestamptz;  -- the publish gate (G2)
ADD COLUMN last_published_at  timestamptz;
ADD COLUMN grouping_mode      text;         -- flat|section|category|person (v2)

-- face_clusters
ADD COLUMN is_spotlit boolean;          -- pin to front of "find your photos"
ADD COLUMN is_hidden  boolean;          -- drop from self-search

-- NEW table (v2)
collection_sections(id, gallery_id, title, sort_order)

-- RPC edits
get_client_gallery_images: + COALESCE(in_collection,true) + published_at gate
                           + ORDER BY collection_sort
get_public_gallery:        + published_at gate + expiry_date enforcement
```

All names align with the existing convention (`client_*`, `*_enabled`,
`*_at`); no existing column is renamed or dropped.
</content>
</invoke>
