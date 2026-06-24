// ════════════════════════════════════════════════════════════════════
// Marketing site content — single source of truth for the sales pages.
// Copy is derived from the live product (auth hero stats + plan pricing),
// so it stays truthful. Testimonials are illustrative placeholders the
// founder can swap for real quotes.
// ════════════════════════════════════════════════════════════════════

export const SITE = {
  name: "Imagick.ai",
  domain: "imagick.ai",
  url: "https://imagick.ai",
  tagline: "The AI editing studio for photographers",
  description:
    "Train an AI model on your own editing style and apply it to thousands of photos in seconds. AI culling, face grouping and beautiful client galleries — built for professional photographers.",
  twitter: "@imagick_ai",
  email: "contact@imagick.ai",
} as const;

export type Plan = {
  slug: string;
  name: string;
  blurb: string;
  monthly: number;
  yearly: number; // total billed per year
  highlight?: boolean;
  badge?: string;
  cta: string;
  features: string[];
};

// Mirrors supabase/apply_new_pricing.sql
export const PLANS: Plan[] = [
  {
    slug: "free",
    name: "Free",
    blurb: "Everything you need to try the engine on a real shoot.",
    monthly: 0,
    yearly: 0,
    cta: "Start for free",
    features: [
      "3,000 free AI edits",
      "5 pre-built AI styles",
      "Basic AI culling",
      "5 GB cloud storage",
      "Standard support",
    ],
  },
  {
    slug: "starter",
    name: "Starter",
    blurb: "Go unlimited. The volume plan for working photographers.",
    monthly: 19,
    yearly: 180,
    cta: "Start free trial",
    features: [
      "Unlimited AI edits",
      "Unlimited culling & grouping",
      "Unlimited galleries",
      "5 pre-built AI styles",
      "50 GB cloud storage",
      "Email support",
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    blurb: "Train the AI on your signature look. Our most popular plan.",
    monthly: 49,
    yearly: 468,
    highlight: true,
    badge: "Most popular",
    cta: "Start free trial",
    features: [
      "Everything in Starter",
      "2 custom AI models included",
      "Full style library (30+)",
      "500 GB cloud storage",
      "Priority processing queue",
      "Chat + email support",
      "Extra models: $15 each",
    ],
  },
  {
    slug: "studio",
    name: "Studio",
    blurb: "For studios and teams editing at serious scale.",
    monthly: 99,
    yearly: 948,
    cta: "Talk to sales",
    features: [
      "Everything in Pro",
      "10 custom AI models",
      "Up to 10 team members",
      "Shared style library",
      "2 TB cloud storage",
      "API access",
      "Dedicated account manager",
      "Extra models: $10 each",
    ],
  },
];

// Marketing-only copy per plan slug (blurb, CTA, highlight, badge) + a feature
// fallback. Merged with the live subscription_plans rows by useMarketingPlans,
// so the platform stays the source of truth for price & features.
export const PLAN_META: Record<
  string,
  Pick<Plan, "blurb" | "cta" | "highlight" | "badge" | "features">
> = Object.fromEntries(
  PLANS.map((p) => [
    p.slug,
    { blurb: p.blurb, cta: p.cta, highlight: p.highlight, badge: p.badge, features: p.features },
  ]),
);

export const STATS = [
  { value: 10, suffix: "+", label: "Hours saved / week" },
  { value: 90, suffix: "%", label: "Faster culling" },
  { value: 99, suffix: "%", label: "AI rating accuracy" },
  { value: 10, suffix: "k+", label: "Photographers" },
] as const;

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Import your shoot",
    body: "Drag in a full gallery or pull straight from Google Drive. Thousands of frames, one drop.",
  },
  {
    step: "02",
    title: "AI culls & rates",
    body: "Every frame is scored for focus, expression and eyes — and faces are grouped automatically.",
  },
  {
    step: "03",
    title: "Your style, applied",
    body: "Your trained AI model grades the whole set in seconds. Not a preset — your look.",
  },
  {
    step: "04",
    title: "Deliver & get picks",
    body: "Share a branded client gallery. Clients favourite, comment and download in a click.",
  },
] as const;

export const FAQS = [
  {
    q: "What exactly is Imagick.ai?",
    a: "It's an AI editing studio for professional photographers. You train an AI model on your own editing style, then apply it to entire shoots in seconds — alongside automatic culling, face grouping and client-ready galleries. It replaces hours of repetitive culling and grading, not your creative direction.",
  },
  {
    q: "Does it just slap a preset on my photos?",
    a: "No. Presets apply the same fixed numbers to every image. Imagick learns the relationship between your originals and your finished edits, then makes per-image decisions the way you would — adapting to light, skin tones and exposure across the whole gallery.",
  },
  {
    q: "How do I train my own AI style?",
    a: "On Pro and Studio plans you create a custom model by giving the engine examples of your before/after edits. It studies your look and, once trained, applies it to any future gallery. Pro includes 2 custom models, Studio includes 10, and you can add more anytime.",
  },
  {
    q: "How fast is the culling really?",
    a: "Imagick rates a full shoot automatically — typically cutting culling time by around 90%. You review the AI's top picks and ratings instead of clicking through every frame one by one.",
  },
  {
    q: "Can my clients use the galleries?",
    a: "Yes. Share a secure, branded gallery in one of six templates. Clients can favourite images, leave feedback and — if you allow it — download their selects. Face grouping even lets each guest click their own face to find every photo they're in.",
  },
  {
    q: "Do I keep the rights to my photos?",
    a: "Always. Your images and your trained styles are yours. Galleries are private by default and shared only via the secure links you create.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The Free plan is genuinely free forever and includes 3,000 AI edits so you can run a real shoot through the engine before paying a cent. Upgrade only when you're ready.",
  },
  {
    q: "Can I cancel or change plans anytime?",
    a: "Yes — upgrade, downgrade or cancel whenever you like, straight from your billing page. Annual billing saves you roughly 20% versus paying monthly.",
  },
] as const;

// Illustrative testimonials — replace with verified customer quotes.
export const TESTIMONIALS = [
  {
    quote:
      "I shot a 14-hour wedding and had the culled, graded gallery to the couple the next morning. That used to be three nights of my life.",
    name: "Dana K.",
    role: "Wedding photographer",
    initials: "DK",
  },
  {
    quote:
      "It actually learned my look. The skin tones come back the way I'd grade them by hand — it's not a generic filter, it's me, faster.",
    name: "Marco V.",
    role: "Portrait & editorial",
    initials: "MV",
  },
  {
    quote:
      "The client galleries close the loop. People pick their favourites the same day and the face search blows them away every single time.",
    name: "Aria L.",
    role: "Family & newborn studio",
    initials: "AL",
  },
  {
    quote:
      "Culling 4,000 frames was my least favourite part of the job. Now the AI hands me the keepers and I just confirm. Easily 10 hours back a week.",
    name: "Tom R.",
    role: "Event photographer",
    initials: "TR",
  },
  {
    quote:
      "We run a three-shooter studio. Shared styles mean every gallery looks like us, no matter who pressed the shutter.",
    name: "Noa B.",
    role: "Studio owner",
    initials: "NB",
  },
  {
    quote:
      "I was sceptical about 'AI editing'. Two galleries in, I cancelled the editor I was outsourcing to.",
    name: "Liam S.",
    role: "Real estate & commercial",
    initials: "LS",
  },
] as const;
