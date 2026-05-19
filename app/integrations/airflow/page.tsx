import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function AirflowIntegrationPage() {
	return (
		<ComingSoonPage
			feature="Apache Airflow Operator"
			description="A native Airflow operator that runs RightRev DQ inline in your DAG — so a DQ failure halts the pipeline before downstream tasks corrupt your warehouse."
			eta="Q3 2026"
			bullets={[
				"from rightrev.providers.airflow import RightRevValidateOperator",
				"XCom-pushed DQ score + failure summary",
				"Configurable on_failure_callback (Slack / PagerDuty)",
				"Async + deferrable mode for long-running DQ runs",
			]}
			backHref="/integrations"
			backLabel="Back to Integrations"
		/>
	)
}
