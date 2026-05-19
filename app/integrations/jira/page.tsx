import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function JiraIntegrationPage() {
	return (
		<ComingSoonPage
			feature="Jira Integration"
			description="Auto-create a Jira ticket on every DQ failure, with the failing rule, affected row count, and a deep link back to the quarantine — so triage stays in the place your data ops team already lives."
			eta="Q3 2026"
			bullets={[
				"Project + issue-type configurable per dataset",
				"Status sync (Jira closed → RightRev marks acknowledged)",
				"Custom field mapping for severity + owner",
			]}
			backHref="/integrations"
			backLabel="Back to Integrations"
		/>
	)
}
