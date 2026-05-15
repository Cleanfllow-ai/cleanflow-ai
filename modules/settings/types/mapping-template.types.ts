// ─── Mapping Template types ──────────────────────────────────────────────────
// Re-export the canonical types from the API client. Match the structure of
// modules/files/types/settings.types.ts — public consumers import from here so
// the API module stays an internal implementation detail.

export type {
    MappingTemplate,
    MappingTemplateListFilters,
} from "@/modules/settings/api/mapping-templates-api"
