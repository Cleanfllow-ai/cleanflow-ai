import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function PricingPage() {
	return (
		<ComingSoonPage
			feature="Pricing"
			description="Self-serve pricing pages are on the way. In the meantime, ping the team for a quote tailored to your dataset volume, integration needs, and compliance requirements."
			eta="Q3 2026"
			bullets={[
				"Starter (single workspace, CSV uploads, community support)",
				"Team (webhooks, integrations, SSO-lite, email support)",
				"Enterprise (SSO/SAML, SCIM, per-org KMS, SOC 2, BAA, dedicated CSM)",
			]}
		/>
	)
}
