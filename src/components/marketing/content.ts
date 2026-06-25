// SEO content for niche landing pages (/for/:slug) and the blog (/blog/:slug).
// Real, useful copy targeting how photographers actually search.

export type UseCase = {
  slug: string;
  niche: string; // short label, e.g. "Wedding"
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  intro: string;
  pains: string[];
  benefits: { title: string; body: string }[];
};

export const USE_CASES: UseCase[] = [
  {
    slug: "wedding-photographers",
    niche: "Wedding",
    metaTitle: "AI photo editing for wedding photographers | Imagick.ai",
    metaDescription:
      "Cull and edit entire weddings in your own style in minutes, not nights. AI culling, face grouping and branded client galleries built for wedding photographers.",
    eyebrow: "For wedding photographers",
    h1: "Deliver the wedding the morning after — not three weeks later",
    intro:
      "A wedding is 3,000–6,000 frames of fast-moving light. Imagick learns your signature grade, culls the keepers, and groups every guest's face — so the couple gets a gallery they'll cry over while the day is still fresh.",
    pains: [
      "Nights lost to culling thousands of near-duplicate frames",
      "Keeping skin tones and white dresses consistent across changing light",
      "Couples waiting weeks, then asking 'is it ready yet?'",
    ],
    benefits: [
      {
        title: "Cull a full wedding in minutes",
        body: "AI scores every frame for focus, eyes and expression and surfaces your keepers — typically 90% faster than clicking through by hand.",
      },
      {
        title: "Your grade, every frame",
        body: "Train a model on your past weddings. It holds your colour and protects skin tones from the ceremony to the last dance.",
      },
      {
        title: "Galleries guests love",
        body: "Share a branded gallery where every guest taps their face to find their photos, favourites the best, and orders prints.",
      },
    ],
  },
  {
    slug: "portrait-photographers",
    niche: "Portrait",
    metaTitle: "AI editing for portrait & headshot photographers | Imagick.ai",
    metaDescription:
      "Retouch-ready portraits in your style, at volume. Train an AI model on your look and grade whole sessions in seconds — for portrait, headshot and branding photographers.",
    eyebrow: "For portrait photographers",
    h1: "Your portrait look, applied to the whole session in seconds",
    intro:
      "Portrait work lives and dies on consistency. Imagick learns exactly how you grade skin, eyes and tone, then applies it across the session — so every frame already looks like you before you open a single slider.",
    pains: [
      "Re-doing the same edits on hundreds of similar frames",
      "Skin tones drifting between setups and lighting",
      "Turnaround that can't keep up with booked-out weeks",
    ],
    benefits: [
      {
        title: "Train it on your retouching style",
        body: "Feed it your before/afters. It learns your skin, contrast and colour and reproduces them per-image — not a flat global preset.",
      },
      {
        title: "Pick the keepers instantly",
        body: "AI ratings put the sharpest, best-expression frames first so you select in a glance.",
      },
      {
        title: "Proof in a beautiful gallery",
        body: "Send a clean, branded gallery; clients favourite their picks and download in a click.",
      },
    ],
  },
  {
    slug: "real-estate-photographers",
    niche: "Real estate",
    metaTitle: "AI photo editing for real estate photographers | Imagick.ai",
    metaDescription:
      "Same-day listings without the editing grind. AI culls, grades and standardises whole shoots in your style — built for real estate and architectural photographers.",
    eyebrow: "For real estate photographers",
    h1: "Same-day listings without the late-night editing",
    intro:
      "Agents want photos yesterday. Imagick grades a whole property shoot to your house style in seconds and hands you a consistent, listing-ready set — so you shoot more homes and edit none of them at midnight.",
    pains: [
      "High volume, razor-thin turnaround windows",
      "Keeping a consistent look across every room and listing",
      "Editing eating the margin on every job",
    ],
    benefits: [
      {
        title: "Standardise your house style",
        body: "One trained model keeps every room and every listing on-brand, shoot after shoot.",
      },
      {
        title: "Batch entire shoots",
        body: "Drop a full property in and get a graded, consistent set back in seconds.",
      },
      {
        title: "Deliver in a click",
        body: "Hand agents a tidy gallery with downloads enabled — same day, every time.",
      },
    ],
  },
  {
    slug: "event-photographers",
    niche: "Event",
    metaTitle: "AI culling & editing for event photographers | Imagick.ai",
    metaDescription:
      "Thousands of frames, delivered fast. AI culling, face grouping and bulk editing in your style — for conference, party and event photographers.",
    eyebrow: "For event photographers",
    h1: "Thousands of frames, culled and delivered the same night",
    intro:
      "Events bury you in frames. Imagick rates and groups them, applies your look in bulk, and lets every attendee find themselves by face — so you turn a 4,000-shot night around before the client's coffee goes cold.",
    pains: [
      "Enormous volume with next-morning deadlines",
      "Attendees asking 'where are my photos?'",
      "Manual culling that doesn't scale to back-to-back events",
    ],
    benefits: [
      {
        title: "Cull at event scale",
        body: "AI ratings cut a 4,000-frame night down to the keepers in minutes.",
      },
      {
        title: "Face-search for attendees",
        body: "Everyone clicks their face and instantly sees every photo they're in.",
      },
      {
        title: "Bulk-grade in your style",
        body: "Apply your look across the whole event in one pass, then deliver.",
      },
    ],
  },
];

