const DEFAULT_DARK_LOGO_URL =
  "https://nzfnqgmphepxgrjkkgkq.supabase.co/storage/v1/object/public/gallery-images/brand%2Fimagick-logo.png";

const RAW_TOKEN_REGEX = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export type LeadTokenVars = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  studio_url?: string | null;
  unsubscribe_url?: string | null;
};

export type LeadSenderProfile = "sapir" | "contact";

export interface LeadEmailRenderInput {
  senderProfile: LeadSenderProfile;
  subject: string;
  bodyHtml: string;
  unsubscribeUrl: string;
  studioUrl?: string;
  openPixelUrl?: string;
  logoUrl?: string;
  signatureLogoUrl?: string;
}

export interface LeadSenderConfig {
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

type PlatformSettingsResult = {
  data: Array<{ key: string; value: unknown }> | null;
  error: { message: string } | null;
};

type PlatformSettingsClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => Promise<PlatformSettingsResult>;
    };
  };
};

function sanitizeFirstName(value?: string | null): string {
  const clean = value?.trim();
  return clean ? clean : "there";
}

function sanitizeLastName(value?: string | null): string {
  return value?.trim() || "";
}

function sanitizeStudioUrl(value?: string | null): string {
  return (value?.trim() || "https://studio.imagick.ai").replace(/\/+$/, "");
}

export function normalizeLeadTokens(vars: LeadTokenVars): Record<string, string> {
  const firstName = sanitizeFirstName(vars.first_name);
  const lastName = sanitizeLastName(vars.last_name);
  const fullName = (vars.full_name?.trim() || `${firstName} ${lastName}`.trim()) || firstName;
  const studioUrl = sanitizeStudioUrl(vars.studio_url);
  const unsubscribeUrl = vars.unsubscribe_url?.trim() || `${studioUrl}/unsubscribe`;

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email: vars.email?.trim() || "",
    studio_url: studioUrl,
    unsubscribe_url: unsubscribeUrl,
  };
}

export function substituteLeadTokens(template: string, vars: LeadTokenVars): string {
  const normalized = normalizeLeadTokens(vars);
  return template.replace(RAW_TOKEN_REGEX, (_match, tokenName) => normalized[tokenName] ?? "");
}

