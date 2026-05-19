import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function TableauIntegrationPage() {
	return (
		<ComingSoonPage
			feature="Tableau Extension"
			description="A Tableau dashboard extension that pulls RightRev DQ score + per-rule failure trend straight into the sheet — so a stakeholder asking 'is this trustworthy?' gets the answer without leaving Tableau."
			eta="Q3 2026"
			bullets={[
				"Tableau Server / Cloud compatible extension",
				"shield.io-style DQ badge SVG embed",
				"Freshness + row-count snapshot per dataset",
			]}
			backHref="/integrations"
			backLabel="Back to Integrations"
		/>
	)
}
