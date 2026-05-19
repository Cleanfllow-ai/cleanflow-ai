import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function MlflowIntegrationPage() {
	return (
		<ComingSoonPage
			feature="MLflow Integration"
			description="Push DQ scores to MLflow as run tags / metrics so train/val data quality is tracked alongside model metrics — and bad data never silently promotes a bad model."
			eta="Q4 2026"
			bullets={[
				"mlflow.log_metric('rightrev_dq_score', score)",
				"Per-feature null-rate + cardinality + drift tags",
				"Auto-block model registration on DQ FAIL",
				"Train/val drift detection (paired datasets)",
			]}
			backHref="/integrations"
			backLabel="Back to Integrations"
		/>
	)
}
