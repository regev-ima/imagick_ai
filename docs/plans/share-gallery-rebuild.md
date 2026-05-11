# Imagick.ai — Share Gallery Rebuild

> **Working brief.** Photographers in Israel and beyond should look at Imagick's
> client gallery and feel "this is *mine*, this is *modern*, this is *what my
> client deserves*" — not "this is another Pixieset." This document is the
> product plan that gets us there.

---

## TL;DR (Hebrew)

המטרה: להפוך את הגלריה הציבורית של Imagick.ai מ"עוד גלריית-לקוחות" לפיצ'ר שגורם
לצלמים *להחליף פלטפורמה*. אנחנו פותרים את שלושת הכאבים הכי גדולים שלהם:

1. **הלקוח לא בוחר תמונות** (או בוחר 200 מתוך 800) → AI מציע 60 וזוג רק מאשר/מחליף.
2. **המשפחה רוצה למצוא את עצמה** → זיהוי פנים מבוסס סלפי לאורחים.
3. **הלינק נראה גנרי, לא ממותג** → דומיין משלך, צבע משלך, לוגו משלך, ללא "Powered by".

הזווית הישראלית: **WhatsApp ראשון** (לא אימייל), RTL מלא, וגלריית-משנה
"שמרני/חילוני" לחתונות בעלות פיצול דתי-חילוני.

---

## 1. Vision

> *"The moment your client opens the gallery feels like opening a wedding album,
> not like opening a Dropbox folder."*

Imagick's share-gallery becomes the **delivery moment** of the photographer's
brand — cinematic, branded, and emotional — while solving the real workflow
pain (selection paralysis, family discovery, organic sharing) that competitors
have not fixed.

## 2. North Star Metric

**Client-Selection Completion Rate within 7 days** of gallery delivery.

This single metric proves the gallery doesn't just look good — it *works*. It
unblocks the photographer's album-design business, drives print sales, and
predicts referral. Today the industry baseline is ~30-40% within 30 days (forum
data); we target **>75% within 7 days** via AI pre-curation.

Secondary metrics:
- Share-rate (% of clients who share the gallery link)
- Mobile session time
- Photographer NPS at first-gallery delivery

## 3. Personas & Jobs-To-Be-Done

### Persona A — The Photographer ("Daniel", Tel Aviv wedding pro)
- Shoots 35-50 weddings/year, delivers 600-1200 images per gallery
- Wants: faster album selection, premium client experience, no extra software
- Pays for: "stops chasing my clients for their picks"

### Persona B — The Couple ("Maya & Dani")
- Open gallery 30 min after delivery; first view on phone
- Want: relive the day, share with family, decide on album photos *together*
- Frustration today: 800 images on phone is paralyzing

### Persona C — The Family/Guest ("Grandma Rivka")
- Wants: "where am I in these photos?"
- Has zero patience for scrolling 800 images
- Solution: selfie face-search at QR

### Persona D — The Vendor (Planner, Venue, Florist)
- Wants: their own scoped link to download a handful of shots for portfolio
- Today: emails the photographer, slow back-and-forth

## 4. Competitive Positioning

| Axis | Pixieset | Pic-Time | CloudSpot | Zenfolio | **Imagick** |
|---|---|---|---|---|---|
| Design quality | Clean/plain | Excellent (magazine, music) | Clean | Dated | **Pic-Time-grade at Pixieset price** |
| AI culling | None | Limited | Smart Selects | PhotoRefine.ai | **Built-in, default** |
| Face search (guest) | None | Limited | None | Sports only | **Selfie-find for weddings** |
| Selection workflow | Manual | Manual | Manual | Manual | **AI pre-curated approve/swap** |
| WhatsApp delivery | No | No | No | No | **Default in Israel** |
| White-label | Paid tier | Paid tier | Paid tier | Paid tier | **Day-one on all tiers** |
| RTL/Hebrew | Weak | Weak | None | None | **First-class** |

**Strategic claim:** "Pic-Time-grade design + Zenfolio-grade AI + WhatsApp-first
delivery + face-recognition for guests, at Pixieset prices, fully white-label."

## 5. Product Principles

1. **Mobile is primary, desktop is secondary** — 70-85% of opens are on phone.
2. **No dead-end states** — the first thing a client sees is a 60-second
   cinematic intro, not a wall of 800 thumbnails.
3. **Selection is reduction, not creation** — AI proposes; client edits.
4. **Sharing is the unit of growth** — every photo, every gallery, every guest
   view should have a beautiful, single-tap share path.
5. **Privacy is opinionated** — every gallery has an audit trail and a kill
   switch by default.
