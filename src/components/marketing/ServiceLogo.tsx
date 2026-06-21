// Colored brand marks for the Tracking & Tags admin page, so each integration
// is identifiable at a glance. Keyed by the settings field name.

type Props = { brand: string; className?: string };

export function ServiceLogo({ brand, className = "h-5 w-5" }: Props) {
  const common = { viewBox: "0 0 24 24", className, "aria-hidden": true } as const;

  switch (brand) {
    case "ga4Id": // Google Analytics 4
      return (
        <svg {...common}>
          <path fill="#F9AB00" d="M22.84 3v18a2.98 2.98 0 0 1-2.97 2.98 2.9 2.9 0 0 1-.37-.02 3.06 3.06 0 0 1-2.6-3.1V3.12A3.06 3.06 0 0 1 19.5.02 2.98 2.98 0 0 1 22.84 3z" />
          <path fill="#E37400" d="M3.13 18.04a2.98 2.98 0 1 0 0 5.96 2.98 2.98 0 0 0 0-5.96zm9.86-9h-.06a3.06 3.06 0 0 0-2.81 3.12v8.76c0 2.34 1.03 3.76 2.54 4.07a2.98 2.98 0 0 0 3.42-2.94v-9.96a3.07 3.07 0 0 0-3.09-3.05z" />
        </svg>
      );
    case "gtmId": // Google Tag Manager
      return (
        <svg {...common}>
          <path fill="#246FDB" d="M12 1.6 1.6 12 12 22.4 22.4 12z" />
          <path fill="#8AB4F8" d="M12 1.6 22.4 12 12 22.4z" />
          <circle cx="12" cy="12" r="2.3" fill="#fff" />
        </svg>
      );
    case "clarityId": // Microsoft Clarity (analytics "eye")
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="11" fill="#1F6FEB" />
          <circle cx="12" cy="12" r="5" fill="#fff" />
          <circle cx="12" cy="12" r="2.4" fill="#1F6FEB" />
        </svg>
      );
    case "metaPixelId": // Meta / Facebook Pixel
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="5.5" fill="#1877F2" />
          <path fill="#fff" d="M13.7 21v-7h2.3l.42-2.7h-2.72V9.54c0-.78.26-1.32 1.4-1.32H16.6V5.8c-.3-.04-1.3-.13-2.46-.13-2.43 0-4.1 1.48-4.1 4.2v2.32H7.6V14h2.44v7h3.66z" />
        </svg>
      );
    case "googleAdsId": // Google Ads
      return (
        <svg {...common}>
          <rect x="8.6" y="1.8" width="6.8" height="15.5" rx="3.4" transform="rotate(-30 12 9.5)" fill="#FBBC04" />
          <rect x="8.6" y="6.7" width="6.8" height="15.5" rx="3.4" transform="rotate(30 12 14.5)" fill="#4285F4" />
          <circle cx="6.3" cy="17.8" r="3.05" fill="#4285F4" />
        </svg>
      );
    case "tiktokPixelId": // TikTok Pixel
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="5.5" fill="#010101" />
          <path transform="translate(-.7 -.6)" fill="#25F4EE" d="M16 6.2c.5 1.2 1.5 2.06 2.8 2.25v2.2c-1 0-2-.3-2.8-.83v4.4a4 4 0 1 1-4-4c.2 0 .4.01.6.04v2.23a1.86 1.86 0 1 0 1.3 1.77V5.8H16z" />
          <path transform="translate(.7 .6)" fill="#FE2C55" d="M16 6.2c.5 1.2 1.5 2.06 2.8 2.25v2.2c-1 0-2-.3-2.8-.83v4.4a4 4 0 1 1-4-4c.2 0 .4.01.6.04v2.23a1.86 1.86 0 1 0 1.3 1.77V5.8H16z" />
          <path fill="#fff" d="M16 6.2c.5 1.2 1.5 2.06 2.8 2.25v2.2c-1 0-2-.3-2.8-.83v4.4a4 4 0 1 1-4-4c.2 0 .4.01.6.04v2.23a1.86 1.86 0 1 0 1.3 1.77V5.8H16z" />
        </svg>
      );
    case "linkedinPartnerId": // LinkedIn Insight
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="5.5" fill="#0A66C2" />
          <path fill="#fff" d="M7 9.6H4.7V19H7V9.6zM5.85 5.6a1.36 1.36 0 1 0 0 2.72 1.36 1.36 0 0 0 0-2.72zM19.3 19v-5.15c0-2.55-1.36-3.74-3.18-3.74-1.47 0-2.12.81-2.49 1.38V9.6h-2.3c.03.65 0 9.4 0 9.4h2.3v-5.25c0-.28.02-.56.1-.76.23-.56.74-1.14 1.6-1.14 1.13 0 1.58.86 1.58 2.12V19h2.38z" />
        </svg>
      );
    case "pinterestTagId": // Pinterest Tag
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="11.5" fill="#E60023" />
          <path fill="#fff" d="M12.4 5.3c-4 0-6.1 2.7-6.1 5 0 1.4.5 2.6 1.7 3.1.2.08.35 0 .4-.2.04-.15.13-.5.17-.66.06-.2.04-.27-.1-.44-.36-.43-.6-1-.6-1.78 0-2.3 1.72-4.35 4.5-4.35 2.45 0 3.8 1.5 3.8 3.5 0 2.64-1.17 4.86-2.9 4.86-.96 0-1.67-.8-1.44-1.77.27-1.17.8-2.42.8-3.26 0-.75-.4-1.38-1.24-1.38-.98 0-1.78 1.02-1.78 2.4 0 .87.3 1.46.3 1.46l-1.18 5c-.35 1.5-.05 3.32-.03 3.5.01.1.14.13.2.05.08-.1 1.12-1.4 1.47-2.68.1-.36.57-2.18.57-2.18.3.55 1.13 1.03 2.02 1.03 2.66 0 4.46-2.42 4.46-5.66 0-2.45-2.08-4.74-5.24-4.74z" />
        </svg>
      );
    case "googleSiteVerification": // Google Search Console
      return (
        <svg {...common}>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      );
    case "bingSiteVerification": // Bing Webmaster Tools
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="5.5" fill="#0C8484" />
          <path fill="#fff" d="M9 5.3l2.4.85V14l3-1.74-1.45-.65-.95-2.4 4.5 1.62v2.74L11.4 18.7 9 17.35V5.3z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.3" />
        </svg>
      );
  }
}
