import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function OpenapiPage() {
	return (
		<ComingSoonPage
			feature="OpenAPI Specification"
			description="The machine-readable RightRev API specification (OpenAPI 3.1) will be served at /openapi.json — feed it into Postman, Insomnia, openapi-generator, or your IDE."
			eta="Q3 2026"
			bullets={[
				"OpenAPI 3.1 JSON + YAML",
				"Auto-generated client SDKs (Python, TypeScript, Go)",
				"Versioned, change-logged",
			]}
			backHref="/api-docs"
			backLabel="Back to API Docs"
		/>
	)
}
