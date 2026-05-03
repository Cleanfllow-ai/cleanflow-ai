"use client";

const _LAST_UPDATED = "2026-05-03";

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl py-10 px-6">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Last updated: {_LAST_UPDATED}
      </p>

      <section className="space-y-6 prose prose-sm dark:prose-invert">
        <p>
          These Terms govern your use of CleanFlowAI (the &quot;Service&quot;).
          By signing up or accessing the Service, you agree to these Terms.
        </p>

        <h2>1. The Service</h2>
        <p>
          CleanFlowAI is a multi-tenant data quality platform. We process
          files you upload, run validation rules, fix or quarantine bad
          rows, and export to your chosen destination (ERP, warehouse, etc.).
        </p>

        <h2>2. Your account</h2>
        <ul>
          <li>You must be 18 or older to use the Service.</li>
          <li>You&apos;re responsible for safeguarding your credentials and MFA factors.</li>
          <li>You may delete your account at any time (Settings → Privacy → Delete account).</li>
        </ul>

        <h2>3. Customer data</h2>
        <p>
          You retain all rights to data you upload. You grant us a limited
          license to process it for the sole purpose of providing the
          Service. We do NOT use your data to train AI models. We may
          briefly send sample column values to a third-party LLM (Groq)
          for column-type detection; PII patterns are redacted before
          transmission. See the{" "}
          <a href="/privacy" className="underline">Privacy Notice</a> for
          full detail.
        </p>

        <h2>4. Acceptable use</h2>
        <ul>
          <li>Do not use the Service to process data you don&apos;t have authority to process.</li>
          <li>Do not upload illegal content, malware, or infringing material.</li>
          <li>Do not attempt to bypass authentication, rate limits, or tenant isolation.</li>
          <li>Do not export bulk PII outside the lawful basis you established with your data subjects.</li>
        </ul>

        <h2>5. Subscription &amp; billing</h2>
        <p>
          Pricing tiers (Standard, Pro, Enterprise) are described on the
          pricing page. Fees are billed per organization. You may cancel at
          any time; refunds are pro-rated for unused service days under
          annual plans.
        </p>

        <h2>6. Service availability</h2>
        <p>
          We target 99.5% monthly uptime for the file ingest and DQ
          pipeline (see{" "}
          <a href="https://github.com/kparthiban-infiniqon/cleanflowai_aws/blob/main/docs/runbooks/SLO.md" className="underline">
            SLO doc
          </a>
          ). We are not liable for outages caused by upstream providers
          (AWS, Groq, your ERP) beyond commercially reasonable mitigation.
        </p>

        <h2>7. Termination</h2>
        <p>
          We may suspend or terminate accounts that violate these Terms or
          present a security/abuse risk. We&apos;ll provide reasonable
          notice unless emergency action is required.
        </p>

        <h2>8. Liability</h2>
        <p>
          To the maximum extent permitted by law, our aggregate liability
          for any claim arising from the Service is limited to the fees
          you paid in the 12 months preceding the claim.
        </p>

        <h2>9. Governing law</h2>
        <p>
          These Terms are governed by the laws of India. Disputes are
          subject to the exclusive jurisdiction of courts in Chennai,
          Tamil Nadu, unless otherwise required by mandatory consumer-
          protection law in your jurisdiction.
        </p>

        <h2>10. Changes</h2>
        <p>
          We may update these Terms from time to time. Material changes
          will be announced at least 30 days in advance.
        </p>

        <h2>11. Contact</h2>
        <p>
          Email <a href="mailto:legal@infiniqon.com">legal@infiniqon.com</a>{" "}
          with questions or notices.
        </p>
      </section>
    </div>
  );
}