export function getUseCase(slug?: string) {
  return USE_CASES.find((u) => u.slug === slug);
}

/* ── Blog ──────────────────────────────────────────────────────── */

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "quote"; text: string };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO (published)
  updated?: string; // ISO (last modified)
  readMins: number;
  tag: string;
  category?: string;
  keywords?: string[];
  cover?: string; // public path, e.g. "/blog/slug.jpg"
  coverAlt?: string;
  author?: string;
  body?: Block[]; // authored structured content
  contentHtml?: string; // imported HTML (e.g. from WordPress)
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "cull-wedding-gallery-faster-with-ai",
    title: "How to cull a wedding gallery 90% faster with AI",
    description:
      "A practical workflow for turning 4,000 wedding frames into a tight set of keepers in minutes — without losing your eye for the moment.",
    date: "2026-06-10",
    readMins: 6,
    tag: "Workflow",
    category: "Workflow",
    author: "Imagick.ai",
    cover: "/blog/cull-wedding-gallery-faster-with-ai.jpg",
    coverAlt: "A wedding gallery being culled with AI ratings",
    keywords: [
      "wedding photo culling",
      "AI culling",
      "cull photos faster",
      "photography workflow",
      "wedding gallery editing",
    ],
    body: [
      { type: "p", text: "Culling is the part of wedding photography nobody books you for, yet it quietly eats more hours than the shoot itself. A single wedding can produce four to six thousand frames, and the difference between a keeper and a reject is often a half-blink. Here's a workflow that keeps your judgement in the loop while letting AI do the brutal first pass." },
      { type: "h2", text: "1. Import the whole day, untouched" },
      { type: "p", text: "Don't pre-sort on the back of the camera. Drop the entire card — or pull it straight from Google Drive — and let the engine see everything. AI culling works best with the full context of a sequence, because it can compare near-duplicate frames and pick the sharpest, best-expression one." },
      { type: "h2", text: "2. Let AI rate before you touch anything" },
      { type: "p", text: "Every frame gets scored for focus, eye state and expression. Instead of clicking through 4,000 images, you start from a ranked view: five-star keepers first, obvious rejects (closed eyes, missed focus, duplicates) filtered out." },
      { type: "ul", items: [
        "Filter to top picks (4★ and up) to see your hero set instantly",
        "Scan the 3★ band for the ones the AI wasn't sure about",
        "Bulk-reject the flagged duplicates and closed-eye frames",
      ] },
      { type: "h2", text: "3. Confirm, don't re-do" },
      { type: "p", text: "This is the key mindset shift. You're no longer hunting for keepers in a haystack — you're confirming or overriding the AI's shortlist. A frame the AI rated four stars that you love becomes a five; a technically-sharp frame that missed the moment gets cut. You stay the editor; the machine just removes the grind." },
      { type: "quote", text: "Culling went from three nights to about forty minutes. I review the keepers and confirm — I'm not clicking through every frame anymore." },
      { type: "h2", text: "4. Hand the keepers straight to editing" },
      { type: "p", text: "Once your set is tight, your trained style model grades it in seconds and you move to delivery. The whole point is that the boring 90% is automated so your attention goes where it matters: the moments only you saw." },
    ],
  },
  {
    slug: "ai-photo-editing-vs-presets",
    title: "AI photo editing vs. presets: what actually matches your style",
    description:
      "Presets apply the same numbers to every frame. A trained AI model makes per-image decisions. Here's why that difference matters for consistency.",
    date: "2026-05-28",
    readMins: 5,
    tag: "Editing",
    category: "Editing",
    author: "Imagick.ai",
    cover: "/blog/ai-photo-editing-vs-presets.jpg",
    coverAlt: "A landscape photo before and after a custom AI edit",
    keywords: [
      "AI photo editing",
      "AI vs presets",
      "Lightroom presets",
      "custom AI editing style",
      "consistent photo editing",
    ],
    body: [
      { type: "p", text: "Presets promised one-click consistency and never quite delivered. Drag a preset across a gallery and you'll spend the next hour fixing every frame it didn't fit. The reason is simple: a preset is a fixed set of numbers, and your photos aren't a fixed set of conditions." },
      { type: "h2", text: "What a preset actually does" },
      { type: "p", text: "A preset moves the same sliders by the same amounts on every image — regardless of exposure, white balance, or skin tone. On the three frames it was designed for, it looks perfect. On the backlit one, the shaded one, and the one with a different skin tone, it doesn't." },
      { type: "h2", text: "What a trained model does instead" },
      { type: "p", text: "A trained AI model learns the relationship between your originals and your finished edits. It doesn't memorise slider values — it learns intent. Given a new frame, it decides what you would have done, adapting per image:" },
      { type: "ul", items: [
        "Protecting skin tones as light changes across a gallery",
        "Balancing exposure frame-by-frame instead of globally",
        "Holding your colour signature across thousands of images",
      ] },
      { type: "h2", text: "Why consistency is the real win" },
      { type: "p", text: "Clients don't see your sliders; they see whether image #4 looks like image #400. Per-image decisions are what make a gallery feel like one cohesive body of work instead of a folder that had a filter dragged over it." },
      { type: "quote", text: "It's not a generic filter — the skin tones come back the way I'd grade them by hand, just faster." },
      { type: "p", text: "Presets are a starting point. A model trained on your work is closer to a second pair of your own hands — which is exactly what you want when you're grading at volume." },
    ],
  },
  {
    slug: "faster-client-delivery-guide",
    title: "The photographer's guide to faster client delivery",
    description:
      "Speed is a selling point. A look at how culling, editing and proofing add up — and where AI removes the days between the shoot and the gallery.",
    date: "2026-05-12",
    readMins: 5,
    tag: "Business",
    category: "Business",
    author: "Imagick.ai",
    cover: "/blog/faster-client-delivery-guide.jpg",
    coverAlt: "A photographer delivering a client gallery",
    keywords: [
      "faster photo delivery",
      "client gallery",
      "photography turnaround time",
      "photo proofing",
      "deliver wedding photos faster",
    ],
    body: [
      { type: "p", text: "Ask a couple what they remember about hiring their photographer and 'fast delivery' comes up more than you'd think. Turnaround isn't just a courtesy — it's a referral engine. The faster the gallery lands while the emotion is high, the more it gets shared. Here's where the days actually go, and how to win them back." },
      { type: "h2", text: "The three time sinks" },
      { type: "ul", items: [
        "Culling: separating keepers from thousands of frames",
        "Editing: grading the keepers to your style",
        "Proofing: getting selects and feedback from the client",
      ] },
      { type: "p", text: "Each of these traditionally happens in series, with you as the bottleneck at every step. Compress all three and a two-week turnaround becomes a two-day one." },
      { type: "h2", text: "Cut culling to minutes" },
      { type: "p", text: "AI ratings hand you the keepers instead of making you find them. This is usually the single biggest time saving in the whole pipeline." },
      { type: "h2", text: "Edit in your style, in bulk" },
      { type: "p", text: "A trained model grades the whole set in seconds while holding your look. You review rather than redo." },
      { type: "h2", text: "Close the loop with the client" },
      { type: "p", text: "A branded gallery with favourites, comments and face-search means the client selects the same day — no email back-and-forth, no spreadsheet of file numbers." },
      { type: "quote", text: "People pick their favourites the same day, and the face search wins every time." },
      { type: "p", text: "Put together, the message to your market becomes simple and rare: book me, and you'll see your photos in days. That's a promise most photographers can't make — and a reason to choose you." },
    ],
  },
];

export function getPost(slug?: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
