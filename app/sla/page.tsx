import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function SlaPage() {
	return (
		<ComingSoonPage
			feature="SLA Dashboard"
			description="A per-dataset SLA dashboard — owner, target freshness, target DQ score, current status, breach history, and on-call rotation. Built for data ops managers running 10+ datasets across analysts."
			eta="Q3 2026"
			bullets={[
				"Per-dataset SLA: freshness, DQ score, owner",
				"Breach history + MTTR + on-call assignment",
				"Triage queue + kanban for failed runs",
			]}
		/>
	)
}
