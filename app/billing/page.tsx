import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function BillingPage() {
	return (
		<ComingSoonPage
			feature="Billing & Usage"
			description="A self-service billing portal — see your current plan, upcoming invoice, payment history, and download receipts. Need a custom contract or PO? Talk to sales."
			eta="Q3 2026"
			bullets={[
				"Current plan + next-invoice preview",
				"Payment method update + invoice download",
				"Per-org spend cap + budget alerts",
			]}
			backHref="/admin"
			backLabel="Back to Admin"
		/>
	)
}
