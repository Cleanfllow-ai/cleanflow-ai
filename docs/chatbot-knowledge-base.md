# CleanFlowAI - Product Requirements Document (PRD)

**Name**:CleanFlowAI
**Version**: 1.0  
**Date**: 2026-01-23  
**Owner**: CleanFlowAI

## 1. Overview

CleanFlowAI is a data quality (DQ) and transformation platform for ERP data. It ingests files (CSV, Excel, JSON, Parquet), profiles columns, suggests DQ rules (LLM-assisted), lets users select columns and configure rules, runs deterministic validation and auto-fix/quarantine pipelines, and delivers clean outputs and DQ reports. The system supports direct uploads and ERP connectors (QuickBooks) and offers export options with column selection and renaming.

## 2. Goals

- Provide a reliable DQ pipeline that scales across file sizes.
- Give users clear profiling insights and rule controls before processing.
- Support deterministic DQ execution with optional LLM guidance.
- Enable secure, traceable, per-file configurations stored in DynamoDB.
- Deliver clean, quarantine, and report artifacts for downstream use.

## 3. Non-Goals

- Executing arbitrary user-provided or LLM-generated code.
- Real-time streaming DQ on live data feeds.
- Full-feature ETL/ELT orchestration beyond DQ and light transformations.

## 4. Target Users and Personas

- **Data Operations Manager**: needs high-level DQ outcomes and auditability.
- **Data Analyst**: wants profiling, rule explanation, and safe overrides.
- **ERP Admin**: uploads or syncs ERP data and needs clean exports.

## 5. Key User Journeys

### 5.1 Upload and Process

- User authenticates via Cognito.
- User uploads a file (local, ERP, or unified bridge).
- File is registered in DynamoDB with status UPLOADED or VALIDATED.
- User selects columns, reviews profiling preview, configures rules, and starts processing.
- System runs DQ pipeline and updates status and metrics.

### 5.2 Profiling and Rules

- User opens column selection dialog.
- Column profiling preview (sampled) is displayed.
- User customizes rule settings:
  - Required fields (R1)
  - Disable rules globally or per column
  - Override rule suggestions per column
  - Create custom checks via prompt (LLM suggestion and approval)

### 5.3 Export and Download

- User downloads clean, quarantine, or full data.
- User can export with column selection and renaming.
- User can push to ERP after processing (where applicable).

## 6. Functional Requirements

### 6.1 Authentication and Authorization

- Use Cognito JWT tokens for all API requests.
- Authorize access by user_id (Cognito subject).

### 6.2 File Ingestion

- Accept CSV, Excel, JSON, Parquet, and compressed variants.
- Store raw files in S3 with metadata in DynamoDB.
- Allow presigned POST for uploads.
- Support ERP import via connector (QuickBooks).

### 6.3 Column Discovery and Profiling

- Provide GET /files/{id}/columns to list column names.
- Provide GET /files/{id}/profiling-preview to show sampled profiling.
- Profile metrics: type guess, confidence, null rate, unique ratio, timing.

### 6.4 Rule Management (Deterministic)

- Core rules R1-R34 are registered in dq_engine.
- User can:
  - Mark required columns (R1)
  - Disable rules globally
  - Disable rules per column
  - Override suggested rules per column
- Rule decisions are stored per file in DynamoDB and applied at execution.

### 6.5 Custom Checks (LLM Suggestion + Approval)

- Prompt-only flow with required column selection.
- LLM suggests rule definition in JSON (template + params).
- User must approve before rule is added to the file config.
- Approved custom rules are stored in DynamoDB and executed by dq_engine.
- Supported templates at execution time:
  - enum_list, regex_match, ip_address, email, phone, uuid, date_iso

### 6.6 Processing and Routing

- Step Functions orchestrates processing.
- Orchestrator routes by size:
  - Lambda DQ engine for small files (< ~1GB)
  - Glue Polars for mid-size (1GB - 50GB)
  - Glue Spark for large files (> 50GB)
- Output artifacts:
  - result.parquet
  - dq_report.json
- Update status and metrics in DynamoDB.

### 6.7 Export and Reports

- Download clean, quarantine, or full outputs via /export.
- Provide DQ report JSON for audit and UI insights.
- Preview data via /preview-data.

## 7. System Architecture

### 7.1 Frontend

- Next.js 15 (App Router), React 19, Tailwind, Radix UI.
- Main flows in production_frontend/app/files/page.tsx.
- API client in production_frontend/lib/api/file-management-api.ts.

### 7.2 Backend Services (AWS)

- API Gateway with Cognito authorizer.
- Lambda functions:
  - init_upload, list_uploads, delete_upload
  - file_processor (core API + rule handling)
  - file_validator (S3 trigger -> validation -> pipeline start)
  - dq_engine_processor (DQ Engine v2, LLM rule detection, custom rules)
  - download_handler, status_updater
  - erp_connector (QuickBooks), erp_integrator (unified ERP connector)
- Step Functions for orchestration.
- Glue jobs for normalization and DQ at scale.

### 7.3 Data Stores

- S3 data lake for raw, clean, quarantine, and reports.
- DynamoDB FileRegistry (CleanFlowAI-FileRegistry-V3).
- DynamoDB ERP connections table for OAuth tokens.

## 8. Data Model (DynamoDB - FileRegistry)

**Key**: user_id (PK), upload_id (SK)

**Fields** (partial):
- status, status_timestamp, uploaded_at
- s3_raw_key, s3_result_key, dq_report_s3
- selected_columns, required_columns, global_disabled_rules
- disable_rules, column_rules_override, custom_rules
- dq_score, rows_in/out/fixed/quarantined, engine

## 9. API Surface (Key Endpoints)

- POST /uploads
- GET /files
- GET /files/{id}/status
- POST /files/{id}/process
- GET /files/{id}/columns
- GET /files/{id}/profiling
- GET /files/{id}/profiling-preview
- POST /files/{id}/custom-rule-suggest
- GET /files/{id}/preview-data
- GET|POST /files/{id}/export
- GET /files/{id}/issues

## 10. DQ Engine Behavior

- Profiles columns and infers schema.
- Applies universal rules and LLM-suggested rules (if enabled).
- Applies user overrides and disables.
- Executes rules via deterministic templates.
- Produces DQ matrix with row statuses:
  - clean, fixed, quarantined

## 11. Security and Compliance

- Cognito auth for API.
- S3 access via presigned URLs.
- LLM secrets stored in env (Groq API key).
- No execution of arbitrary code from users or LLM outputs.

## 12. Observability and Monitoring

- CloudWatch Logs for Lambda and Glue.
- DQ reports stored in S3 for audit.
- DynamoDB fields track status and last_error.

## 13. Performance and Scaling

- Multi-engine routing by file size.
- Parallel column profiling and rule execution.
- Lambda memory 3GB for dq_engine_processor.
- Glue for heavy workloads and concurrency.

## 14. Risks and Mitigations

- **Risk**: LLM returns unsupported templates.
  - **Mitigation**: resolve to known templates, require approval.
- **Risk**: Token expiration in frontend without refresh.
  - **Mitigation**: implement refresh token flow if needed.
- **Risk**: Large file processing timeouts.
  - **Mitigation**: size-based routing to Glue/Spark.

## 15. Metrics of Success

- DQ processing success rate.
- Median processing time by file size tier.
- User adoption of profiling and rule customization.
- Reduction in quarantined rows after user rules.

## 16. Open Questions

- Should custom rule templates expand beyond current list?
- Should there be a shared rule library across datasets?
- Is refresh-token support required for long sessions?

---

**Document Version**: 1.0  
**Last Updated**: January 23, 2026
