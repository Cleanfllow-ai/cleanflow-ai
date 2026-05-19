import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function IntegrationsPage() {
	return (
		<ComingSoonPage
			feature="Integrations Hub"
			description="Native, push-based integrations with the tools your data team already lives in — so a DQ failure shows up where you'll see it."
			eta="Q3 2026"
			bullets={[
				"Slack + PagerDuty webhook on DQ failure",
				"Jira / Linear / GitHub Issues ticket auto-creation",
				"dbt package (rightrev_test macro) + Airflow operator",
				"Looker Block + Tableau extension + shield.io DQ badge",
				"Datadog metrics for DQ score, latency, failure count",
			]}
		/>
	)
}
