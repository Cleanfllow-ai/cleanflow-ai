/**
 * file-management-api.ts — Barrel file
 *
 * This file re-exports everything from the focused API modules so that
 * existing consumer imports (`from '@/modules/files'`) continue
 * working without changes.
 *
 * New code should import directly from the focused modules:
 *   - file-upload-api    — uploads, S3, polling, processing
 *   - file-dq-api        — DQ reports, issues, matrix
 *   - file-export-api    — downloads, exports, previews
 *   - file-profiling-api — column profiling
 *   - file-settings-api  — settings presets
 *   - file-ingestion-api — Unified Bridge ingestion
 */

// ─── Re-export types from modules/files/types ───
export type {
  FileUploadInitResponse,
  FileStatusResponse,
  FileListResponse,
  DqReportResponse,
  HybridSummary,
  OutstandingIssue,
  IssuesResponse,
  TopIssue,
  MonthlyDqStats,
  OverallDqReportResponse,
  ColumnProfileRule,
  CustomRuleDefinition,
  CustomRuleSuggestionResponse,
  SettingsPreset,
  ColumnProfile,
  CrossFieldRule,
  ColumnTypeOverride,
  ProfilingResponse,
  ColumnResponse,
  PreviewDataResponse,
  DownloadUrlsResponse,
  ExportResponse,
  ExportDownloadResult,
  QuarantineManifest,
  QuarantineSession,
  QuarantineRow,
  QuarantineManifestResponse,
  QuarantineSessionStartResponse,
  QuarantineQueryResponse,
  FileVersionSummary,
  FileVersionsResponse,
} from '@/modules/files/types'

// ─── Re-export functions from focused modules ───
export {
  makeRequest,
  initUpload,
  getUploads,
  getFileStatus,
  getFileColumns,
  deleteUpload,
  uploadToS3,
  uploadToS3Post,
  pollFileStatus,
  pollFileStatusSmart,
  startProcessing,
  suggestCustomRule,
  suggestCrossColumnRule,
  uploadFileComplete,
} from './file-upload-api'

export {
  downloadDqReport,
  downloadOverallDqReport,
  getFileIssues,
  getDQMatrix,
} from './file-dq-api'

export {
  downloadFileFromApi as downloadFile,
  exportWithColumns,
  getFilePreview,
  getFilePreviewFromS3,
} from './file-export-api'

export {
  getColumnProfiling,
  getColumnProfilingPreview,
} from './file-profiling-api'

export {
  getSettingsPresets,
  getSettingsPreset,
  createSettingsPreset,
  updateSettingsPreset,
  deleteSettingsPreset,
  getAuth,
} from './file-settings-api'

export {
  ingestFromFtp,
  ingestFromTcp,
  ingestFromHttp,
  uploadBinary,
  validateFtpConfig,
  testFtpConnection,
  validateTcpConfig,
  testTcpConnection,
  testHttpEndpoint,
} from './file-ingestion-api'

// Re-export ingestion types
export type {
  FtpIngestionConfig,
  TcpIngestionConfig,
  HttpIngestionConfig,
  IngestionResponse,
  UnifiedBridgeErp,
  UnifiedBridgeErpsResponse,
  UnifiedBridgeFile,
  UnifiedBridgeFilesResponse,
  UnifiedBridgeImportResponse,
} from './file-ingestion-api'

export {
  getQuarantinedExportUrl,
  getQuarantineManifest,
  startQuarantineSession,
  queryQuarantinedRows,
  saveQuarantineEditsBatch,
  submitQuarantineReprocess,
  reprocessQuarantinedLegacy,
  submitCompatibilityReprocessViaUpload,
  backfillQuarantineReadModel,
  getFileVersions,
  downloadQuarantineFile,
  isAuthorizerMismatchError,
  shouldUseLegacyFallback,
} from './file-quarantine-api'

