import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function DocsPage() {
	return (
		<ComingSoonPage
			feature="Developer Documentation"
			description="A unified developer docs site covering the REST API, Python SDK, dbt package, Airflow operator, webhooks, and rule authoring — the one URL you bookmark."
			eta="Q3 2026"
			bullets={[
				"REST API reference (OpenAPI 3.1)",
				"Python SDK guide (pip install rightrev)",
				"Rule-authoring cookbook + custom-rule examples",
				"Tutorials: dbt, Airflow, Snowflake, Looker, Datadog",
			]}
		/>
	)
}
