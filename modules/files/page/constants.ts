export const STATUS_OPTIONS = [
  { label: "All", value: "all", type: "status" },
  { label: "Uploaded", value: "UPLOADED", type: "status" },
  { label: "Processed", value: "DQ_FIXED", type: "status" },
  { label: "Processing", value: "DQ_RUNNING", type: "status" },
  { label: "Queued", value: "QUEUED", type: "status" },
  { label: "Failed", value: "FAILED", type: "status" },
  { label: "separator", value: "separator", type: "separator" },
  { label: "Excellent (90-100%)", value: "excellent", type: "quality" },
  { label: "Good (70-90%)", value: "good", type: "quality" },
  { label: "Bad (<70%)", value: "bad", type: "quality" },
] as const

export const SOURCE_OPTIONS = [
  { label: "Custom", value: "local" },
  { label: "Unified Bridge", value: "unified-bridge" },
] as const

export const DESTINATION_OPTIONS = [
  { label: "None", value: "null" },
  { label: "Custom", value: "local" },
  { label: "Unified Bridge", value: "unified-bridge" },
] as const

export const ERP_OPTIONS = [
  { label: "QUICKBOOKS ONLINE", value: "quickbooks" },
  { label: "ZOHO BOOKS", value: "zoho-books" },
  { label: "ORACLE FUSION", value: "oracle" },
  { label: "SAP", value: "sap" },
  { label: "MICROSOFT DYNAMICS", value: "dynamics" },
  { label: "NETSUITE", value: "netsuite" },
  { label: "WORKDAY", value: "workday" },
  { label: "INFOR M3", value: "infor-m3" },
  { label: "INFOR LN", value: "infor-ln" },
  { label: "EPICOR KINETIC", value: "epicor" },
  { label: "QAD", value: "qad" },
  { label: "IFS CLOUD", value: "ifs" },
  { label: "SAGE INTACCT", value: "sage" },
  { label: "CUSTOM SOURCE", value: "custom-source" },
] as const

export const RULE_SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-700 border-red-500/20",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  info: "bg-blue-500/10 text-blue-700 border-blue-500/20",
}

