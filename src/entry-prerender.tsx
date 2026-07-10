import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import LandingPage from "./pages/LandingPage";
import PricingPage from "./pages/PricingPage";
import UseCasePage from "./pages/marketing/UseCasePage";
import BlogIndexPage from "./pages/marketing/BlogIndexPage";
import BlogPostPage from "./pages/marketing/BlogPostPage";
import AboutPage from "./pages/marketing/AboutPage";
import AiStylesPage from "./pages/marketing/AiStylesPage";
import AiWorkflowPage from "./pages/marketing/AiWorkflowPage";
import CaseStudiesPage from "./pages/marketing/CaseStudiesPage";
import ComparePage from "./pages/marketing/ComparePage";
import ContactPage from "./pages/marketing/ContactPage";
import EnterprisePage from "./pages/marketing/EnterprisePage";
import TryDemoPage from "./pages/marketing/TryDemoPage";
import { SITE, FAQS, PLANS } from "./components/marketing/data";
import { USE_CASES } from "./components/marketing/content";
import { BLOG_POSTS } from "./components/marketing/blog";

export type PrerenderRoute = {
  url: string;
  /** Output path relative to dist, e.g. "pricing/index.html". */
  out: string;
  title: string;
  description: string;
  jsonLd: unknown[];
};

function breadcrumb(items: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, item], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item,
    })),
  };
}

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const ROUTES: PrerenderRoute[] = [
  {
    url: "/",
    out: "index.html",
    title: "Imagick.ai — Train AI on your editing style | AI photo editing for photographers",
    description: SITE.description,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: SITE.url },
      faqLd,
    ],
  },
  {
    url: "/pricing",
    out: "pricing/index.html",
    title: "Pricing — Imagick.ai | Start free, scale your photo editing",
    description:
      "Imagick.ai pricing: a free-forever plan with 3,000 AI edits, plus unlimited Starter, Pro and Studio plans from $19/mo. Train custom AI styles, cull faster, deliver client galleries.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: `${SITE.name} subscription`,
        description: SITE.description,
        brand: { "@type": "Brand", name: SITE.name },
        offers: PLANS.map((p) => ({
          "@type": "Offer",
          name: p.name,
          price: String(p.monthly),
          priceCurrency: "USD",
        })),
      },
      faqLd,
    ],
  },
  {
    url: "/blog",
    out: "blog/index.html",
    title: "Blog — workflow, editing & business for photographers | Imagick.ai",
    description:
      "Practical guides on AI culling, editing in your own style, and delivering galleries faster — for working photographers.",
    jsonLd: [
      { "@context": "https://schema.org", "@type": "Blog", name: `${SITE.name} Blog`, url: `${SITE.url}/blog` },
    ],
  },
  ...([
    {
      url: "/about",
      title: "About Imagick.ai — the AI editing studio for photographers",
      description:
        "Why we built Imagick: photographers were losing nights to editing. Train an AI on your own style, cull in minutes, deliver galleries clients love.",
    },
    {
      url: "/ai-styles",
      title: "AI styles — an AI trained on your editing | Imagick.ai",
      description:
        "Train a personal AI style on 50–100 of your own edits. Consistent skin tones, mixed-light grading and your color signature — across entire shoots, in minutes.",
    },
    {
      url: "/ai-workflow",
      title: "The AI workflow — card to client gallery in one sitting | Imagick.ai",
      description:
        "See the full Imagick workflow: AI culling that finds the keepers, editing in your own trained style, and same-day client gallery delivery.",
    },
    {
      url: "/case-studies",
      title: "Case studies — photographers on Imagick.ai",
      description:
        "How wedding, portrait, event and studio photographers cut editing time by 70–90% with AI trained on their own style. Real workflows, real numbers.",
    },
    {
      url: "/compare",
      title: "Compare: Imagick vs presets vs outsourced editing | Imagick.ai",
      description:
        "An honest comparison of the four ways photographers edit: a trained AI style, preset packs, outsourced editors and doing it all yourself — style, cost, turnaround.",
    },
    {
      url: "/contact",
      title: "Contact — Imagick.ai",
      description:
        "Talk to the Imagick.ai team: support, billing, studios & enterprise, press and partnerships. Real humans, replies within one business day.",
    },
    {
      url: "/enterprise",
      title: "Studios & enterprise — Imagick.ai for teams",
      description:
        "Imagick.ai for photography studios and high-volume teams: shared AI styles, multi-seat workflows, custom volume, dedicated onboarding and contractual privacy.",
    },
    {
      url: "/try-demo",
      title: "Try the demo — see an AI style before & after | Imagick.ai",
      description:
        "Drag the slider: straight-out-of-camera vs the photographer's trained AI style. Then train your own on 50–100 of your edits — free.",
    },
  ] as const).map((p) => ({
    url: p.url,
    out: `${p.url.replace(/^\//, "")}/index.html`,
    title: p.title,
    description: p.description,
    jsonLd: [breadcrumb([["Home", SITE.url], [p.title.split(" — ")[0], `${SITE.url}${p.url}`]])],
  })),
  ...USE_CASES.map((u) => ({
    url: `/for/${u.slug}`,
    out: `for/${u.slug}/index.html`,
    title: u.metaTitle,
    description: u.metaDescription,
    jsonLd: [breadcrumb([["Home", SITE.url], [u.niche, `${SITE.url}/for/${u.slug}`]])],
  })),
  ...BLOG_POSTS.map((p) => ({
    url: p.url, // preserved verbatim (e.g. "/blog/<slug>")
    out: `${p.url.replace(/^\//, "")}/index.html`,
    title: p.metaTitle,
    description: p.metaDescription,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: p.title,
        description: p.metaDescription,
        ...(p.cover ? { image: [p.cover] } : {}),
        datePublished: p.date,
        dateModified: p.modified,
        author: { "@type": "Organization", name: p.author || SITE.name },
        publisher: {
          "@type": "Organization",
          name: SITE.name,
          logo: { "@type": "ImageObject", url: `${SITE.url}/favicon.png` },
        },
        ...(p.keywords?.length ? { keywords: p.keywords.join(", ") } : {}),
        mainEntityOfPage: `${SITE.url}${p.url}`,
        url: `${SITE.url}${p.url}`,
      },
      breadcrumb([
        ["Home", SITE.url],
        ["Blog", `${SITE.url}/blog`],
        [p.title, `${SITE.url}${p.url}`],
      ]),
    ],
  })),
];

export function render(url: string): string {
  const queryClient = new QueryClient();
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <StaticRouter location={url}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/for/:slug" element={<UseCasePage />} />
            <Route path="/blog" element={<BlogIndexPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/ai-styles" element={<AiStylesPage />} />
            <Route path="/ai-workflow" element={<AiWorkflowPage />} />
            <Route path="/case-studies" element={<CaseStudiesPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/enterprise" element={<EnterprisePage />} />
            <Route path="/try-demo" element={<TryDemoPage />} />
          </Routes>
        </StaticRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
