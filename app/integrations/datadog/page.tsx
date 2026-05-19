import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function DatadogIntegrationPage() {
	return (
		<ComingSoonPage
			feature="Datadog Integration"
			description="Push DQ score, run latency, and failure counts to Datadog as custom metrics — so your existing SRE dashboards include data quality alongside infra health."
			eta="Q3 2026"
			bullets={[
				"Custom metrics: rightrev.dq.score, rightrev.dq.latency_ms, rightrev.dq.failures",
				"Tagged by org, dataset, ruleset",
				"Sample Datadog dashboard template + monitor JSON",
			]}
			backHref="/integrations"
			backLabel="Back to Integrations"
		/>
	)
}