6. **Brand belongs to the photographer** — no Imagick chrome on client surfaces.
7. **WhatsApp first in Israel** — emails are fallback, not primary.

## 6. Feature Pillars

### Pillar 1 — "Cinema" first impression
A 60-90s auto-slideshow that plays on first gallery open: hero reel of the
top-rated 20-30 images, soft music (optional), then transitions to the grid.
Skippable but default-on. Generated automatically from AI ratings.

### Pillar 2 — Branded gallery (white-label by default)
Photographer chooses logo, primary color, accent color, font pairing,
optional custom domain. Applied across the public gallery, password screen,
emails, WhatsApp share previews, and OG meta. Zero "Powered by Imagick"
on client-facing pages on any tier.

### Pillar 3 — AI-curated selection workflow
For album work, photographer enables "Selection Mode" with a target count
(e.g., 60). Imagick uses AI ratings + face-coverage + scene diversity to
pre-select 60 images. Client sees the 60 with reasoning ("brightest smile",
"all key family combos covered") and can swap individual images. Multi-user
voting mode for couples & family.

### Pillar 4 — Guest face-search & per-guest share cards
Guests open the gallery, optionally take a selfie, and get a personalized
sub-album of photos they appear in. Each guest gets a personalized share card
("Sara's 23 photos from Maya & Dani's wedding") with thumbnail collage and
single-tap share to WhatsApp/Instagram.

### Pillar 5 — WhatsApp-first delivery
Every "share" CTA defaults to WhatsApp deeplink (`wa.me`) in Israel. Gallery-
ready notification, selection reminder, and per-image share all flow through
WhatsApp. Email remains as fallback.

### Pillar 6 — Photographer feedback loop ("Insights")
Replace the stats tab with an Insights view that shows: per-photo emotional
heatmap (views × dwell × favorites), geo + device breakdown, who-viewed-when
audit log, and a "weekly pulse" digest summary delivered via WhatsApp/email.

### Pillar 7 — Privacy & kill switch
Per-link expiry, email gate option, password gate, optional watermark, vendor-
scoped permissions, **kill switch** (one tap revokes the leaked link and re-
issues a new one to all legitimate viewers).

### Pillar 8 — Religious/secular dual gallery (Israel-specific)
For Israeli weddings with religious/secular family splits, the photographer can
tag certain photos as "modest" and a second "family-safe" gallery view is
generated automatically — same gallery, different curation.

## 7. User Flows (Happy Paths)

### Flow A — Photographer delivers a gallery
1. Photographer finishes culling in editor.
2. Clicks **Share** → opens redesigned ShareGalleryModal.
3. **Design** tab: picks template, brand color (auto-extracted from logo), font, intro mode (Cinema on/off).
4. **Privacy** tab: sets password, expiry, email gate.
5. **Selection** tab (new): toggles "Album Selection Mode" on, sets target count (60), reviews the AI's pre-selection, hits "Send."
6. **Share** tab (new): paste recipient phone numbers → WhatsApp deeplinks open one at a time, photographer hits Send in WhatsApp for each.
7. Each client gets a personalized WhatsApp message with the gallery link + intro photo.

