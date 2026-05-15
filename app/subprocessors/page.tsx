import type { Metadata } from "next";

const LAST_UPDATED = "2026-05-03";

export const metadata: Metadata = {
  title: "Sub-processors — RightRev",
  description:
    "Third-party services RightRev engages to deliver the platform, the data each accesses, region, and DPA status.",
};

interface Subprocessor {
  name: string;
  purpose: string;
  data: string;
  region: string;
  dpa: "Signed" | "Pending" | "N/A — public service" | "Signed (under AWS DPA)";
}

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Amazon Web Services (AWS)",
    purpose: "Cloud hosting (compute, storage, database, encryption)",
    data: "All customer data + operational",
    region: "us-east-2 (Ohio, United States)",
    dpa: "Signed",
  },
  {
    name: "Groq",
    purpose: "LLM-based column-type inference; PII redacted before transmission",
    data: "Redacted column samples (no raw PII)",
    region: "United States",
    dpa: "Pending",
  },
  {
    name: "Intuit (QuickBooks)",
    purpose: "OAuth + ERP export (only when customer connects this provider)",
    data: "OAuth tokens + records the customer chooses to export",
    region: "United States",
    dpa: "Pending",
  },
  {
    name: "Zoho Books",
    purpose: "OAuth + ERP export (only when customer connects this provider)",
    data: "OAuth tokens + records the customer chooses to export",
    region: "United States / India",
    dpa: "Pending",
  },
  {
    name: "Snowflake",
    purpose: "Warehouse import/export (only when customer connects)",
    data: "OAuth tokens + tables the customer chooses to use",
    region: "Customer-chosen region",
    dpa: "Pending",
  },
  {
    name: "Google (Drive)",
    purpose: "File import (only when customer connects this provider)",
    data: "OAuth tokens + files the customer imports",
    region: "Multi-region",
    dpa: "Pending",
  },
  {
    name: "GitHub",
    purpose: "Source code + CI/CD",
    data: "No customer data; source + build artifacts",
    region: "United States",
    dpa: "N/A — public service",
  },
  {
    name: "AWS SES",
    purpose: "Transactional email (invites, password resets)",
    data: "Email addresses",
    region: "us-east-2 (Ohio, United States)",
    dpa: "Signed (under AWS DPA)",
  },
  {
    name: "AWS Cognito",
    purpose: "Identity + authentication (MFA, password)",
    data: "Email, password hash, MFA secret, login metadata",
    region: "us-east-2 (Ohio, United States)",
    dpa: "Signed (under AWS DPA)",
  },
];

function dpaClass(dpa: Subprocessor["dpa"]): string {
  if (dpa.startsWith("Signed")) {
    return "text-green-700 dark:text-green-400";
  }
  if (dpa === "Pending") {
    return "text-amber-700 dark:text-amber-400";
  }
  return "text-muted-foreground";
}

export default function SubprocessorsPage() {
  return (
    <main
      className="container mx-auto max-w-4xl py-10 px-6"
      aria-labelledby="subprocessors-title"
    >
      <h1 id="subprocessors-title" className="text-3xl font-bold mb-2">
        Sub-processors
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Last updated:{" "}
        <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
      </p>

      <p className="text-sm mb-6">
        We engage the following third parties to help deliver the Service.
        Material changes to this list are announced at least 30 days in
        advance via in-app banner and email to org admins.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            List of sub-processors, what each is used for, the data they
            access, the region they operate in, and the DPA status.
          </caption>
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="text-left p-3">Provider</th>
              <th scope="col" className="text-left p-3">Purpose</th>
              <th scope="col" className="text-left p-3">Data accessed</th>
              <th scope="col" className="text-left p-3">Region</th>
              <th scope="col" className="text-left p-3">DPA</th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name} className="border-t">
                <th scope="row" className="p-3 font-medium text-left">
                  {s.name}
                </th>
                <td className="p-3">{s.purpose}</td>
                <td className="p-3">{s.data}</td>
                <td className="p-3 whitespace-nowrap">{s.region}</td>
                <td className="p-3">
                  <span className={dpaClass(s.dpa)}>{s.dpa}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        To object to a sub-processor or request more detail, email{" "}
        <a className="underline" href="mailto:privacy@infiniqon.com">
          privacy@infiniqon.com
        </a>
        .
      </p>
    </main>
  );
}
