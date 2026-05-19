import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function LinearIntegrationPage() {
	return (
		<ComingSoonPage
			feature="Linear Integration"
			description="Auto-create a Linear issue on every DQ failure with the failing rule, affected rows, and a deep link to the quarantine row — keeping triage inside your existing engineering workflow."
			eta="Q3 2026"
			bullets={[
				"Team + label configurable per dataset",
				"Status sync (Linear Done → RightRev acknowledged)",
				"Priority mapping from DQ severity",
			]}
			backHref="/integrations"
			backLabel="Back to Integrations"
		/>
	)
}
