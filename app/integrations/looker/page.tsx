import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function LookerIntegrationPage() {
	return (
		<ComingSoonPage
			feature="Looker Block"
			description="A drop-in Looker Block that surfaces RightRev DQ score + per-rule failure trend inline in your existing Looker dashboards — so a stakeholder asking 'is this data trustworthy?' gets the answer in one glance."
			eta="Q3 2026"
			bullets={[
				"Pre-built LookML model + sample dashboard",
				"shield.io-style DQ badge SVG endpoint",
				"Freshness API (GET /api/datasets/{id}/freshness)",
			]}
			backHref="/integrations"
			backLabel="Back to Integrations"
		/>
	)
}
