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
