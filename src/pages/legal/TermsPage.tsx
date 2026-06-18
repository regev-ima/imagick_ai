import LegalPageLayout from "./LegalPageLayout";

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="May 2026">
      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">01 · The service</h2>
        <p>
          imagick.ai provides cloud tools for AI-assisted photo editing,
          collection management, and client-gallery sharing. By creating an
          account you accept these terms.
        </p>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">02 · Your account</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>You must be at least 16 years old (or the age of digital consent in your country).</li>
          <li>You are responsible for keeping your credentials secure.</li>
          <li>One account per individual or organisation; no shared logins.</li>
        </ul>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">03 · Your content</h2>
        <p>
          You retain all rights to the photos and styles you upload. You grant
          us a limited license to host, process and display them solely to
          provide the service to you and the people you choose to share with.
          We do not use your content to train AI models without your separate,
          explicit consent.
        </p>
        <p>
          You confirm that you have the right to upload every photo you put on
          imagick.ai (e.g. you are the photographer or have a release from the
          subjects).
        </p>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">04 · Acceptable use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Upload illegal content, including CSAM, content that violates copyright, or anything that violates applicable law.</li>
          <li>Attempt to break, reverse-engineer or DDoS the service.</li>
          <li>Resell access without a written reseller agreement.</li>
          <li>Use the service to harass, defame, or infringe on others' rights.</li>
        </ul>
        <p>
          Violations may result in immediate suspension or termination of your
          account.
        </p>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">05 · Billing</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Paid plans are billed via PayPal on the cycle you select (monthly or yearly).</li>
          <li>You can cancel any time from Billing; access continues until the end of the paid period.</li>
          <li>Refunds are at our discretion and generally not provided for partial periods.</li>
          <li>If a payment fails, we will attempt to recover it and pause access if it remains unpaid.</li>
        </ul>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">06 · Service availability</h2>
        <p>
          We aim for high availability but the service is provided
          &quot;as is&quot;. We do not guarantee uninterrupted access. We may
          schedule maintenance and will give reasonable notice for major
          changes.
        </p>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">07 · Liability</h2>
        <p>
          To the maximum extent permitted by law, our liability is limited to
          the amount you have paid us in the 12 months preceding the claim. We
          are not liable for indirect or consequential losses (lost revenue,
          lost data, etc.).
        </p>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">08 · Termination</h2>
        <p>
          You can delete your account at any time from Settings. We may
          terminate accounts that violate these terms after a warning, or
          immediately for serious abuse. On termination, all your data is
          deleted as described in our{" "}
          <a href="/legal/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </a>.
        </p>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">09 · Changes to these terms</h2>
        <p>
          We will email you at least 14 days before a material change to these
          terms. Continued use after the change takes effect constitutes
          acceptance.
        </p>
      </section>

      <section>
        <h2 className="aura-microlabel mb-3 text-foreground/80">10 · Contact</h2>
        <p>
          Questions? Email{" "}
          <a href="mailto:contact@imagick.ai" className="text-primary underline-offset-4 hover:underline">
            contact@imagick.ai
          </a>.
        </p>
      </section>
    </LegalPageLayout>
  );
}
