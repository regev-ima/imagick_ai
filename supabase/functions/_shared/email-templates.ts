/**
 * Imagick.ai — Branded email HTML templates.
 *
 * LIGHTROOM aesthetic: deep graphite backgrounds, royal-blue accent, subtle glow.
 * Sender identity
 *   Display name : no-reply@imagick.ai
 *   Reply-To     : contact@imagick.ai
 */

// ─── Design tokens ───────────────────────────────────────────────────────────

// Single source of truth for the studio URL. Reads from env (STUDIO_URL) so
// changing the domain is one secret update instead of a code change in every
// template.
const APP_URL = (() => {
  try {
    return ((globalThis as { Deno?: { env: { get: (k: string) => string | undefined } } }).Deno?.env.get("STUDIO_URL") || "https://app.imagick.ai").replace(/\/+$/, "");
  } catch {
    return "https://app.imagick.ai";
  }
})();

// Served from the app's own /public (white wordmark for the dark email header),
// so updating the brand logo is a repo change, not a Storage upload.
const LOGO_URL        = `${APP_URL}/email-logo.png`;
const BRAND_PRIMARY   = "#2C57F2"; // Royal Blue   hsl(227,88%,56%) — LIGHTROOM --primary
const BRAND_SECONDARY = "#3D67FF"; // Bright Blue  hsl(227,100%,62%) — LIGHTROOM --accent
const BRAND_GRADIENT  = `linear-gradient(135deg, ${BRAND_PRIMARY} 0%, ${BRAND_SECONDARY} 100%)`;
const HEADER_BG       = `linear-gradient(135deg, #1F2024 0%, #16171A 100%)`;
const LIGHT_BG        = "#F5F7FC";
const LIGHT_CARD      = "#ffffff";
const LIGHT_BORDER    = "#E1E6F0";
const LIGHT_TEXT      = "#18181b";
const LIGHT_MUTED     = "#52525b";
const DARK_BG         = "#16171A";
const DARK_CARD       = "#1F2024";
const DARK_BORDER     = "rgba(44,87,242,0.15)";
const DARK_TEXT       = "#E8E9ED";
const DARK_MUTED      = "#8A8C94";

