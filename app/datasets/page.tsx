import { ComingSoonPage } from "@/shared/components/coming-soon-page"

export default function DatasetsPage() {
	return (
		<ComingSoonPage
			feature="Datasets View"
			description="A dataset-first view of every CSV / Parquet / warehouse table you've onboarded — with the latest DQ score, failure trend, owner, and freshness alongside it. Today the same data lives under Data Catalog → Files."
			eta="Q3 2026"
			bullets={[
				"Group by source (file / Snowflake / Drive)",
				"Per-dataset owner + SLA + freshness",
				"shield.io DQ badge SVG embed per dataset",
			]}
			backHref="/files"
			backLabel="Go to Data Catalog"
		/>
	)
}
