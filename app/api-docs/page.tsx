import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function ApiDocsPage() {
	return (
		<ComingSoonPage
			feature="REST API Documentation"
			description="A public OpenAPI 3.1 spec for the RightRev REST API, rendered as browsable Redoc + Swagger — so you can wire RightRev into your existing services without reverse-engineering the network tab."
			eta="Q3 2026"
			bullets={[
				"OpenAPI 3.1 spec served at /openapi.json",
				"Redoc browser at /api-docs (this page)",
				"API-key management UI in /admin → API Keys",
				"Versioned, deprecation-tracked endpoints",
			]}
		/>
	)
}