// ─── Shared base CSS (inlined for email clients) ─────────────────────────────

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: ${LIGHT_TEXT}; background-color: ${LIGHT_BG}; -webkit-font-smoothing: antialiased; }
  .wrapper { background-color: ${LIGHT_BG}; padding: 40px 16px; }
  .card { background: ${LIGHT_CARD}; border: 1px solid ${LIGHT_BORDER}; border-radius: 20px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 8px 40px rgba(61,103,255,0.12), 0 2px 8px rgba(0,0,0,0.06); }

  /* Header */
  .header { background: ${HEADER_BG}; padding: 32px 32px 28px; text-align: center; position: relative; }
  .header::after { content: ''; display: block; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: ${BRAND_GRADIENT}; box-shadow: 0 0 12px rgba(44,87,242,0.6), 0 0 24px rgba(61,103,255,0.4); }
  .logo-text { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; background: ${BRAND_GRADIENT}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-shadow: none; filter: drop-shadow(0 0 10px rgba(44,87,242,0.5)); }
  .logo-dot { -webkit-text-fill-color: transparent; }

  /* Body */
  .body { padding: 36px 32px; }

  /* Badge */
  .badge { display: inline-block; padding: 4px 14px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 18px; background: linear-gradient(${LIGHT_CARD}, ${LIGHT_CARD}) padding-box, ${BRAND_GRADIENT} border-box; border: 1.5px solid transparent; background-clip: padding-box, border-box; color: ${BRAND_PRIMARY}; }

  /* Typography */
  .title { color: ${LIGHT_TEXT}; font-size: 24px; font-weight: 800; line-height: 1.25; margin-bottom: 12px; letter-spacing: -0.3px; }
  .title-grad { background: ${BRAND_GRADIENT}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .text { color: ${LIGHT_MUTED}; font-size: 15px; margin-bottom: 14px; }
  .text strong { color: ${LIGHT_TEXT}; font-weight: 600; }

  /* CTA Button */
  .cta-wrap { margin: 28px 0; text-align: left; }
  .cta-btn { display: inline-block; background: ${BRAND_GRADIENT}; color: #ffffff !important; text-decoration: none !important; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; letter-spacing: 0.2px; box-shadow: 0 4px 20px rgba(44,87,242,0.4), 0 2px 8px rgba(61,103,255,0.3); }

  /* Info Box */
  .info-box { background: rgba(61,103,255,0.06); border: 1px solid rgba(44,87,242,0.2); border-radius: 12px; padding: 18px 20px; margin: 18px 0; }
  .info-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
  .info-row:last-child { margin-bottom: 0; }
  .info-label { color: ${LIGHT_MUTED}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; min-width: 90px; }
  .info-value { color: ${LIGHT_TEXT}; font-size: 14px; font-weight: 500; }

  /* Divider */
  .divider { border: none; border-top: 1px solid ${LIGHT_BORDER}; margin: 22px 0; }

  /* Footer */
  .footer { background: #F0F3FA; border-top: 1px solid ${LIGHT_BORDER}; padding: 20px 32px; text-align: center; }
  .footer-text { color: #a0a0b0; font-size: 12px; line-height: 1.7; }
  .footer-link { color: ${BRAND_PRIMARY}; text-decoration: none; font-weight: 500; }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    body { background-color: ${DARK_BG} !important; color: ${DARK_TEXT} !important; }
    .wrapper { background-color: ${DARK_BG} !important; }
    .card { background: ${DARK_CARD} !important; border-color: ${DARK_BORDER} !important; box-shadow: 0 8px 40px rgba(44,87,242,0.1), 0 2px 8px rgba(0,0,0,0.5) !important; }
    .badge { background: linear-gradient(${DARK_CARD}, ${DARK_CARD}) padding-box, linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_SECONDARY}) border-box !important; color: ${BRAND_PRIMARY} !important; }
    .title { color: ${DARK_TEXT} !important; }
    .text { color: ${DARK_MUTED} !important; }
    .text strong { color: ${DARK_TEXT} !important; }
    .info-box { background: rgba(44,87,242,0.06) !important; border-color: rgba(44,87,242,0.18) !important; }
    .info-label { color: ${DARK_MUTED} !important; }
    .info-value { color: ${DARK_TEXT} !important; }
    .divider { border-color: ${DARK_BORDER} !important; }
    .footer { background: rgba(255,255,255,0.025) !important; border-color: ${DARK_BORDER} !important; }
    .footer-text { color: #55505f !important; }
    .footer-link { color: ${BRAND_PRIMARY} !important; }
  }
`;

// ─── Shared wrapper ───────────────────────────────────────────────────────────

function wrapTemplate(subject: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escHtml(subject)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <a href="https://imagick.ai" style="display:inline-block; text-decoration:none;">
          <img src="${LOGO_URL}" alt="Imagick.ai" width="140" height="auto" style="display:block; height:auto; max-height:40px; filter:drop-shadow(0 0 8px rgba(44,87,242,0.5));" />
        </a>
      </div>
      <div class="body">
        ${bodyHtml}
      </div>
      <div class="footer">
        <p class="footer-text">
          © ${new Date().getFullYear()} Imagick.ai &nbsp;·&nbsp;
          <a href="https://imagick.ai" class="footer-link">imagick.ai</a>
          &nbsp;·&nbsp;
          <a href="${APP_URL}/dashboard/settings" class="footer-link">Email preferences</a>
        </p>
        <p class="footer-text" style="margin-top:5px;">
          You're receiving this because you have an account at Imagick.ai.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Template functions ───────────────────────────────────────────────────────

export function welcomeEmailTemplate(name: string): { subject: string; html: string } {
  const subject = `${name.split(" ")[0] || name}, your AI editing studio is ready 🎉`;
  const firstName = escHtml(name.split(" ")[0] || name);
  const html = wrapTemplate(subject, `
    <div class="badge">Welcome to Imagick.ai</div>
    <h1 class="title">Hi ${firstName}, <span class="title-grad">you just joined the future of photo editing.</span></h1>
    <p class="text">Professional photographers are editing full wedding shoots in under 10 minutes. Batch-culling thousands of frames instantly. Sharing polished client galleries with a single link. Now it's your turn.</p>
    <p class="text" style="font-weight:600; color:${BRAND_PRIMARY};">Here's how to get your first results in the next 15 minutes:</p>
    <div style="margin: 20px 0;">
      <div style="display:flex; gap:14px; align-items:flex-start; margin-bottom:16px;">
        <div style="background:${BRAND_PRIMARY}; color:#fff; font-weight:800; font-size:13px; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-align:center; line-height:26px;">1</div>
        <div><p style="margin:0; font-weight:600; color:${BRAND_PRIMARY}; font-size:15px;">Train your style</p><p style="margin:4px 0 0; font-size:14px; color:${LIGHT_MUTED};">Upload 10–20 before/after photo pairs. The AI learns your exact look — colours, tones, mood — and replicates it every time.</p></div>
      </div>
      <div style="display:flex; gap:14px; align-items:flex-start; margin-bottom:16px;">
        <div style="background:${BRAND_PRIMARY}; color:#fff; font-weight:800; font-size:13px; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-align:center; line-height:26px;">2</div>
        <div><p style="margin:0; font-weight:600; color:${BRAND_PRIMARY}; font-size:15px;">Upload a shoot</p><p style="margin:4px 0 0; font-size:14px; color:${LIGHT_MUTED};">Create a collection, upload your RAW files, and let the AI apply your style automatically — in the time it takes to grab a coffee.</p></div>
      </div>
      <div style="display:flex; gap:14px; align-items:flex-start;">
        <div style="background:${BRAND_PRIMARY}; color:#fff; font-weight:800; font-size:13px; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-align:center; line-height:26px;">3</div>
        <div><p style="margin:0; font-weight:600; color:${BRAND_PRIMARY}; font-size:15px;">Wow your clients</p><p style="margin:4px 0 0; font-size:14px; color:${LIGHT_MUTED};">Share a beautiful, password-protected gallery. Your clients get a stunning viewing experience; you get more time to shoot.</p></div>
      </div>
    </div>
    <div class="cta-wrap">
      <a href="${APP_URL}/dashboard" class="cta-btn">Start editing now →</a>
    </div>
    <hr class="divider" />
    <p class="text" style="font-size:13px;">Questions? Ideas? Just hit reply — we read every message and we'd love to hear from you.</p>
    <p class="text" style="font-size:13px;">— The Imagick.ai team</p>
  `);
  return { subject, html };
}

export function galleryUploadCompleteTemplate(galleryName: string, imageCount: number, galleryUrl: string): { subject: string; html: string } {
  const subject = `Upload complete — "${galleryName}"`;
  const html = wrapTemplate(subject, `
    <div class="badge">Upload Complete</div>
    <h1 class="title">Your images are <span class="title-grad">uploaded!</span></h1>
    <p class="text">All <strong>${imageCount} image${imageCount === 1 ? "" : "s"}</strong> have been uploaded to <strong>"${escHtml(galleryName)}"</strong> and are now being processed by the AI.</p>
    <p class="text">You'll receive another email when editing is complete. This usually takes a few minutes.</p>
    <div class="cta-wrap">
      <a href="${escHtml(galleryUrl)}" class="cta-btn">View collection →</a>
    </div>
  `);
  return { subject, html };
}

export function galleryImagesReadyTemplate(galleryName: string, imageCount: number, galleryUrl: string): { subject: string; html: string } {
  const subject = `Your collection "${galleryName}" is ready!`;
  const html = wrapTemplate(subject, `
    <div class="badge">Editing Complete</div>
    <h1 class="title">✨ All images are <span class="title-grad">ready!</span></h1>
    <p class="text">The AI has finished editing all <strong>${imageCount} image${imageCount === 1 ? "" : "s"}</strong> in <strong>"${escHtml(galleryName)}"</strong>.</p>
    <p class="text">You can now review the results, choose your favourite edits, and share the gallery with your client.</p>
    <div class="cta-wrap">
      <a href="${escHtml(galleryUrl)}" class="cta-btn">Review my collection →</a>
    </div>
  `);
  return { subject, html };
}

export function styleTrainingStartedTemplate(styleName: string, styleUrl: string): { subject: string; html: string } {
  const subject = `Training started — "${styleName}"`;
  const html = wrapTemplate(subject, `
    <div class="badge">Training Started</div>
    <h1 class="title">Your style is being <span class="title-grad">trained</span> 🤖</h1>
    <p class="text">We've started training <strong>"${escHtml(styleName)}"</strong>. The AI is learning your unique look from the before/after pairs you provided.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Style</span>
        <span class="info-value">${escHtml(styleName)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value">Training in progress…</span>
      </div>
    </div>
    <p class="text">We'll email you the moment it's done and ready to use. Training usually takes between 30 minutes and a few hours.</p>
    <div class="cta-wrap">
      <a href="${escHtml(styleUrl)}" class="cta-btn">Check training progress →</a>
    </div>
  `);
  return { subject, html };
}

export function styleReadyTemplate(styleName: string, styleUrl: string): { subject: string; html: string } {
  const subject = `Your style "${styleName}" is ready!`;
  const html = wrapTemplate(subject, `
    <div class="badge">Style Ready</div>
    <h1 class="title">🎉 <span class="title-grad">"${escHtml(styleName)}"</span> is live!</h1>
    <p class="text">Your AI style has finished training and is ready to use. Apply it to any collection with one click.</p>
    <div class="cta-wrap">
      <a href="${escHtml(styleUrl)}" class="cta-btn">Use this style →</a>
    </div>
    <p class="text">To apply it, open a collection, tap the Styles panel, and select <strong>"${escHtml(styleName)}"</strong>. The AI will handle the rest.</p>
  `);
  return { subject, html };
}

export function reEditSubmittedTemplate(galleryName: string, imageCount: number, styleNames: string[], galleryUrl: string): { subject: string; html: string } {
  const subject = `Re-edit started — "${galleryName}"`;
  const stylesStr = styleNames.length > 0 ? styleNames.map(s => `"${s}"`).join(", ") : "selected styles";
  const html = wrapTemplate(subject, `
    <div class="badge">Re-Edit Started</div>
    <h1 class="title">Re-editing your images <span class="title-grad">✍️</span></h1>
    <p class="text">We've started re-editing <strong>${imageCount} image${imageCount === 1 ? "" : "s"}</strong> in <strong>"${escHtml(galleryName)}"</strong> with ${escHtml(stylesStr)}.</p>
    <p class="text">You'll receive an email when all edits are complete.</p>
    <div class="cta-wrap">
      <a href="${escHtml(galleryUrl)}" class="cta-btn">View collection →</a>
    </div>
  `);
  return { subject, html };
}

export function reEditCompleteTemplate(galleryName: string, imageCount: number, galleryUrl: string): { subject: string; html: string } {
  const subject = `Re-edit complete — "${galleryName}"`;
  const html = wrapTemplate(subject, `
    <div class="badge">Re-Edit Complete</div>
    <h1 class="title">✨ Re-edit is <span class="title-grad">done!</span></h1>
    <p class="text">All <strong>${imageCount} image${imageCount === 1 ? "" : "s"}</strong> in <strong>"${escHtml(galleryName)}"</strong> have been re-edited and are ready to review.</p>
    <div class="cta-wrap">
      <a href="${escHtml(galleryUrl)}" class="cta-btn">Review results →</a>
    </div>
  `);
  return { subject, html };
}

export function accountDeletedTemplate(displayName: string, deletedAt: string): { subject: string; html: string } {
  const subject = "Your imagick.ai account has been deleted";
  const html = wrapTemplate(subject, `
    <div class="badge">Account Deleted</div>
    <h1 class="title">Goodbye${displayName ? `, <span class="title-grad">${escHtml(displayName)}</span>` : ""}</h1>
    <p class="text">We're confirming that your imagick.ai account has been permanently deleted on <strong>${escHtml(deletedAt)}</strong>.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">What's gone</span>
        <span class="info-value">All galleries, images, custom styles, billing records and subscriptions tied to your account.</span>
      </div>
      <div class="info-row">
        <span class="info-label">Active subscriptions</span>
        <span class="info-value">Cancelled with PayPal automatically.</span>
      </div>
    </div>
    <p class="text">Keep this email as proof of deletion. If this wasn't you, please contact us immediately at <a href="mailto:contact@imagick.ai">contact@imagick.ai</a>.</p>
  `);
  return { subject, html };
}

export function gallerySharedConfirmTemplate(galleryName: string, clientEmail: string, galleryUrl: string): { subject: string; html: string } {
  const subject = `Gallery sent to ${clientEmail}`;
  const html = wrapTemplate(subject, `
    <div class="badge">Gallery Shared</div>
    <h1 class="title">Your gallery has been <span class="title-grad">shared</span> 🔗</h1>
    <p class="text">A link to <strong>"${escHtml(galleryName)}"</strong> has been sent to <strong>${escHtml(clientEmail)}</strong>.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Gallery</span>
        <span class="info-value">${escHtml(galleryName)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Recipient</span>
        <span class="info-value">${escHtml(clientEmail)}</span>
      </div>
    </div>
    <div class="cta-wrap">
      <a href="${escHtml(galleryUrl)}" class="cta-btn">Preview gallery →</a>
    </div>
    <p class="text">You'll be notified when your client views or interacts with the gallery.</p>
  `);
  return { subject, html };
}

export function galleryClientInviteTemplate(clientName: string, photographerName: string, galleryName: string, galleryUrl: string, password?: string): { subject: string; html: string } {
  const subject = `Your gallery is ready — "${galleryName}"`;
  const displayName = clientName || "there";
  const html = wrapTemplate(subject, `
    <h1 class="title">Your photos are <span class="title-grad">ready</span> ✨</h1>
    <p class="text">Hi ${escHtml(displayName)},</p>
    <p class="text"><strong>${escHtml(photographerName || "Your photographer")}</strong> has shared your photo gallery <strong>"${escHtml(galleryName)}"</strong> with you.</p>
    <div class="cta-wrap">
      <a href="${escHtml(galleryUrl)}" class="cta-btn">View my gallery →</a>
    </div>
    ${password ? `
    <div class="info-box">
      <p class="text" style="margin-bottom:8px;">You'll need this password to access your gallery:</p>
      <div style="font-family:monospace; font-size:22px; font-weight:800; background: linear-gradient(135deg, ${BRAND_PRIMARY}, ${BRAND_SECONDARY}); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; letter-spacing:3px; text-align:center; padding:10px 0;">${escHtml(password)}</div>
    </div>
    ` : ""}
    <hr class="divider" />
    <p class="text" style="font-size:13px;">Inside the gallery you can browse all your photos, mark your favourites, and download the ones you love.</p>
    <p class="text" style="font-size:12px;">This link will remain active. Save it for future access.</p>
  `);
  return { subject, html };
}

export function subscriptionChangeTemplate(planName: string, changeType: "upgrade" | "downgrade" | "credits", creditsAdded?: number, billingUrl?: string): { subject: string; html: string } {
  const isCredits = changeType === "credits";
  const subject = isCredits
    ? `${creditsAdded} credits added to your account`
    : `Plan ${changeType === "upgrade" ? "upgraded" : "changed"} to ${planName}`;
  const html = wrapTemplate(subject, `
    <div class="badge">${isCredits ? "Credits Added" : "Plan Updated"}</div>
    <h1 class="title">${isCredits ? `🎉 <span class="title-grad">${creditsAdded} credits</span> added!` : `Plan updated to <span class="title-grad">${escHtml(planName)}</span>`}</h1>
    <p class="text">
      ${isCredits
        ? `<strong>${creditsAdded} credits</strong> have been added to your account and are available immediately.`
        : `Your subscription has been ${changeType === "upgrade" ? "upgraded" : "changed"} to the <strong>${escHtml(planName)}</strong> plan.`}
    </p>
    <div class="cta-wrap">
      <a href="${escHtml(billingUrl || `${APP_URL}/dashboard/billing`)}" class="cta-btn">View billing details →</a>
    </div>
    <p class="text">If you have any questions about your subscription, reply to this email and we'll help you out.</p>
  `);
  return { subject, html };
}

export function cullingReadyTemplate(galleryName: string, totalImages: number, topPicksCount: number, galleryUrl: string): { subject: string; html: string } {
  const subject = `AI Culling complete — "${galleryName}"`;
  const html = wrapTemplate(subject, `
    <div class="badge">Culling Complete</div>
    <h1 class="title">✅ AI Culling is done!</h1>
    <p class="text">The AI has finished analysing all <strong>${totalImages} photo${totalImages === 1 ? "" : "s"}</strong> in <strong>"${escHtml(galleryName)}"</strong>.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Total photos</span>
        <span class="info-value">${totalImages}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Top picks</span>
        <span class="info-value">${topPicksCount > 0 ? `${topPicksCount} photo${topPicksCount === 1 ? "" : "s"} rated "Best"` : "See results in your gallery"}</span>
      </div>
    </div>
    <p class="text">Open your collection to review the culling scores, filter by rating, and quickly choose your keepers.</p>
    <div class="cta-wrap">
      <a href="${escHtml(galleryUrl)}" class="cta-btn">Review culling results →</a>
    </div>
  `);
  return { subject, html };
}

export function passwordResetTemplate(resetUrl: string): { subject: string; html: string } {
  const subject = "Reset your Imagick.ai password";
  const html = wrapTemplate(subject, `
    <div class="badge">Password Reset</div>
    <h1 class="title">Reset your <span class="title-grad">password</span> 🔐</h1>
    <p class="text">We received a request to reset the password for your Imagick.ai account. Click the button below to choose a new password.</p>
    <div class="cta-wrap">
      <a href="${escHtml(resetUrl)}" class="cta-btn">Reset my password →</a>
    </div>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Expires in</span>
        <span class="info-value">1 hour</span>
      </div>
    </div>
    <p class="text">If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
  `);
  return { subject, html };
}

export function googleAccountTemplate(studioUrl: string): { subject: string; html: string } {
  const subject = "Sign in with Google — Imagick.ai";
  const sanitizedUrl = studioUrl.replace(/\/+$/, "");
  const html = wrapTemplate(subject, `
    <div class="badge">Account Info</div>
    <h1 class="title">Your account uses <span class="title-grad">Google Sign-In</span></h1>
    <p class="text">We received a password reset request for your email address, but your Imagick.ai account is linked to your <strong>Google account</strong> — it doesn't have a password.</p>
    <p class="text">To access your account, simply use the <strong>"Continue with Google"</strong> button on the sign-in page:</p>
    <div class="cta-wrap">
      <a href="${escHtml(sanitizedUrl)}/auth" class="cta-btn">Sign in with Google →</a>
    </div>
    <hr class="divider" />
    <p class="text" style="font-size:13px;">If you didn't request this, you can safely ignore this email — your account is secure.</p>
  `);
  return { subject, html };
}

export function gdImportStartedTemplate(galleryName: string, imageCount: number, galleryUrl: string): { subject: string; html: string } {
  const subject = `Import started — "${galleryName}"`;
  const html = wrapTemplate(subject, `
    <div class="badge">Import Started</div>
    <h1 class="title">Google Drive import <span class="title-grad">started</span> 📥</h1>
    <p class="text">We've started importing <strong>${imageCount} image${imageCount === 1 ? "" : "s"}</strong> from Google Drive into <strong>"${escHtml(galleryName)}"</strong>.</p>
    <p class="text">This may take a few minutes depending on the number and size of the files. We'll email you again once the import is complete.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Collection</span>
        <span class="info-value">${escHtml(galleryName)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Images</span>
        <span class="info-value">${imageCount}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Source</span>
        <span class="info-value">Google Drive</span>
      </div>
    </div>
    <div class="cta-wrap">
      <a href="${escHtml(galleryUrl)}" class="cta-btn">View collection →</a>
    </div>
  `);
  return { subject, html };
}

export function gdImportCompleteTemplate(galleryName: string, imageCount: number, galleryUrl: string): { subject: string; html: string } {
  const subject = `Import complete — "${galleryName}"`;
  const html = wrapTemplate(subject, `
    <div class="badge">Import Complete</div>
    <h1 class="title">All images <span class="title-grad">imported!</span> ✅</h1>
    <p class="text">All <strong>${imageCount} image${imageCount === 1 ? "" : "s"}</strong> from Google Drive have been imported into <strong>"${escHtml(galleryName)}"</strong>.</p>
    <p class="text">The AI is now processing your images. You'll receive another email when editing is complete.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Collection</span>
        <span class="info-value">${escHtml(galleryName)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Images</span>
        <span class="info-value">${imageCount}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value">AI processing started…</span>
      </div>
    </div>
    <div class="cta-wrap">
      <a href="${escHtml(galleryUrl)}" class="cta-btn">View collection →</a>
    </div>
  `);
  return { subject, html };
}

// ─── Journey Email Template ───────────────────────────────────────────────────
// Wraps admin-authored body HTML in the standard branded wrapper.
// Used by the process-journey edge function for lifecycle/sequence emails.

export function journeyEmailTemplate(
  subject: string,
  bodyHtml: string,
  unsubscribeUrl?: string
): { subject: string; html: string } {
  let body = bodyHtml;
  if (unsubscribeUrl) {
    body += `
    <hr class="divider" />
    <p class="text" style="font-size:12px; color:#a0a0b0; text-align:center;">
      <a href="${escHtml(unsubscribeUrl)}" style="color:#2C57F2; text-decoration:underline;">Unsubscribe</a> from marketing emails
    </p>`;
  }
  const html = wrapTemplate(subject, body);
  return { subject, html };
}

// ─── Journey-specific template generators (for send-test-email previews) ─────

export function journeyFirstGalleryTemplate(studioUrl: string): { subject: string; html: string } {
  return journeyEmailTemplate(
    'Ready to see the magic? Create your first gallery 📸',
    `<div class="badge">Getting Started</div>
<h1 class="title">Create your first <span class="title-grad">gallery</span> 📸</h1>
<p class="text">Hi Test User,</p>
<p class="text">You signed up for Imagick.ai — great choice! But the real magic starts when you upload your first photos.</p>
<div class="cta-wrap">
  <a href="${escHtml(studioUrl)}/dashboard/galleries/new" class="cta-btn">Create my first gallery →</a>
</div>`
  );
}

export function journeySocialProofTemplate(studioUrl: string): { subject: string; html: string } {
  return journeyEmailTemplate(
    'Photographers are editing 1,000+ photos in 10 minutes ⚡',
    `<div class="badge">What Others Are Doing</div>
<h1 class="title">See what other photographers are <span class="title-grad">creating</span> ⚡</h1>
<p class="text">Hi Test User,</p>
<p class="text">Photographers on Imagick.ai are editing 1,000+ photos in under 10 minutes with AI-powered style matching.</p>
<div class="cta-wrap">
  <a href="${escHtml(studioUrl)}/dashboard/galleries/new" class="cta-btn">Start now — it's free →</a>
</div>`
  );
}

export function journeyUploadMoreTemplate(studioUrl: string): { subject: string; html: string } {
  return journeyEmailTemplate(
    'Your gallery is looking good — add more photos! 📷',
    `<div class="badge">Keep Going</div>
<h1 class="title">Add more photos to <span class="title-grad">unlock the full power</span> 📷</h1>
<p class="text">Hi Test User,</p>
<p class="text">The more photos you upload, the better results you'll get from the AI.</p>
<div class="cta-wrap">
  <a href="${escHtml(studioUrl)}/dashboard/galleries" class="cta-btn">Upload more photos →</a>
</div>`
  );
}

export function journeyUpgradeTemplate(studioUrl: string): { subject: string; html: string } {
  return journeyEmailTemplate(
    "You're outgrowing the free plan — upgrade to Pro 🚀",
    `<div class="badge">Level Up</div>
<h1 class="title">Ready to go <span class="title-grad">Pro?</span> 🚀</h1>
<p class="text">Hi Test User,</p>
<p class="text">You've been using Imagick.ai and getting results. Upgrade to Pro for unlimited edits, AI culling, and priority support.</p>
<div class="cta-wrap">
  <a href="${escHtml(studioUrl)}/dashboard/billing" class="cta-btn">See Pro plans →</a>
</div>`
  );
}

export function journeyReEngagementTemplate(
  studioUrl: string,
  firstName = "there",
  unsubscribeUrl?: string,
): { subject: string; html: string } {
  return journeyEmailTemplate(
    'We miss you! Your AI editing studio is waiting 💜',
    `<div class="badge">We Miss You</div>
<h1 class="title">Your studio is <span class="title-grad">waiting for you</span> 💜</h1>
<p class="text">Hi ${escHtml(firstName)},</p>
<p class="text">It's been a while since you've edited on Imagick.ai. Your account is still active and your edits are waiting for you.</p>
<p class="text">Since you've been away we've shipped faster AI processing, better colour accuracy, and new tools like AI Culling and Smart Grouping.</p>
<div class="cta-wrap">
  <a href="${escHtml(studioUrl)}/dashboard" class="cta-btn">Come back to Imagick →</a>
</div>
<p class="text" style="font-size:13px;">If Imagick.ai isn't the right fit any more, no hard feelings — you can opt out below.</p>`,
    unsubscribeUrl,
  );
}

// ─── Billing / Subscription Templates ────────────────────────────────────────

export function subscriptionActivatedTemplate(
  planName: string,
  billingCycle: string,
  periodEnd: string,
  billingUrl: string,
): { subject: string; html: string } {
  const subject = `Welcome to ${planName} — your subscription is active!`;
  const cycleLabel = billingCycle === "yearly" ? "Annual" : "Monthly";
  const html = wrapTemplate(subject, `
    <div class="badge">Subscription Active</div>
    <h1 class="title">You're now on the <span class="title-grad">${escHtml(planName)}</span> plan!</h1>
    <p class="text">Your subscription is active and all premium features are unlocked. You now have <strong>unlimited AI edits</strong>.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Plan</span>
        <span class="info-value">${escHtml(planName)} (${cycleLabel})</span>
      </div>
      <div class="info-row">
        <span class="info-label">Next billing</span>
        <span class="info-value">${escHtml(periodEnd)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">AI Edits</span>
        <span class="info-value">Unlimited</span>
      </div>
    </div>
    <div class="cta-wrap">
      <a href="${escHtml(billingUrl)}" class="cta-btn">View billing details →</a>
    </div>
    <p class="text">Start uploading your shoots and let the AI handle the editing. If you have questions, just reply to this email.</p>
  `);
  return { subject, html };
}

export function subscriptionCancelledTemplate(
  planName: string,
  periodEnd: string,
  billingUrl: string,
): { subject: string; html: string } {
  const subject = `Your ${planName} subscription has been cancelled`;
  const html = wrapTemplate(subject, `
    <div class="badge">Subscription Cancelled</div>
    <h1 class="title">Your <span class="title-grad">${escHtml(planName)}</span> plan has been cancelled</h1>
    <p class="text">Your subscription will remain active until the end of your current billing period. After that, your account will revert to the Free plan.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Active until</span>
        <span class="info-value">${escHtml(periodEnd || "End of billing period")}</span>
      </div>
      <div class="info-row">
        <span class="info-label">After expiry</span>
        <span class="info-value">Free plan (limited edits)</span>
      </div>
    </div>
    <p class="text"><strong>What happens next:</strong></p>
    <p class="text">• You can continue using all ${escHtml(planName)} features until your plan expires<br/>• After expiry, uploads and AI editing will be paused<br/>• Your galleries will remain accessible in read-only mode<br/>• You can re-subscribe at any time to restore full access</p>
    <div class="cta-wrap">
      <a href="${escHtml(billingUrl)}" class="cta-btn">Resubscribe →</a>
    </div>
    <p class="text">Changed your mind? You can resubscribe anytime from your billing page.</p>
  `);
  return { subject, html };
}

export function subscriptionExpiredTemplate(
  planName: string,
  billingUrl: string,
): { subject: string; html: string } {
  const subject = `Your ${planName} subscription has expired`;
  const html = wrapTemplate(subject, `
    <div class="badge">Subscription Expired</div>
    <h1 class="title">Your <span class="title-grad">${escHtml(planName)}</span> plan has expired</h1>
    <p class="text">Your subscription period has ended and your account has been moved to the Free plan.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value">Expired — Free plan active</span>
      </div>
      <div class="info-row">
        <span class="info-label">Uploads</span>
        <span class="info-value">Paused</span>
      </div>
      <div class="info-row">
        <span class="info-label">Galleries</span>
        <span class="info-value">Read-only access</span>
      </div>
    </div>
    <p class="text">To restore unlimited AI edits, custom styles, and full storage, resubscribe from your billing page.</p>
    <div class="cta-wrap">
      <a href="${escHtml(billingUrl)}" class="cta-btn">Resubscribe now →</a>
    </div>
  `);
  return { subject, html };
}

export function paymentFailedTemplate(
  planName: string,
  billingUrl: string,
): { subject: string; html: string } {
  const subject = `Payment failed for your ${planName} plan`;
  const html = wrapTemplate(subject, `
    <div class="badge">Payment Failed</div>
    <h1 class="title">We couldn't process your <span class="title-grad">payment</span></h1>
    <p class="text">Your latest payment for the <strong>${escHtml(planName)}</strong> plan could not be processed. Your subscription has been temporarily suspended.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Plan</span>
        <span class="info-value">${escHtml(planName)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value">Suspended — payment required</span>
      </div>
    </div>
    <p class="text"><strong>What to do:</strong></p>
    <p class="text">• Check that your PayPal account has a valid payment method<br/>• PayPal will automatically retry the payment<br/>• If the issue persists, your subscription may be cancelled</p>
    <div class="cta-wrap">
      <a href="${escHtml(billingUrl)}" class="cta-btn">Update payment →</a>
    </div>
    <p class="text">Need help? Reply to this email and we'll assist you.</p>
  `);
  return { subject, html };
}

export function editsWarningTemplate(
  remaining: number,
  billingUrl: string,
): { subject: string; html: string } {
  const subject = `You have ${remaining} free edits remaining`;
  const urgency = remaining <= 100 ? "running very low" : "running low";
  const html = wrapTemplate(subject, `
    <div class="badge">Edits ${remaining <= 100 ? "Almost Gone" : "Running Low"}</div>
    <h1 class="title">Your free edits are <span class="title-grad">${urgency}</span></h1>
    <p class="text">You have <strong>${remaining} edits</strong> remaining out of your 3,000 lifetime free edits. Once they run out, you won't be able to upload or edit images until you upgrade.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Remaining</span>
        <span class="info-value">${remaining} edits</span>
      </div>
      <div class="info-row">
        <span class="info-label">After 0</span>
        <span class="info-value">Uploads + editing paused</span>
      </div>
    </div>
    <p class="text">Upgrade to any paid plan for <strong>unlimited AI edits</strong>, custom styles, and more storage — starting at just $9/month.</p>
    <div class="cta-wrap">
      <a href="${escHtml(billingUrl)}" class="cta-btn">Upgrade now →</a>
    </div>
  `);
  return { subject, html };
}

export function editsExhaustedTemplate(
  billingUrl: string,
): { subject: string; html: string } {
  const subject = "Your free edits have run out";
  const html = wrapTemplate(subject, `
    <div class="badge">Edits Exhausted</div>
    <h1 class="title">You've used all your <span class="title-grad">free edits</span></h1>
    <p class="text">You've used all 3,000 of your lifetime free edits. Uploading and AI editing are now paused on your account.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Remaining</span>
        <span class="info-value">0 edits</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value">Uploads + editing paused</span>
      </div>
      <div class="info-row">
        <span class="info-label">Galleries</span>
        <span class="info-value">Still accessible (read-only)</span>
      </div>
    </div>
    <p class="text">Upgrade to unlock <strong>unlimited AI edits</strong>, custom styles, and priority processing:</p>
    <div class="cta-wrap">
      <a href="${escHtml(billingUrl)}" class="cta-btn">Upgrade to unlock edits →</a>
    </div>
    <p class="text">Your existing galleries and images are safe — they'll remain accessible.</p>
  `);
  return { subject, html };
}

export function addonPurchasedTemplate(
  addonLabel: string,
  quantity: number,
  amount: string,
  billingUrl: string,
): { subject: string; html: string } {
  const subject = `Add-on purchased: ${quantity}x ${addonLabel}`;
  const html = wrapTemplate(subject, `
    <div class="badge">Add-on Purchased</div>
    <h1 class="title">Your add-on is <span class="title-grad">active!</span></h1>
    <p class="text">Your purchase has been processed and the add-on is now active on your account.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Add-on</span>
        <span class="info-value">${quantity}x ${escHtml(addonLabel)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Amount</span>
        <span class="info-value">$${escHtml(amount)}</span>
      </div>
    </div>
    <div class="cta-wrap">
      <a href="${escHtml(billingUrl)}" class="cta-btn">View billing →</a>
    </div>
  `);
  return { subject, html };
}

export function downgradeScheduledTemplate(
  currentPlan: string,
  targetPlan: string,
  switchDate: string,
  billingUrl: string,
): { subject: string; html: string } {
  const subject = `Plan change scheduled: ${currentPlan} to ${targetPlan}`;
  const html = wrapTemplate(subject, `
    <div class="badge">Downgrade Scheduled</div>
    <h1 class="title">Plan change <span class="title-grad">scheduled</span></h1>
    <p class="text">Your plan will be changed from <strong>${escHtml(currentPlan)}</strong> to <strong>${escHtml(targetPlan)}</strong> at the end of your current billing period.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Current plan</span>
        <span class="info-value">${escHtml(currentPlan)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">New plan</span>
        <span class="info-value">${escHtml(targetPlan)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Switch date</span>
        <span class="info-value">${escHtml(switchDate || "End of billing period")}</span>
      </div>
    </div>
    <p class="text">You'll continue to have full access to all ${escHtml(currentPlan)} features until the switch date. You can cancel this change from your billing page at any time.</p>
    <div class="cta-wrap">
      <a href="${escHtml(billingUrl)}" class="cta-btn">Manage billing →</a>
    </div>
  `);
  return { subject, html };
}

export function invoiceEmailTemplate(
  invoiceNumber: string,
  description: string,
  amount: number,
  invoiceUrl: string,
): { subject: string; html: string } {
  const subject = `Invoice ${invoiceNumber} — $${amount.toFixed(2)}`;
  const html = wrapTemplate(subject, `
    <div class="badge">Invoice</div>
    <h1 class="title">Invoice <span class="title-grad">${escHtml(invoiceNumber)}</span></h1>
    <p class="text">Here's your invoice for your recent Imagick.ai purchase.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Invoice #</span>
        <span class="info-value">${escHtml(invoiceNumber)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Description</span>
        <span class="info-value">${escHtml(description)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Amount</span>
        <span class="info-value">$${amount.toFixed(2)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value">Paid</span>
      </div>
    </div>
    <div class="cta-wrap">
      <a href="${escHtml(invoiceUrl)}" class="cta-btn">View invoice →</a>
    </div>
    <p class="text" style="font-size:13px;">This invoice is available in your billing dashboard at any time.</p>
  `);
  return { subject, html };
}

export function storageOverLimitTemplate(
  currentUsageGb: number,
  newLimitGb: number,
  billingUrl: string,
): { subject: string; html: string } {
  const subject = "Action required: storage exceeds your plan limit";
  const html = wrapTemplate(subject, `
    <div class="badge">Storage Warning</div>
    <h1 class="title">Your storage exceeds your <span class="title-grad">plan limit</span></h1>
    <p class="text">Your current storage usage (<strong>${currentUsageGb.toFixed(1)} GB</strong>) exceeds your plan's limit of <strong>${newLimitGb} GB</strong>. Please free up space or upgrade your plan to avoid disruption.</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Current usage</span>
        <span class="info-value">${currentUsageGb.toFixed(1)} GB</span>
      </div>
      <div class="info-row">
        <span class="info-label">Plan limit</span>
        <span class="info-value">${newLimitGb} GB</span>
      </div>
    </div>
    <p class="text">You can free up space by deleting unused galleries, or purchase additional storage from your billing page.</p>
    <div class="cta-wrap">
      <a href="${escHtml(billingUrl)}" class="cta-btn">Manage storage →</a>
    </div>
  `);
  return { subject, html };
}
