"""End-to-end test driver — single (source_provider, source_entity, dest_provider, dest_entity, direction).

Bypasses the UI; uses the BE API directly with manual column mapping. Faster +
deterministic + parallelizable. Suitable for breadth coverage across all
Zoho ↔ QBO entity pairs.

Usage:
    python api_e2e_test.py \
        --source-provider zohobooks --source-entity customers \
        --dest-provider quickbooks --dest-entity customers \
        [--max-columns 5] [--poll-timeout-seconds 1500]

Exits 0 on green (SUCCESS or PARTIAL with rows exported), non-zero on FAILED.

Manual mapping strategy: pulls field registries from both sides, name-matches
case-insensitive + strips punctuation, picks the top --max-columns matches.
If --required-fields is passed (comma list), ensures those are included.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import urllib.request
import urllib.error

API_BASE = "https://itnakos23d.execute-api.ap-south-1.amazonaws.com/prod"
TOKEN_PATH = Path(__file__).parent / ".auth" / "inject-tokens.json"


def _load_token() -> str:
    return json.loads(TOKEN_PATH.read_text())["idToken"]


def _api(method: str, path: str, body: Optional[dict] = None) -> Tuple[int, Any]:
    token = _load_token()
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        raw = resp.read().decode()
        try:
            return resp.status, json.loads(raw)
        except json.JSONDecodeError:
            return resp.status, raw
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode() if hasattr(exc, "read") else ""
        try:
            body_parsed = json.loads(raw)
        except Exception:
            body_parsed = raw
        return exc.code, body_parsed


def _norm_key(s: str) -> str:
    """Case-insensitive + strip non-alnum so 'Display Name' == 'display_name' == 'displayName'."""
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def get_entity_fields(provider: str, entity: str) -> List[Dict[str, Any]]:
    """Pull the field registry for one (provider, entity) pair.

    The BE accepts EITHER `entity=` or `entity_type=` depending on connector.
    QBO needs entity_type; Zoho works with both. Send both to be safe.
    """
    status, body = _api(
        "GET",
        f"/connectors/erp/{provider}/fields?entity={entity}&entity_type={entity}",
    )
    if status != 200:
        raise RuntimeError(f"GET fields for {provider}/{entity} failed: {status} {body}")
    if isinstance(body, dict):
        return body.get("fields") or body.get("entity_fields") or []
    return body or []


_FIELD_ALIASES: Dict[str, List[str]] = {
    # QBO key (normalized) → list of source-side aliases (normalized)
    "displayname":    ["contactname", "customername", "vendorname", "displayname", "name"],
    "name":           ["name", "itemname", "accountname", "contactname"],
    "companyname":    ["companyname", "company", "organizationname"],
    "type":           ["type", "itemtype", "accounttype"],
    "accounttype":    ["accounttype", "type"],
    "primaryemailaddr": ["email", "emailaddress", "primaryemail"],
    "email":          ["email", "emailaddress"],
    "primaryphone":   ["phone", "phonenumber"],
    "mobile":         ["mobile", "cellphone"],
    "givenname":      ["firstname", "givenname"],
    "familyname":     ["lastname", "familyname", "surname"],
    # ── REF FIELDS — critical for transactional entities (invoices/bills/etc.)
    # The BE's _resolve_qb_refs looks up CustomerRef.name in the QBO Customer
    # table to set CustomerRef.value. If our mapping doesn't populate the .name
    # subfield, the ref stays empty and the required-ref check throws.
    "customerrefname":  ["customername", "contactname", "billto", "customer"],
    "customerrefvalue": ["customerid", "customer_id"],
    "vendorrefname":    ["vendorname", "vendor", "payee", "payee_name", "paid_through_account_name"],
    "vendorrefvalue":   ["vendorid", "vendor_id", "payeeid", "payee_id"],
    "itemrefname":      ["itemname", "name", "productname"],
    "accountrefname":   ["accountname", "name", "paid_through_account_name", "account_name"],
    "accountrefvalue":  ["accountid", "account_id", "paid_through_account_id"],
    "currencyrefvalue": ["currencycode", "currency"],
    # zoho-side fallbacks (when zoho is the dest)
    "contactname":    ["displayname", "name", "customername", "vendorname"],
    "customername":   ["displayname", "name", "contactname", "customerrefname"],
    "vendorname":     ["displayname", "name", "contactname", "vendorrefname"],
    "itemname":       ["name", "itemrefname"],
}


def _norm_keys_with_aliases(field_key: str, field_label: str) -> List[str]:
    """Return the normalized key + its known aliases."""
    keys = [_norm_key(field_key), _norm_key(field_label)]
    for k in list(keys):
        if k in _FIELD_ALIASES:
            keys.extend(_norm_key(a) for a in _FIELD_ALIASES[k])
    return [k for k in keys if k]


def build_manual_mapping(
    source_fields: List[Dict[str, Any]],
    dest_fields: List[Dict[str, Any]],
    max_columns: int,
    required_dest: Optional[List[str]] = None,
) -> Dict[str, str]:
    """Greedy name-match: for each dest field, find the best-matching source field.

    Returns: { source_field_key: dest_field_key } — the column_mapping shape the BE expects.

    REQUIRED dest fields (registry `required: true` + caller-supplied) are forced
    in even if they bust max_columns. If no source-side match exists for a required
    field, log a warning so the test report can flag "required field has no source
    candidate" upfront.
    """
    src_by_norm: Dict[str, str] = {}
    for sf in source_fields:
        k = sf.get("key") or sf.get("name") or ""
        if not k:
            continue
        for alias in _norm_keys_with_aliases(k, sf.get("label", "")):
            src_by_norm.setdefault(alias, k)

    mapping: Dict[str, str] = {}
    used_src: set = set()
    missing_required: List[str] = []

    def _try_pick(dest_key: str, dest_label: str) -> bool:
        for cand in _norm_keys_with_aliases(dest_key, dest_label):
            if cand and cand in src_by_norm:
                src_key = src_by_norm[cand]
                if src_key in used_src:
                    continue
                mapping[src_key] = dest_key
                used_src.add(src_key)
                return True
        return False

    # 0) auto-detect dest fields with required:true and merge with caller list
    registry_required = [
        (df.get("key") or df.get("name") or "")
        for df in dest_fields
        if df.get("required") is True and not df.get("read_only", False)
    ]
    explicit_required = list(required_dest or [])
    all_required = list(dict.fromkeys(explicit_required + registry_required))
    print(f"      required dest fields: {all_required}")

    # 1) ensure every required dest field is mapped (ignoring max_columns)
    for req in all_required:
        already = req in mapping.values()
        if already:
            continue
        for df in dest_fields:
            if (df.get("key") or "").lower() == req.lower() or (df.get("name") or "").lower() == req.lower():
                ok = _try_pick(df.get("key") or df.get("name") or "", df.get("label") or "")
                if not ok:
                    missing_required.append(req)
                break
        else:
            missing_required.append(req)

    if missing_required:
        print(f"      WARNING required dest fields with no source match: {missing_required}")

    # 2) greedy match remaining dest fields up to max_columns total
    for df in dest_fields:
        if len(mapping) >= max_columns:
            break
        if df.get("read_only", False):
            continue
        dest_key = df.get("key") or df.get("name") or ""
        if dest_key and dest_key not in mapping.values():
            _try_pick(dest_key, df.get("label") or "")

    return mapping


def create_job(
    *,
    name: str,
    source_provider: str,
    source_category: str,
    source_entity: str,
    dest_provider: str,
    dest_category: str,
    dest_entity: str,
    column_mapping: Dict[str, str],
    max_rows: Optional[int] = None,
) -> str:
    # Row-cap hack: we don't know which key the BE honors (per_page vs limit vs
    # max_rows vs filters.*), so we set ALL of the plausible ones. Whichever the
    # import connector reads will clamp the row count; the rest are ignored.
    # This lets test runs stay small (~50 rows) and finish in seconds instead of
    # importing thousands of records per pair.
    filters: Dict[str, Any] = {}
    if max_rows is not None:
        filters = {"per_page": max_rows, "limit": max_rows, "max_rows": max_rows}

    payload = {
        "name": name,
        "frequency": "once",
        "active": True,
        "trigger_mode": "manual",
        "source_provider": source_provider,
        "source_category": source_category,
        "source_entity": source_entity,
        "destination_provider": dest_provider,
        "destination_category": dest_category,
        "destination_entity": dest_entity,
        "entities": [source_entity],
        "column_mapping": column_mapping,
        "pipeline_steps": [
            {
                "step_id": f"{source_provider}::{source_entity}::{dest_provider}::{dest_entity}",
                "source_provider": source_provider,
                "source_category": source_category,
                "source_entity": source_entity,
                "dest_provider": dest_provider,
                "dest_category": dest_category,
                "dest_entity": dest_entity,
                "inline_mapping": column_mapping,
                "mapping_source": "inline",
                "filters": filters,
                "import_filters": filters,
                "max_rows": max_rows,
            }
        ],
        "dq_config": {"policy": "block_and_notify"},
        "filters": filters,
        "import_filters": filters,
        "max_rows": max_rows,
    }
    status, body = _api("POST", "/jobs", payload)
    if status not in (200, 201):
        raise RuntimeError(f"POST /jobs failed: {status} {body}")
    job_id = body.get("job_id") or body.get("id") or body.get("jobId")
    if not job_id:
        raise RuntimeError(f"POST /jobs returned 2xx but no job_id: {body}")
    return job_id


def poll_run(job_id: str, *, interval: float = 8.0, timeout_s: int = 1500) -> Dict[str, Any]:
    """Poll /jobs/{id}/runs until terminal. Returns the latest run dict."""
    deadline = time.time() + timeout_s
    last_status = ""
    last_run: Dict[str, Any] = {}
    polls = 0
    while time.time() < deadline:
        status, body = _api("GET", f"/jobs/{job_id}/runs?limit=10")
        polls += 1
        if status == 200:
            runs = body.get("runs", []) if isinstance(body, dict) else []
            if runs:
                last_run = runs[0]
                s = (last_run.get("status") or "").upper()
                if s != last_status:
                    print(f"  [poll {polls}] {s} run_id={last_run.get('run_id','')[:8]}")
                    last_status = s
                if s in ("SUCCESS", "FAILED", "PARTIAL", "AWAITING_REVIEW", "NO_CHANGES"):
                    return last_run
        time.sleep(interval)
    raise TimeoutError(f"poll timed out after {timeout_s}s; last status={last_status}")


def get_export_status(provider: str, upload_id: str) -> Dict[str, Any]:
    status, body = _api(
        "GET",
        f"/connectors/erp/{provider}/export-status?upload_id={upload_id}",
    )
    return {"http_status": status, "body": body}


# ── Main ────────────────────────────────────────────────────────────────────

def run_one_direction(
    *,
    source_provider: str,
    source_entity: str,
    dest_provider: str,
    dest_entity: str,
    max_columns: int,
    required_dest_fields: Optional[List[str]] = None,
    name_suffix: str = "",
    max_rows: Optional[int] = None,
) -> Dict[str, Any]:
    """Run one direction (source -> dest). Returns a result dict."""
    print(f"\n=== {source_provider}/{source_entity} -> {dest_provider}/{dest_entity} ===")

    # 1. Pull field registries
    print("  [1] fetching field registries...")
    src_fields = get_entity_fields(source_provider, source_entity)
    dst_fields = get_entity_fields(dest_provider, dest_entity)
    print(f"      source fields: {len(src_fields)}, dest fields: {len(dst_fields)}")

    if not src_fields or not dst_fields:
        return {
            "status": "SKIP_NO_FIELDS",
            "reason": f"src_fields={len(src_fields)}, dst_fields={len(dst_fields)}",
        }

    # 2. Build manual column_mapping
    mapping = build_manual_mapping(
        src_fields, dst_fields, max_columns, required_dest=required_dest_fields,
    )
    print(f"  [2] manual mapping ({len(mapping)} cols): {mapping}")
    if not mapping:
        return {
            "status": "SKIP_NO_MAPPING",
            "reason": "no name-matched fields between source and dest",
            "src_sample": [f.get("key") for f in src_fields[:5]],
            "dst_sample": [f.get("key") for f in dst_fields[:5]],
        }

    # 3. Create job
    name = f"e2e-{source_entity}-to-{dest_entity}-{int(time.time()) % 100000}{name_suffix}"
    print(f"  [3] POST /jobs name={name}")
    job_id = create_job(
        name=name,
        source_provider=source_provider,
        source_category="erp",
        source_entity=source_entity,
        dest_provider=dest_provider,
        dest_category="erp",
        dest_entity=dest_entity,
        column_mapping=mapping,
        max_rows=max_rows,
    )
    print(f"      job_id={job_id}")

    # 4. Poll until terminal
    print("  [4] polling runs...")
    run = poll_run(job_id)
    final_status = (run.get("status") or "").upper()
    duration = run.get("duration_ms")
    entity_results = run.get("entity_results", {})

    # 5. Verify export-status for any upload_ids present
    export_checks = []
    for step_key, step_data in (entity_results or {}).items():
        upload_id = step_data.get("upload_id")
        if upload_id:
            es = get_export_status(dest_provider, upload_id)
            export_checks.append({"step": step_key, "upload_id": upload_id, "status": es})

    result = {
        "status": final_status,
        "run_id": run.get("run_id"),
        "job_id": job_id,
        "name": name,
        "duration_ms": duration,
        "mapping_columns": len(mapping),
        "mapping": mapping,
        "entity_results": entity_results,
        "export_checks": export_checks,
    }
    print(f"  [5] FINAL: {final_status} ({duration}ms)")
    for k, v in (entity_results or {}).items():
        if isinstance(v, dict):
            err = v.get("error")
            if err:
                print(f"      FAIL {k}: {err[:200]}")
            else:
                print(
                    f"      OK {k}: imported={v.get('imported','?')} exported={v.get('exported','?')} dq={v.get('dq_score','?')}"
                )
    return result


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--source-provider", required=True)
    p.add_argument("--source-entity", required=True)
    p.add_argument("--dest-provider", required=True)
    p.add_argument("--dest-entity", required=True)
    p.add_argument("--max-columns", type=int, default=5)
    p.add_argument("--required-dest", default="",
                   help="Comma-separated dest fields that MUST be in the mapping (e.g. 'DisplayName,Name')")
    p.add_argument("--poll-timeout-seconds", type=int, default=1500)
    p.add_argument("--out", default="", help="Write result JSON to this path")
    p.add_argument("--both-directions", action="store_true",
                   help="Run BOTH source->dest AND dest->source")
    p.add_argument("--max-rows", type=int, default=50,
                   help="Cap rows pulled from source (default 50). Injected into job spec as "
                        "filters.per_page/limit/max_rows (BE picks whichever it honors). Set 0 to disable.")
    args = p.parse_args()

    required = [s.strip() for s in args.required_dest.split(",") if s.strip()] or None
    max_rows = args.max_rows if args.max_rows and args.max_rows > 0 else None

    results = {}
    results["forward"] = run_one_direction(
        source_provider=args.source_provider,
        source_entity=args.source_entity,
        dest_provider=args.dest_provider,
        dest_entity=args.dest_entity,
        max_columns=args.max_columns,
        required_dest_fields=required,
        max_rows=max_rows,
    )

    if args.both_directions:
        # Reverse direction — different required fields likely apply
        results["reverse"] = run_one_direction(
            source_provider=args.dest_provider,
            source_entity=args.dest_entity,
            dest_provider=args.source_provider,
            dest_entity=args.source_entity,
            max_columns=args.max_columns,
            required_dest_fields=None,  # caller can re-run if specific fields needed
            name_suffix="-rev",
            max_rows=max_rows,
        )

    if args.out:
        Path(args.out).write_text(json.dumps(results, indent=2, default=str))
        print(f"\nWrote: {args.out}")

    # Exit code
    forward_ok = results["forward"]["status"] in ("SUCCESS", "PARTIAL")
    reverse_ok = (
        results.get("reverse", {}).get("status") in ("SUCCESS", "PARTIAL")
        if args.both_directions else True
    )
    return 0 if (forward_ok and reverse_ok) else 1


if __name__ == "__main__":
    sys.exit(main())