### Flow B — Client opens the gallery
1. Tap link in WhatsApp → opens `app.<photographer-domain>` or `app.imagick.ai/g/abc123`.
2. **First-open Cinema mode**: 75s slideshow with music, hero shots staggered.
3. After slideshow OR on Skip: lands on grid view, photographer's brand, photographer's logo top-left.
4. If "Selection Mode" is on: banner says *"Maya, your photographer pre-selected 60 photos for your album. Tap to review."*
5. Selection screen: 60 photos in a swipeable card stack. Tap "swap" to compare against the full gallery; pick a replacement; cap is enforced (can't exceed 60).
6. When done, tap "Send to photographer" → confirmation card → option to share gallery to family via WhatsApp.

### Flow C — Family member finds themselves
1. Guest opens gallery link shared by the couple.
2. Lands on grid; sticky banner: *"Find your photos — take a selfie."*
3. Tap selfie → camera opens → snap → face-search runs.
4. Personal sub-album appears: *"Hi! We found you in 23 photos."*
5. Tap "Share my photos" → personalized share card with thumbnail collage → opens WhatsApp share sheet.

### Flow D — Photographer reviews insights
1. From dashboard, taps gallery → **Insights** tab.
2. Sees a heatmap of every photo, sorted by emotional engagement.
3. Top of page: "Your couple chose 58 of 60 suggested photos. Selection complete ✅"
4. Below: dwell-time heatmap, per-guest face-search activity, geo breakdown.

## 8. Information Architecture

### Existing tables (keep)
- `galleries`, `gallery_images`, `gallery_invites`, `gallery_sessions`,
  `client_interactions`, `face_clusters`, `face_detections`

### New columns on `galleries`
- `brand_logo_url TEXT` — photographer's logo for this gallery
- `brand_primary_color TEXT` — hex, e.g. `#FF1493`
- `brand_accent_color TEXT` — hex
- `brand_font_pair TEXT` — slug, e.g. `playfair-inter`
- `custom_domain TEXT` — fully qualified, e.g. `gallery.danielnotcake.com`
- `intro_mode TEXT` — `none` | `cinema` (default `cinema` when ≥20 ready images)
- `intro_music_url TEXT` — optional, photographer-uploaded MP3
- `selection_mode_enabled BOOLEAN` — default false
- `selection_target_count INTEGER` — default 60
- `email_gate_enabled BOOLEAN` — default false
- `dual_gallery_mode TEXT` — `off` | `religious_secular` (default `off`)
- `revoked_at TIMESTAMPTZ` — when kill switch was pressed
- `share_secret TEXT` — random nonce in URL; rotates on kill switch

### New columns on `gallery_images`
- `is_modest BOOLEAN` — default false; powers dual-gallery filter
- `view_count INTEGER` — denormalized for heatmap
- `dwell_seconds_sum INTEGER` — denormalized for heatmap
- `client_favorite_count INTEGER` — denormalized for heatmap
- `is_ai_suggested BOOLEAN` — default false; powers selection mode

### New tables

#### `gallery_brand_assets`
Photographer's reusable brand presets (logo + colors + fonts) that can be
applied to multiple galleries.

```
id UUID PK
user_id UUID FK auth.users
name TEXT — "Default brand"
logo_url TEXT
primary_color TEXT
accent_color TEXT
font_pair TEXT
created_at, updated_at
```

#### `gallery_selections`
Persistent record of what each client has chosen. Replaces ad-hoc client likes.

```
id UUID PK
gallery_id UUID FK galleries
image_id UUID FK gallery_images
client_email TEXT — from invite or session
client_name TEXT
selected BOOLEAN — true = include in album, false = swapped out
note TEXT — optional client note per image
created_at, updated_at
UNIQUE(gallery_id, image_id, client_email)
```

#### `gallery_share_events`
Tracks WhatsApp/email/copy-link share actions per image & per gallery for the
viral mechanic.

```
id UUID PK
gallery_id UUID FK
image_id UUID FK gallery_images (nullable; null = whole-gallery share)
channel TEXT — `whatsapp` | `email` | `copy` | `instagram`
shared_by_session_token TEXT (nullable)
created_at
```

#### `gallery_audit_log`
Every meaningful event: view, login, password failure, share, selection
submit, kill-switch press. Powers Insights tab and forensics.

```
id UUID PK
gallery_id UUID FK
event_type TEXT
ip_address TEXT
user_agent TEXT
country_code TEXT
session_token TEXT
metadata JSONB
created_at
```

#### `gallery_vendor_links`
Vendor-scoped sub-links with their own permissions (download yes, favorite no,
limited to a tag like "ceremony").

```
id UUID PK
gallery_id UUID FK
vendor_name TEXT — "Sara the Planner"
vendor_email TEXT
scope_filter JSONB — { tags: ["ceremony"], download: true, hide_modest: false }
share_token TEXT UNIQUE
created_at, revoked_at
```

## 9. Edge Functions to Add

- `gallery-rotate-share-secret` — kill switch; rotates `share_secret`, optionally
  emails legitimate viewers a new link.
- `gallery-suggest-selection` — runs the AI pre-selection (uses existing
  `ai_rating` + face_clusters + diversity heuristic) and writes `is_ai_suggested`
  flags + initial `gallery_selections` rows.
- `gallery-record-share` — receives share-event beacons from the public page.
- `gallery-record-dwell` — receives dwell-time pings for heatmap data.
- `gallery-share-card-og` — generates OG image (1200x630) for a single photo or
  guest's personal album, branded with the photographer's logo & colors.
- `gallery-send-whatsapp-link` — generates `wa.me` deeplinks with templated
  Hebrew/English message body.
- `gallery-finalize-selection` — called when client submits final selection;
  notifies photographer via WhatsApp + email.

## 10. Public Gallery — Design Language

The public gallery is where the *aesthetic stakes* are highest. Following
SKILL.md's "frontend-design" guidance, the public gallery shipped from Imagick
must commit to a distinctive direction, not generic AI-slop.

**Direction**: *editorial silence* — generous negative space, serif display
type (Playfair Display already loaded), subtle film-grain texture, restrained
motion (slow fade-ups, never bouncy springs). The brand colors come from the
photographer; Imagick's chrome is invisible.

**Required design tokens** (CSS vars consumed by templates):
- `--brand-primary`, `--brand-accent`, `--brand-text`, `--brand-bg`
- `--brand-font-display`, `--brand-font-body`
- `--brand-radius` (mirror photographer's logo softness)

**Typography pairings to ship**:
- Editorial: Playfair Display + Inter (current default)
- Modern: Fraunces + Geist
- Romantic: Cormorant Garamond + Manrope
- Bold: Bebas Neue + Spectral
- Minimal: Tenor Sans + Inter

**Motion grammar** (consistent across templates):
- Image grid fade-in: 600ms ease-out, stagger 40ms
- Lightbox transition: spring(280, 22, 0.2)
- Cinema intro Ken Burns: 8s linear scale 1→1.08
- Selection swap: 320ms cross-fade

**Mobile-first**: every template designed at 390px first; desktop is an
enhancement, not the canonical view.

## 11. Photographer Feedback Loop

The Insights tab replaces today's Statistics. Three modules, scannable on a
phone in 30 seconds:

1. **Selection Progress** (when Selection Mode is on)
   - Big number: "58 of 60 chosen — done in 2 days"
   - Per-couple status if multi-recipient
2. **Emotional Heatmap**
   - Top 20 photos ranked by `view × dwell × favorite × share`
   - One-line caption per photo: "Viewed 47×, Sara stayed 11s, favorited 6×"
3. **Activity Timeline**
   - Who viewed when, from where, on what device
   - Anomaly flag if same IP attempted >5 password fails (kill-switch button)

A weekly digest is sent to the photographer via WhatsApp/email summarizing
all their active galleries.

## 12. Delivery Plan — Phases

### Phase 1 — Foundation (this PR)
*Goal: ship the data model, brand customization, expiry/kill-switch, and the
selection workflow. Cinema intro lite. Per-image share routes. WhatsApp share
buttons. New Insights stub.*

Files touched:
- New migration: `2026XXXX_share_gallery_foundation.sql`
- New edge functions: `gallery-rotate-share-secret`, `gallery-suggest-selection`,
  `gallery-record-share`, `gallery-share-card-og`, `gallery-finalize-selection`
- ShareGalleryModal: 4 tabs → 5 tabs (Design, Privacy, Selection, Share, Insights)
- ClientGalleryPage: brand theming + expiry enforcement + email gate
- New templates: `CinemaIntro.tsx` (overlay component that plays first)
- New routes: `/gallery/:id/photo/:imageId` (per-photo share view with OG meta)
- New dashboard page: `/dashboard/galleries/:id/insights` and `/selections`

### Phase 2 — Guest face-search at scale
*Wire the existing face_clusters into a selfie-based search UX for guests.*

### Phase 3 — Vendor links + dual gallery
*Religious/secular Israeli gallery split + vendor-scoped sub-links.*

### Phase 4 — Music & Cinema 2.0
*Licensed music library, beat-synced slideshow, generated highlight reel video.*

### Phase 5 — Photographer-side AI
*Auto-cull at upload, smart album generation, AI-retouch toggles surfaced to
the client.*

## 13. Success Criteria for Phase 1

- ✅ Photographer can set brand color + logo and see it applied to public gallery.
- ✅ Expiry date enforced in `get_public_gallery` RPC.
- ✅ Kill switch rotates `share_secret`; old links 404.
- ✅ Selection Mode UI lets client review 60 AI-suggested images, swap, submit.
- ✅ Photographer sees selection results in new `/selections` page.
- ✅ Every photo has its own `/photo/:id` share page with branded OG image.
- ✅ "Share via WhatsApp" button on every gallery and every photo.
- ✅ Cinema intro plays on first gallery open (skippable).
- ✅ All public-facing pages have **zero "Powered by Imagick" chrome** by default.

## 14. Open Questions

1. **Music licensing**: do we ship our own library (cost) or let photographers
   upload their own (DMCA risk)? Defer to Phase 4; Phase 1 ships silent Cinema.
2. **Custom domain**: do we host (Vercel domain attach) or proxy? Defer; Phase 1
   ships only the `custom_domain` field for later use.
3. **AI selection algorithm**: weight ai_rating × face-coverage × diversity? Start
   with a heuristic; learn from client swaps in Phase 2.
4. **Email gate vs. password**: are they mutually exclusive, or can a gallery
   require both? Decision: orthogonal; either or both can be on.
5. **Dual-gallery automation**: how does the photographer tag "modest"? Bulk
   action in editor + AI suggestion. Defer auto-tagging to Phase 3.

---

*Document owners: Imagick PM (this plan), frontend-design subagents (visual
language), backend agents (data + edge functions).*
