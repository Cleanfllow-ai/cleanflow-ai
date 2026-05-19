import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function WandbIntegrationPage() {
	return (
		<ComingSoonPage
			feature="Weights & Biases Integration"
			description="Log RightRev DQ scores to your W&B runs so data quality is visible in the same dashboard as your training metrics."
			eta="Q4 2026"
			bullets={[
				"wandb.log({'rightrev_dq_score': score})",
				"Per-feature DQ summary as a W&B Table",
				"Alert on DQ drift between runs",
			]}
			backHref="/integrations"
			backLabel="Back to Integrations"
		/>
	)
}
