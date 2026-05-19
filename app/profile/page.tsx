import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function ProfilePage() {
	return (
		<ComingSoonPage
			feature="User Profile"
			description="Self-service profile management — display name, avatar, notification preferences, API key management, and per-user MFA settings. Today, profile fields live under Admin → Users."
			eta="Q3 2026"
			bullets={[
				"Display name + avatar",
				"Notification preferences (email / Slack)",
				"Personal API keys + MFA settings",
			]}
			backHref="/admin"
			backLabel="Back to Admin"
		/>
	)
}
