import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function UsagePage() {
	return (
		<ComingSoonPage
			feature="Usage & Cost"
			description="A per-pipeline cost dashboard — see how much each DQ run, dataset, or team costs in $ and compute-seconds, so you can budget DQ alongside your other infra."
			eta="Q3 2026"
			bullets={[
				"$ per DQ run, per dataset, per team",
				"Compute-second + LLM-token breakdown",
				"Budget caps + per-org / per-team alerts",
			]}
			backHref="/admin"
			backLabel="Back to Admin"
		/>
	)
}
