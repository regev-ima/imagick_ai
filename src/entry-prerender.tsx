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
          </Routes>
        </StaticRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
