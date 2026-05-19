import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function LineagePage() {
	return (
		<ComingSoonPage
			feature="Data Lineage"
			description="A raw → DQ → quarantine → fixed → export trail per upload_id, with hover-for-who-and-when at each hop — so governance, ML, and engineering all agree on what happened to a row."
			eta="Q3 2026"
			bullets={[
				"Graph view per upload_id (raw → DQ → quarantine → export)",
				"Per-edge actor + timestamp + audit trail",
				"Upstream / downstream impact analysis",
			]}
		/>
	)
}
