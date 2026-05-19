import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function SecurityPage() {
	return (
		<ComingSoonPage
			feature="Security & Trust"
			description="The single page your security team will read before signing — encryption posture, IAM model, audit-log retention, SSO/SCIM status, sub-processors, pen-test cadence, and vulnerability-disclosure policy."
			eta="Q3 2026"
			bullets={[
				"Encryption: KMS-CMK at rest, TLS 1.3 in transit",
				"SSO/SAML + SCIM (Okta, Google, Azure AD)",
				"Per-tenant data isolation + per-org KMS key (Enterprise)",
				"Pen-test summary + vulnerability-disclosure policy",
			]}
		/>
	)
}
