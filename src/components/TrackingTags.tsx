import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMarketingTags,
  MARKETING_TAGS_QUERY_KEY,
  type MarketingTags,
} from "@/lib/marketingTags";

/* ── DOM helpers (idempotent — keyed by element id) ──────────────── */

function addExternalScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function addInlineScript(id: string, code: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.text = code;
  document.head.appendChild(s);
}

function addNoscript(id: string, html: string) {
  if (document.getElementById(id)) return;
  const n = document.createElement("noscript");
  n.id = id;
  n.innerHTML = html;
  document.body.appendChild(n);
}

function upsertMeta(name: string, content: string) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Inject admin-authored HTML, re-creating <script> nodes so they execute. */
function injectHtml(id: string, html: string, target: HTMLElement) {
  if (!html || document.getElementById(id)) return;
  const wrap = document.createElement("div");
  wrap.id = id;
  wrap.style.display = "none";
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  tpl.content.querySelectorAll("script").forEach((old) => {
    const s = document.createElement("script");
    [...old.attributes].forEach((a) => s.setAttribute(a.name, a.value));
    s.text = old.textContent ?? "";
    old.replaceWith(s);
  });
  wrap.appendChild(tpl.content);
  target.appendChild(wrap);
}

/* ── individual tag injectors ────────────────────────────────────── */

function injectTags(t: MarketingTags) {
  // Search-engine ownership verification is always applied when set.
  if (t.googleSiteVerification) upsertMeta("google-site-verification", t.googleSiteVerification);
  if (t.bingSiteVerification) upsertMeta("msvalidate.01", t.bingSiteVerification);

  if (!t.enabled) return;

  // Google Tag Manager
  if (t.gtmId) {
    addInlineScript(
      "imk-gtm",
      `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${t.gtmId}');`,
    );
    addNoscript(
      "imk-gtm-ns",
      `<iframe src="https://www.googletagmanager.com/ns.html?id=${t.gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
    );
  }

  // gtag.js powers both GA4 and Google Ads
  const gtagPrimary = t.ga4Id || t.googleAdsId;
  if (gtagPrimary) {
    addExternalScript("imk-gtag-src", `https://www.googletagmanager.com/gtag/js?id=${gtagPrimary}`);
    addInlineScript(
      "imk-gtag-init",
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());` +
        (t.ga4Id ? `gtag('config','${t.ga4Id}');` : "") +
        (t.googleAdsId ? `gtag('config','${t.googleAdsId}');` : ""),
    );
  }

  // Microsoft Clarity
  if (t.clarityId) {
    addInlineScript(
      "imk-clarity",
      `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${t.clarityId}");`,
    );
  }

  // Meta (Facebook) Pixel
  if (t.metaPixelId) {
    addInlineScript(
      "imk-meta-pixel",
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${t.metaPixelId}');fbq('track','PageView');`,
    );
    addNoscript(
      "imk-meta-pixel-ns",
      `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${t.metaPixelId}&ev=PageView&noscript=1"/>`,
    );
  }

  // TikTok Pixel
  if (t.tiktokPixelId) {
    addInlineScript(
      "imk-tiktok",
      `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${t.tiktokPixelId}');ttq.page();}(window,document,'ttq');`,
    );
  }

  // LinkedIn Insight Tag
  if (t.linkedinPartnerId) {
    addInlineScript(
      "imk-linkedin",
      `_linkedin_partner_id="${t.linkedinPartnerId}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);`,
    );
    addExternalScript("imk-linkedin-src", "https://snap.licdn.com/li.lms-analytics/insight.min.js");
  }

  // Pinterest Tag
  if (t.pinterestTagId) {
    addInlineScript(
      "imk-pinterest",
      `!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");pintrk('load','${t.pinterestTagId}');pintrk('page');`,
    );
  }

  // Admin-authored custom code (trusted)
  if (t.customHeadHtml) injectHtml("imk-custom-head", t.customHeadHtml, document.head);
  if (t.customBodyHtml) injectHtml("imk-custom-body", t.customBodyHtml, document.body);
}

/**
 * Loads the admin-managed marketing/tracking tags and injects them site-wide.
 * Renders nothing. Safe before the migration ships (fetch resolves to a
 * disabled default) and during SSR/prerender (the effect simply never runs).
 */
export function TrackingTags() {
  const { data } = useQuery({
    queryKey: MARKETING_TAGS_QUERY_KEY,
    queryFn: fetchMarketingTags,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data || typeof document === "undefined") return;
    try {
      injectTags(data);
    } catch {
      /* never let a tracking misconfig break the app */
    }
  }, [data]);

  return null;
}
