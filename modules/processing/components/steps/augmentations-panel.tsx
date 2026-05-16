// DTO types only — AugmentationsPanel component deleted; use AugmentationPipelineTab instead.

export type AugmentationMode = "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_ONE" | "MANY_TO_MANY"

export interface AugmentationConfig {
  mode: AugmentationMode  // inferred, sent to BE
  prompt_text: string
  preset_id?: string
  source_columns: string[]
  destination_columns: { name: string; is_new: boolean }[]
}
