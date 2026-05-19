import Link from "next/link";
import type { Metadata } from "next";

const LAST_UPDATED = "2026-05-03";

export const metadata: Metadata = {
  title: "Privacy Notice — RightRev",
  description:
    "How RightRev processes personal data, your rights under GDPR + DPDPA, sub-processors, retention, and how to contact our DPO.",
};

export default function PrivacyNoticePage() {
  return (
    <main
      className="container mx-auto max-w-3xl py-10 px-6"
      aria-labelledby="privacy-title"
    >
      <h1 id="privacy-title" className="text-3xl font-bold mb-2">
        Privacy Notice
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Last updated:{" "}
        <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
      </p>

      <article className="space-y-6 prose prose-sm dark:prose-invert">
        <p>
          RightRev (&quot;we&quot;) provides a data quality platform that
          ingests, validates, and exports business data on behalf of our
          customers. This notice describes what personal data we process,
          why, and your rights under the General Data Protection
          Regulation (GDPR) and the Indian Digital Personal Data
          Protection Act 2023 (DPDPA).
        </p>

        <h2>1. Data we collect</h2>
        <ul>
          <li>
            <strong>Account data</strong> — your email, name, organization
            name and address, role, and Cognito identity (provided by
            you when signing up).
          </li>
          <li>
            <strong>Customer data</strong> — files you upload for data
            quality processing. These may contain PII about your
            customers/employees (emails, phone numbers, addresses, etc.).
          </li>
          <li>
            <strong>Connector tokens</strong> — OAuth access &amp; refresh
            tokens for third-party services (QuickBooks, Zoho, Snowflake,
            Google Drive). Stored encrypted in AWS Secrets Manager.
          </li>
          <li>
            <strong>Operational logs</strong> — request metadata, IP
            address, user-agent, audit trail of admin actions.
          </li>
        </ul>

        <h2>2. Why we process it (lawful basis)</h2>
        <ul>
          <li>
            <strong>Contractual necessity</strong> — to provide the data
            quality service you signed up for.
          </li>
          <li>
            <strong>Legitimate interests</strong> — security, abuse
            prevention, audit trail (SOC 2).
          </li>
          <li>
            <strong>Legal obligation</strong> — retention of audit logs
            per applicable law.
          </li>
        </ul>

        <h2>3. How long we keep it</h2>
        <ul>
          <li>Customer files: while the org subscription is active + 90 days noncurrent retention</li>
          <li>Audit logs (CloudTrail): 1 year</li>
          <li>Lambda execution logs: 1 year</li>
          <li>Connector OAuth tokens: until you disconnect, then deleted (7-day Secrets Manager recovery window)</li>
          <li>Account data: until account deletion (right to erasure)</li>
        </ul>

        <h2>4. Your rights</h2>
        <p>You can exercise the following rights at any time from the app:</p>
        <ul>
          <li>
            <strong>Access</strong> — download a JSON of all data we hold
            about you via <code>GET /me/data-export</code> (in-app:
            Settings → Privacy → Export my data).
          </li>
          <li>
            <strong>Erasure</strong> — delete your account via{" "}
            <code>DELETE /me/account</code> (in-app: Settings → Privacy →
            Delete account). Audit logs are retained per legal basis.
          </li>
          <li>
            <strong>Rectification</strong> — request a correction via{" "}
            <code>POST /me/data-correction</code>; reviewed within 30
            days per GDPR Art. 12(3).
          </li>
          <li>
            <strong>Portability</strong> — the export is machine-readable
            JSON suitable for migration.
          </li>
          <li>
            <strong>Objection / withdrawal of consent</strong> — email{" "}
            <a href="mailto:privacy@infiniqon.com">privacy@infiniqon.com</a>.
          </li>
        </ul>

        <h2>5. Sub-processors</h2>
        <p>
          We process your data through the following sub-processors. Each
          has signed a Data Processing Agreement (DPA) with us where
          required.
        </p>
        <p>
          See our{" "}
          <Link href="/subprocessors" className="underline">
            sub-processor list
          </Link>{" "}
          for the up-to-date inventory.
        </p>

        <h2>6. Data transfers</h2>
        <p>
          Your data is processed in AWS region <code>us-east-2</code>{" "}
          (Ohio, United States). Some sub-processors are based in the US
          (Groq, Intuit, GitHub) or globally; cross-border transfers to
          those rely on Standard Contractual Clauses or equivalent.
        </p>

        <h2>7. Security</h2>
        <p>
          We follow SOC 2 Type 2 controls including encryption in transit
          (TLS) and at rest (AES-256), least-privilege IAM, multi-factor
          auth, daily backups, and continuous monitoring (CloudTrail,
          GuardDuty, Config).
        </p>

        <h2>8. Contact</h2>
        <ul>
          <li>
            Privacy questions:{" "}
            <a href="mailto:privacy@infiniqon.com">privacy@infiniqon.com</a>
          </li>
          <li>
            Data Protection Officer:{" "}
            <a href="mailto:dpo@infiniqon.com">dpo@infiniqon.com</a>
          </li>
          <li>
            Indian DPDPA grievance officer:{" "}
            <a href="mailto:grievance@infiniqon.com">
              grievance@infiniqon.com
            </a>
          </li>
        </ul>

        <h2>9. Changes</h2>
        <p>
          Material changes to this notice will be announced via in-app
          banner and (where you&apos;re an account holder) by email at
          least 30 days before they take effect.
        </p>
      </article>
    </main>
  );
}