// ─── Backwards-compatible singleton object ───
// Consumers that use `fileManagementAPI.someMethod()` can continue doing so.
import * as uploadApi from './file-upload-api'
import * as dqApi from './file-dq-api'
import * as exportApi from './file-export-api'
import * as profilingApi from './file-profiling-api'
import * as settingsApi from './file-settings-api'
import * as ingestionApi from './file-ingestion-api'
import * as quarantineApi from './file-quarantine-api'

export const fileManagementAPI = {
  // Upload & file management
  makeRequest: uploadApi.makeRequest,
  initUpload: uploadApi.initUpload,
  getUploads: uploadApi.getUploads,
  getFileStatus: uploadApi.getFileStatus,
  getFileColumns: uploadApi.getFileColumns,
  deleteUpload: uploadApi.deleteUpload,
  uploadToS3: uploadApi.uploadToS3,
  uploadToS3Post: uploadApi.uploadToS3Post,
  pollFileStatus: uploadApi.pollFileStatus,
  pollFileStatusSmart: uploadApi.pollFileStatusSmart,
  startProcessing: uploadApi.startProcessing,
  suggestCustomRule: uploadApi.suggestCustomRule,
  suggestCrossColumnRule: uploadApi.suggestCrossColumnRule,
  uploadFileComplete: uploadApi.uploadFileComplete,

  // DQ reports & issues
  downloadDqReport: dqApi.downloadDqReport,
  downloadOverallDqReport: dqApi.downloadOverallDqReport,
  getFileIssues: dqApi.getFileIssues,
  getDQMatrix: dqApi.getDQMatrix,

  // Export & download
  downloadFile: exportApi.downloadFileFromApi,
  exportWithColumns: exportApi.exportWithColumns,
  getFilePreview: exportApi.getFilePreview,
  getFilePreviewFromS3: exportApi.getFilePreviewFromS3,

  // Profiling
  getColumnProfiling: profilingApi.getColumnProfiling,
  getColumnProfilingPreview: profilingApi.getColumnProfilingPreview,

  // Settings
  getSettingsPresets: settingsApi.getSettingsPresets,
  getSettingsPreset: settingsApi.getSettingsPreset,
  createSettingsPreset: settingsApi.createSettingsPreset,
  updateSettingsPreset: settingsApi.updateSettingsPreset,
  deleteSettingsPreset: settingsApi.deleteSettingsPreset,
  getAuth: settingsApi.getAuth,

  // Ingestion
  ingestFromFtp: ingestionApi.ingestFromFtp,
  ingestFromTcp: ingestionApi.ingestFromTcp,
  ingestFromHttp: ingestionApi.ingestFromHttp,
  uploadBinary: ingestionApi.uploadBinary,
  validateFtpConfig: ingestionApi.validateFtpConfig,
  testFtpConnection: ingestionApi.testFtpConnection,
  validateTcpConfig: ingestionApi.validateTcpConfig,
  testTcpConnection: ingestionApi.testTcpConnection,
  testHttpEndpoint: ingestionApi.testHttpEndpoint,

  // Quarantine editor
  getQuarantinedExportUrl: quarantineApi.getQuarantinedExportUrl,
  getQuarantineManifest: quarantineApi.getQuarantineManifest,
  startQuarantineSession: quarantineApi.startQuarantineSession,
  queryQuarantinedRows: quarantineApi.queryQuarantinedRows,
  saveQuarantineEditsBatch: quarantineApi.saveQuarantineEditsBatch,
  submitQuarantineReprocess: quarantineApi.submitQuarantineReprocess,
  reprocessQuarantinedLegacy: quarantineApi.reprocessQuarantinedLegacy,
  submitCompatibilityReprocessViaUpload: quarantineApi.submitCompatibilityReprocessViaUpload,
  backfillQuarantineReadModel: quarantineApi.backfillQuarantineReadModel,
  getFileVersions: quarantineApi.getFileVersions,
  downloadQuarantineFile: quarantineApi.downloadQuarantineFile,
  isAuthorizerMismatchError: quarantineApi.isAuthorizerMismatchError,
  shouldUseLegacyFallback: quarantineApi.shouldUseLegacyFallback,
}

export default fileManagementAPI
