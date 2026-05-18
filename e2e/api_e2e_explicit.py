"""End-to-end test driver with EXPLICIT column mapping (no auto-match).

Forked from api_e2e_test.py — accepts a hand-written mapping JSON file:

    python api_e2e_explicit.py \
        --source-provider zohobooks --source-entity customers \
        --dest-provider quickbooks --dest-entity customers \
        --mapping-json C:/tmp_dt/agent_a/customers_z2q_mapping.json \
        --max-rows 50 \
        --out C:/tmp_dt/agent_a/customers_z2q.json

The mapping JSON is a flat dict: { "<source_field_key>": "<dest_field_key>", ... }
exactly what the BE expects as column_mapping. This skips the fuzzy name-match
in api_e2e_test.py because for the demo we want precise control over which
~15-20 columns get mapped.
"""
from __future__ import annotations

import argparse
import json
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


def run_one_direction(
    *,
    source_provider: str,
    source_entity: str,
    dest_provider: str,
    dest_entity: str,
    mapping: Dict[str, str],
    name_suffix: str = "",
    max_rows: Optional[int] = None,
    poll_timeout_s: int = 1500,
) -> Dict[str, Any]:
    print(f"\n=== {source_provider}/{source_entity} -> {dest_provider}/{dest_entity} ===")
    print(f"  explicit mapping ({len(mapping)} cols): {list(mapping.items())[:6]}...")

    name = f"e2e-explicit-{source_entity}-to-{dest_entity}-{int(time.time()) % 100000}{name_suffix}"
    print(f"  POST /jobs name={name}")
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

    print("  polling runs...")
    run = poll_run(job_id, timeout_s=poll_timeout_s)
    final_status = (run.get("status") or "").upper()
    duration = run.get("duration_ms")
    entity_results = run.get("entity_results", {})

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
    print(f"  FINAL: {final_status} ({duration}ms)")
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
    p.add_argument("--mapping-json", required=True,
                   help="Path to JSON file with explicit {source_key: dest_key} mapping")
    p.add_argument("--poll-timeout-seconds", type=int, default=1500)
    p.add_argument("--max-rows", type=int, default=50)
    p.add_argument("--out", default="")
    args = p.parse_args()

    mapping = json.loads(Path(args.mapping_json).read_text())
    if not isinstance(mapping, dict) or not mapping:
        print("mapping JSON must be a non-empty {source: dest} dict", file=sys.stderr)
        return 2

    max_rows = args.max_rows if args.max_rows and args.max_rows > 0 else None

    result = run_one_direction(
        source_provider=args.source_provider,
        source_entity=args.source_entity,
        dest_provider=args.dest_provider,
        dest_entity=args.dest_entity,
        mapping=mapping,
        max_rows=max_rows,
        poll_timeout_s=args.poll_timeout_seconds,
    )

    if args.out:
        Path(args.out).write_text(json.dumps({"forward": result}, indent=2, default=str))
        print(f"\nWrote: {args.out}")

    return 0 if result["status"] in ("SUCCESS", "PARTIAL") else 1


if __name__ == "__main__":
    sys.exit(main())
