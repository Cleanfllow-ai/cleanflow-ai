import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function SdkPage() {
	return (
		<ComingSoonPage
			feature="Python SDK"
			description="pip install rightrev — a sync + async Python client that exposes profiling, validation, and quarantine APIs directly from your notebook or DAG. Returns pandas / polars DataFrames natively."
			eta="Q3 2026"
			bullets={[
				"client.profile(df) — column-level stats + type inference",
				"client.validate(df, rules=...) — returns failed-row DataFrame",
				"Sync + async + streaming for >1GB datasets",
				"Apache Airflow operator + dbt package bundled separately",
			]}
		/>
	)
}
