import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function DbtIntegrationPage() {
	return (
		<ComingSoonPage
			feature="dbt Package"
			description="A rightrev dbt package that lets you call RightRev DQ from a model's tests block and writes results back to dbt run_results.json — so failures show up alongside your existing dbt failures."
			eta="Q3 2026"
			bullets={[
				"rightrev_test('mart.fct_revenue') macro",
				"Auto-discover models + sources from manifest.json",
				"Snowflake / BigQuery / Redshift adapter support",
				"Fail dbt build on DQ FAIL (configurable severity)",
			]}
			backHref="/integrations"
			backLabel="Back to Integrations"
		/>
	)
}