export function renderLeadSubject(
  subjectTemplate: string,
  vars: LeadTokenVars,
  isReply: boolean,
): string {
  const substituted = substituteLeadTokens(subjectTemplate || "", vars)
    .replace(RAW_TOKEN_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();
  const subject = substituted || "Quick question about your photo editing workflow";
  return ensureReplyPrefix(subject, isReply);
}

function escAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function tinyUnsubscribeFooter(unsubscribeUrl: string) {
  return `
    <p style="margin:22px 0 0;font-size:10px;line-height:1.45;color:#9e99ab;">
      No commitment, no lock-in.
      <a href="${escAttr(unsubscribeUrl)}" style="color:#e85c9b;text-decoration:underline;">Unsubscribe</a>
    </p>
  `;
}

function leadCtaBlock(studioUrl: string) {
  const ctaUrl = `${studioUrl}/auth`;
  return `
    <div style="margin:26px 0 0;">
      <a href="${escAttr(ctaUrl)}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:linear-gradient(90deg,#e85c9b 0%,#9a5be8 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:1.2;">
        Start your free trial
      </a>
      <p style="margin:10px 0 0;font-size:13px;color:#66637a;">
        Prefer a direct link?
        <a href="${escAttr(ctaUrl)}" style="color:#7e3fd4;text-decoration:underline;">Open Studio</a>
      </p>
    </div>
  `;
}

export function ensureReplyPrefix(subject: string, isReply: boolean): string {
  if (!isReply) return subject;
  if (/^re:/i.test(subject.trim())) return subject;
  return `RE: ${subject}`;
}

export function resolveLeadSender(profile: LeadSenderProfile): LeadSenderConfig {
  if (profile === "sapir") {
    return {
      fromName: "Sapir Cohen",
      fromEmail: "sapir@imagick.ai",
      replyTo: "sapir@imagick.ai",
    };
  }
  return {
    fromName: "Imagick.ai",
    fromEmail: "contact@imagick.ai",
    replyTo: "contact@imagick.ai",
  };
}

export async function resolveLeadBrandLogoUrl(client?: PlatformSettingsClient): Promise<string> {
  if (!client) return DEFAULT_DARK_LOGO_URL;

  try {
    const { data, error } = await client
      .from("platform_settings")
      .select("key, value")
      .in("key", ["logo_dark_full"]);

    if (error || !data?.length) return DEFAULT_DARK_LOGO_URL;

    const dark = data.find((row) => row.key === "logo_dark_full");
    if (typeof dark?.value === "string" && dark.value.trim()) {
      return dark.value.trim();
    }
  } catch {
    // fall through to default
  }

  return DEFAULT_DARK_LOGO_URL;
}

export async function resolveLeadSignatureLogoUrl(client?: PlatformSettingsClient): Promise<string> {
  if (!client) return DEFAULT_DARK_LOGO_URL;

  try {
    const { data, error } = await client
      .from("platform_settings")
      .select("key, value")
      .in("key", ["logo_dark_full"]);

    if (error || !data?.length) return DEFAULT_DARK_LOGO_URL;

    const dark = data.find((row) => row.key === "logo_dark_full");
    if (typeof dark?.value === "string" && dark.value.trim()) {
      return dark.value.trim();
    }
  } catch {
    // fall through to default
  }

  return DEFAULT_DARK_LOGO_URL;
}

function wrapLeadLightShell(params: {
  subject: string;
  badgeLabel: string;
  bodyHtml: string;
  logoUrl: string;
  unsubscribeUrl: string;
  openPixelUrl?: string;
  signatureHtml?: string;
  studioUrl?: string;
}) {
  const { subject, badgeLabel, bodyHtml, logoUrl, unsubscribeUrl, openPixelUrl, signatureHtml, studioUrl } = params;
  const normalizedStudioUrl = sanitizeStudioUrl(studioUrl);
  const pixel = openPixelUrl
    ? `<img src="${escAttr(openPixelUrl)}" alt="" width="1" height="1" style="display:block;opacity:0;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escAttr(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ece9f2;font-family:'Inter',Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:34px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:690px;background:#ffffff;border:1px solid #e4e0ef;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#1a0a2e 0%,#0e0e17 100%);text-align:center;">
              <img src="${escAttr(logoUrl)}" alt="Imagick.ai" width="160" style="display:inline-block;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:34px 36px 30px;">
              <div style="display:inline-block;padding:4px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#e85c9b;border:1px solid #e6a3c4;">
                ${escAttr(badgeLabel)}
              </div>
              <div style="margin-top:18px;font-size:16px;line-height:1.68;color:#3f3f46;">
                ${bodyHtml}
              </div>
              ${leadCtaBlock(normalizedStudioUrl)}
              ${
                signatureHtml
                  ? `<div style="margin-top:22px;padding-top:14px;border-top:1px solid #ece8f3;">${signatureHtml}</div>`
                  : ""
              }
              ${pixel}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f5f3fa;border-top:1px solid #e4e0ef;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9a95a8;line-height:1.7;">
                © ${new Date().getFullYear()} Imagick.ai &nbsp;·&nbsp;
                <a href="https://imagick.ai" style="color:#5f5a70;text-decoration:none;">imagick.ai</a>
              </p>
              ${tinyUnsubscribeFooter(unsubscribeUrl)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function wrapContactEmail(
  subject: string,
  bodyHtml: string,
  unsubscribeUrl: string,
  logoUrl: string,
  openPixelUrl?: string,
  studioUrl?: string,
) {
  return wrapLeadLightShell({
    subject,
    badgeLabel: "Imagick.ai Update",
    bodyHtml,
    logoUrl,
    unsubscribeUrl,
    openPixelUrl,
    studioUrl,
  });
}

function wrapSapirEmail(
  subject: string,
  bodyHtml: string,
  unsubscribeUrl: string,
  logoUrl: string,
  signatureLogoUrl: string,
  openPixelUrl?: string,
  studioUrl?: string,
) {
  const signatureHtml = `
    <table role="presentation" cellspacing="0" cellpadding="0">
      <tr>
        <td style="padding-right:12px;vertical-align:middle;">
          <img src="${escAttr(signatureLogoUrl)}" alt="Imagick.ai" width="92" style="display:block;height:auto;" />
        </td>
        <td style="vertical-align:middle;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#15151d;">Sapir Cohen</p>
          <p style="margin:2px 0 0 0;font-size:12px;color:#6b667b;">Sales Manager, Imagick.ai</p>
          <p style="margin:2px 0 0 0;font-size:12px;"><a href="mailto:sapir@imagick.ai" style="color:#e85c9b;text-decoration:none;">sapir@imagick.ai</a></p>
        </td>
      </tr>
    </table>
  `;

  return wrapLeadLightShell({
    subject,
    badgeLabel: "Message from Sapir",
    bodyHtml,
    logoUrl,
    unsubscribeUrl,
    openPixelUrl,
    signatureHtml,
    studioUrl,
  });
}

export function renderLeadCampaignEmail(input: LeadEmailRenderInput) {
  const logoUrl = input.logoUrl || DEFAULT_DARK_LOGO_URL;
  const signatureLogoUrl = input.signatureLogoUrl || DEFAULT_DARK_LOGO_URL;
  const studioUrl = input.studioUrl || "https://studio.imagick.ai";
  if (input.senderProfile === "sapir") {
    return wrapSapirEmail(
      input.subject,
      input.bodyHtml,
      input.unsubscribeUrl,
      logoUrl,
      signatureLogoUrl,
      input.openPixelUrl,
      studioUrl,
    );
  }
  return wrapContactEmail(input.subject, input.bodyHtml, input.unsubscribeUrl, logoUrl, input.openPixelUrl, studioUrl);
}
