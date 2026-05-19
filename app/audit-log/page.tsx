import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function AuditLogPage() {
	return (
		<ComingSoonPage
			feature="Audit Log"
			description="A filterable audit trail of every action — uploads, role changes, rule edits, quarantine fixes, exports — searchable by user, action, dataset, and date. Today partial audit data lives under Admin → Settings."
			eta="Q3 2026"
			bullets={[
				"Filter by user, action, dataset, date range",
				"Export to CSV / JSON for SOC 2 review",
				"WORM-style retention (write-once, no deletes)",
			]}
			backHref="/admin"
			backLabel="Back to Admin"
		/>
	)
}
