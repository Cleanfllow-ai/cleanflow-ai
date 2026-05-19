import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function WebhooksSettingsPage() {
	return (
		<ComingSoonPage
			feature="Webhooks"
			description="Configure outbound webhooks fired on DQ failure, run completion, or quarantine actions — wire RightRev into Slack, PagerDuty, or any generic HTTPS endpoint your team owns."
			eta="Q3 2026"
			bullets={[
				"Events: dq.failed, dq.completed, quarantine.row_fixed, export.completed",
				"Signed payloads (HMAC-SHA256) + replay protection",
				"Per-webhook retry policy + failure inspector",
				"Pre-built templates for Slack / PagerDuty",
			]}
			backHref="/admin"
			backLabel="Back to Admin"
		/>
	)
}
