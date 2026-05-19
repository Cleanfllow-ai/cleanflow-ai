import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function DocsApiPage() {
	return (
		<ComingSoonPage
			feature="API Reference"
			description="Full REST API reference — endpoints, request/response schemas, error codes, and rate-limit guidance. Browse the spec or import into Postman / Insomnia."
			eta="Q3 2026"
			bullets={[
				"OpenAPI 3.1 spec available at /openapi.json",
				"Try-it-out via Redoc + Swagger UI",
				"Postman collection download",
			]}
			backHref="/docs"
			backLabel="Back to Docs"
		/>
	)
}
