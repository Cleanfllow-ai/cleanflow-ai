/**
 * Unstructured Import module — barrel exports.
 *
 * Consumers should import from `@/modules/unstructured` rather than reaching
 * into subdirectories, so internal restructuring stays invisible.
 */

export { default as UnstructuredImportWizard } from "./components/UnstructuredImportWizard"
export { default as SourcePicker } from "./components/SourcePicker"
export { default as ScopeFilter } from "./components/ScopeFilter"
export { default as SchemaSelector } from "./components/SchemaSelector"
export { default as AugmentationRuleEditor } from "./components/AugmentationRuleEditor"
export { default as JobRunView } from "./components/JobRunView"
export { default as JobHistoryTable } from "./components/JobHistoryTable"

export { unstructuredApi } from "./api/unstructured-api"
export { useUnstructuredSSE } from "./hooks/useUnstructuredSSE"

export type {
  UnstructuredConnector,
  UnstructuredFileRecord,
  UnstructuredFileStatus,
  UnstructuredFilterMode,
  UnstructuredJob,
  UnstructuredJobCounts,
  UnstructuredJobCreateResponse,
  UnstructuredJobFilter,
  UnstructuredJobListResponse,
  UnstructuredJobResultResponse,
  UnstructuredJobSource,
  UnstructuredJobSpec,
  UnstructuredJobStatus,
  UnstructuredLogEvent,
  UnstructuredLogEventKind,
  UnstructuredSchemaId,
  UnstructuredSchemaInfo,
} from "./types/unstructured.types"
export { UNSTRUCTURED_SCHEMAS } from "./types/unstructured.types"
