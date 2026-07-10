import LegalPageLayout from "./LegalPageLayout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="May 2026"
      path="/legal/privacy"
      description="How Imagick.ai collects, uses and protects your data. We never use your photos to train AI models without your explicit consent."
    >
      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">Who we are</h2>
        <p>
          imagick.ai (&quot;we&quot;, &quot;us&quot;) provides AI-assisted photo editing tools
          to photographers. This page describes what personal data we collect,
          why we collect it, and how to exercise the rights you have over it
          under the GDPR and similar laws.
        </p>
        <p>
          For privacy-related questions, contact{" "}
          <a href="mailto:contact@imagick.ai" className="text-primary underline-offset-4 hover:underline">
            contact@imagick.ai
          </a>.
        </p>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">What we collect</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Account data</strong>: email, display name, password hash (managed by Supabase Auth).</li>
          <li><strong>Usage data</strong>: galleries you create, images you upload, AI styles you apply, edit counts.</li>
          <li><strong>Billing data</strong>: subscription plan, billing cycle, PayPal subscription IDs and invoice records. We do not store full payment details — those stay with PayPal.</li>
          <li><strong>Technical data</strong>: session tokens, IP address (transient), browser type, error reports collected via Sentry.</li>
          <li><strong>Email engagement</strong>: deliveries, opens and unsubscribes for the transactional emails we send via Resend.</li>
        </ul>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">How we use your data</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>To provide the service: rendering AI edits, hosting your galleries, sharing them with your clients.</li>
          <li>To bill you and to send transactional notifications (welcome, payment receipts, gallery-ready, etc.).</li>
          <li>To monitor reliability and security via Sentry alerts.</li>
          <li>To help you over email if you ask for support.</li>
        </ul>
        <p>
          We do not sell your data. We do not use your photos to train AI
          models without your explicit, separate consent.
        </p>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">Sub-processors</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Supabase</strong> — authentication, database hosting.</li>
          <li><strong>Backblaze B2</strong> — image storage.</li>
          <li><strong>PayPal</strong> — billing.</li>
          <li><strong>Resend</strong> — transactional email delivery.</li>
          <li><strong>Sentry</strong> — error monitoring.</li>
          <li><strong>Vercel</strong> — application hosting.</li>
        </ul>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">Your rights</h2>
        <p>You can:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Access / correct</strong> your account data from{" "}
            <a href="/dashboard/settings" className="text-primary underline-offset-4 hover:underline">Settings</a>.
          </li>
          <li><strong>Export</strong> a copy of your data — contact us and we will send a JSON archive within 30 days.</li>
          <li><strong>Delete</strong> your account and all associated data from{" "}
            <a href="/dashboard/settings" className="text-primary underline-offset-4 hover:underline">Settings → Delete account</a>. We will email a confirmation.
          </li>
          <li><strong>Opt out</strong> of non-essential emails from Settings.</li>
        </ul>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">Retention</h2>
        <p>
          We keep your account and gallery data for as long as your account is
          active. When you delete your account, all associated data is removed
          from our database and storage providers, except invoices that we are
          legally required to keep for accounting purposes.
        </p>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">Changes to this policy</h2>
        <p>
          We will notify users by email of any material change to this policy
          before it takes effect.
        </p>
      </section>
    </LegalPageLayout>
  );
}
