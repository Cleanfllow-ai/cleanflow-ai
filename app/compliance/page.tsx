import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function CompliancePage() {
	return (
		<ComingSoonPage
			feature="Compliance Center"
			description="Downloadable SOC 2 Type II report, HIPAA / BAA documentation, GDPR + DSAR workflow, pen-test summary, and a real-time controls dashboard — everything procurement and your governance lead need."
			eta="Q3 2026"
			bullets={[
				"SOC 2 Type II report (download with NDA)",
				"HIPAA / BAA documentation + signing flow",
				"GDPR + DSAR workflow (search → preview → 1-click purge + audit row)",
				"Pen-test summary + sub-processor list",
			]}
		/>
	)
}
