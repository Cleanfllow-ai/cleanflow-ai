export { connectorsAPI, default } from "./connectors-api"
export type { ConnectionStatus, ProviderInfo } from "./connectors-api"

export { erpConnectorsAPI } from "./erp-connectors-api"
export type {
  EntityInfo,
  EntityField,
  ERPImportResponse,
  ERPExportResponse,
  ERPExportStatusResponse,
  AutoMapResponse as ERPAutoMapResponse,
  MappingPreviewResponse,
} from "./erp-connectors-api"

export { warehouseConnectorsAPI } from "./warehouse-connectors-api"
export type {
  WarehouseMetadataItem,
  WarehouseColumn,
  WarehouseImportRequest,
  WarehouseImportResponse,
  WarehouseExportRequest,
  WarehouseExportResponse,
  AutoMapResponse as WarehouseAutoMapResponse,
} from "./warehouse-connectors-api"

export { storageConnectorsAPI } from "./storage-connectors-api"
export type {
  StorageFile,
  StorageFolder,
  StorageListResponse,
  StorageFoldersResponse,
  StorageImportResponse,
} from "./storage-connectors-api"
