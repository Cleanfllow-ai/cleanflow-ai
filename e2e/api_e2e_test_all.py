"""Run E2E tests for every Zoho<->QBO entity pair, sequentially with backoff.

Single-shot runner for tomorrow's testing once Zoho quota refreshes. Each pair
runs serially with 12s pacing between calls to stay UNDER Zoho's per-minute
burst limit (~100-200 req/min). Continues on failure — collects all results
into one consolidated report.

Usage:
    python e2e/api_e2e_test_all.py                       # both directions, all entities
    python e2e/api_e2e_test_all.py --direction z2q       # only Zoho -> QBO
    python e2e/api_e2e_test_all.py --direction q2z       # only QBO -> Zoho
    python e2e/api_e2e_test_all.py --only customers,vendors,items
    python e2e/api_e2e_test_all.py --report C:/tmp_dt/full_report.md

Behavior:
- Refreshes Cognito tokens at start (and every 30 min if run is long)
- Writes each pair's JSON result to C:/tmp_dt/results_<timestamp>/<pair>.json
- Writes a consolidated Markdown report at --report path (default in same dir)
- Exit 0 if every tested pair was SUCCESS|PARTIAL, exit 1 otherwise
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ── Test plan ───────────────────────────────────────────────────────────────
# Each tuple: (source_entity, dest_entity, max_columns, required_dest_fields, notes)
# When `source_entity == dest_entity`, the pair is run in both directions
# (zoho<->qbo); otherwise the names differ between providers (e.g. credit_notes
# <-> credit_memos) and we hard-wire them.
#
# Order matters: foundational entities (customers, vendors, items, accounts)
# go first so their records land in the destination, enabling FK resolution
# for transactional entities (invoices/bills/estimates that reference them).

PLAN: List[Dict] = [
    # ── Foundational (no FK deps) ──
    {"zoho": "customers",          "qbo": "customers",        "max_cols": 15, "required_qbo": "DisplayName",        "required_zoho": "contact_name",      "notes": "Proven working (46 rows verified)"},
    {"zoho": "vendors",            "qbo": "vendors",          "max_cols": 15, "required_qbo": "DisplayName",        "required_zoho": "contact_name",      "notes": "May fail on duplicate names if customers test polluted QBO sandbox"},
    {"zoho": "items",              "qbo": "items",            "max_cols": 15, "required_qbo": "Name,Type",          "required_zoho": "name",              "notes": "Likely fails: QBO Items require IncomeAccountRef — BE gap"},
    {"zoho": "chart_of_accounts",  "qbo": "accounts",         "max_cols": 6,  "required_qbo": "Name,AccountType",   "required_zoho": "account_name",      "notes": "May fail on enum case ('income' vs 'Income')"},
    # ── Transactional (need foundational records to exist in dest first) ──
    {"zoho": "estimates",          "qbo": "estimates",        "max_cols": 15, "required_qbo": "CustomerRef.name",   "required_zoho": "customer_name",     "notes": "Needs customers in QBO; FK chain test"},
    {"zoho": "invoices",           "qbo": "invoices",         "max_cols": 15, "required_qbo": "CustomerRef.name",   "required_zoho": "customer_name",     "notes": "Needs customers; also may fail on Line[] aggregation"},
    {"zoho": "bills",              "qbo": "bills",            "max_cols": 15, "required_qbo": "VendorRef.name",     "required_zoho": "vendor_name",       "notes": "Needs vendors in QBO"},
    {"zoho": "credit_notes",       "qbo": "credit_memos",     "max_cols": 15, "required_qbo": "CustomerRef.name",   "required_zoho": "customer_name",     "notes": "Different CDF names per provider"},
    {"zoho": "sales_receipts",     "qbo": "sales_receipts",   "max_cols": 15, "required_qbo": "CustomerRef.name",   "required_zoho": "customer_name",     "notes": "May have 0 source records"},
    {"zoho": "purchase_orders",    "qbo": "purchase_orders",  "max_cols": 15, "required_qbo": "VendorRef.name",     "required_zoho": "vendor_name",       "notes": "Needs vendors + line-item aggregation"},
    {"zoho": "vendor_credits",     "qbo": "vendor_credits",   "max_cols": 15, "required_qbo": "VendorRef.name",     "required_zoho": "vendor_name",       "notes": "Needs vendors"},
    # ── Semantic mismatches (different CDF names) ──
    {"zoho": "customer_payments",  "qbo": "payments",         "max_cols": 15, "required_qbo": "CustomerRef.name,TotalAmt", "required_zoho": "customer_name,amount", "notes": "Different CDF names; payments need invoices"},
    {"zoho": "vendor_payments",    "qbo": "bill_payments",    "max_cols": 15, "required_qbo": "VendorRef.name,TotalAmt",   "required_zoho": "vendor_name,amount",   "notes": "Different CDF names; needs bills"},
    {"zoho": "expenses",           "qbo": "purchases",        "max_cols": 15, "required_qbo": "AccountRef.name",    "required_zoho": "account_name",      "notes": "Different CDF names; needs accounts"},
    {"zoho": "journals",           "qbo": "journal_entries",  "max_cols": 15, "required_qbo": "TotalAmt",           "required_zoho": "total",             "notes": "Different CDF names"},
]

INTER_PAIR_DELAY_SECS = 12   # Stay under Zoho's burst limit (~100 req/min)
TOKEN_REFRESH_EVERY_MINS = 30


def _refresh_tokens(repo_root: Path) -> None:
    """Refresh Cognito tokens; expected to write e2e/.auth/inject-tokens.json."""
    print("  [refresh] running refresh_tokens.py...")
    r = subprocess.run(
        [sys.executable, str(repo_root / "e2e" / "refresh_tokens.py")],
        capture_output=True, text=True, timeout=60,
    )
    if r.returncode != 0:
        print(f"  [refresh] FAILED: {r.stderr[:300]}")


def _run_pair(
    repo_root: Path,
    source_provider: str,
    source_entity: str,
    dest_provider: str,
    dest_entity: str,
    max_columns: int,
    required_dest: str,
    out_path: Path,
    timeout_s: int = 1500,
) -> Dict:
    """Invoke the single-pair driver as a subprocess. Returns parsed result dict."""
    cmd = [
        sys.executable,
        str(repo_root / "e2e" / "api_e2e_test.py"),
        "--source-provider", source_provider,
        "--source-entity",   source_entity,
        "--dest-provider",   dest_provider,
        "--dest-entity",     dest_entity,
        "--max-columns",     str(max_columns),
        "--required-dest",   required_dest,
        "--poll-timeout-seconds", str(timeout_s),
        "--out",             str(out_path),
    ]
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    print(f"\n>>> {source_provider}/{source_entity} -> {dest_provider}/{dest_entity}")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s + 60, env=env)
        tail = (r.stdout or "")[-600:].replace("\r", "")
        print(tail)
        if r.returncode != 0 and r.stderr:
            print("  STDERR:", r.stderr[-400:])
    except subprocess.TimeoutExpired:
        print(f"  TIMEOUT after {timeout_s}s")
    if out_path.exists():
        try:
            return json.loads(out_path.read_text())
        except Exception as exc:
            return {"forward": {"status": f"READ_ERROR: {exc}"}}
    return {"forward": {"status": "NO_OUTPUT_FILE"}}


def _summarize_status(result: Dict) -> str:
    """Compact status for the report table."""
    fwd = result.get("forward", {})
    status = (fwd.get("status") or "UNKNOWN").upper()
    if status in ("SUCCESS", "PARTIAL"):
        sym = "OK"
    elif status in ("FAILED", "ERROR"):
        sym = "FAIL"
    elif status in ("NO_CHANGES",):
        sym = "EMPTY"
    elif status.startswith("SKIP"):
        sym = "SKIP"
    else:
        sym = "?"
    return f"{sym} {status}"


def _entity_results_summary(result: Dict) -> str:
    """One-line digest of imported/exported/error per entity-result key."""
    fwd = result.get("forward", {})
    er = fwd.get("entity_results") or {}
    parts = []
    for k, v in er.items():
        if isinstance(v, dict):
            err = (v.get("error") or "")[:120]
            if err:
                parts.append(f"error={err}")
            else:
                parts.append(
                    f"imp={v.get('imported','?')} exp={v.get('exported','?')} dq={v.get('dq_score','?')}"
                )
    return " | ".join(parts) or "no entity_results"


def _write_report(
    results: List[Tuple[Dict, Dict, str, str]],
    report_path: Path,
    started_at: str,
) -> None:
    """Write a Markdown report aggregating every pair's outcome."""
    lines = []
    lines.append(f"# CleanFlowAI — Zoho <-> QBO E2E Test Report")
    lines.append("")
    lines.append(f"**Started:** {started_at}")
    lines.append(f"**Finished:** {datetime.now().isoformat()}")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append("| Pair | Direction | Status | Imp/Exp/DQ | Notes |")
    lines.append("|---|---|---|---|---|")

    totals = {"OK": 0, "FAIL": 0, "EMPTY": 0, "SKIP": 0, "?": 0}
    for plan, result, direction, _notes in results:
        status_label = _summarize_status(result)
        sym = status_label.split()[0]
        totals[sym] = totals.get(sym, 0) + 1
        entity_summary = _entity_results_summary(result)
        pair = f"{plan['zoho']} <-> {plan['qbo']}"
        notes = plan.get("notes", "")
        lines.append(f"| {pair} | {direction} | {status_label} | {entity_summary[:120]} | {notes} |")

    lines.append("")
    lines.append("## Totals")
    lines.append("")
    for k, v in totals.items():
        if v:
            lines.append(f"- **{k}**: {v}")
    lines.append("")
    lines.append("## Per-pair detail JSON files")
    lines.append("")
    for plan, result, direction, notes in results:
        lines.append(f"- `{plan['zoho']}__{plan['qbo']}__{direction}`")
    lines.append("")
    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n=== Report written: {report_path} ===")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--direction", choices=["z2q", "q2z", "both"], default="z2q",
                        help="Test direction (default z2q — Zoho is the data source)")
    parser.add_argument("--only", default="",
                        help="Comma-separated entity keys (zoho-side) to test; omit for all")
    parser.add_argument("--skip", default="",
                        help="Comma-separated entity keys (zoho-side) to skip")
    parser.add_argument("--out-dir", default="",
                        help="Directory for per-pair JSON results")
    parser.add_argument("--report", default="",
                        help="Path to write the consolidated Markdown report")
    parser.add_argument("--inter-pair-delay", type=int, default=INTER_PAIR_DELAY_SECS,
                        help=f"Seconds to sleep between pairs (default {INTER_PAIR_DELAY_SECS})")
    parser.add_argument("--no-token-refresh", action="store_true",
                        help="Skip the initial token refresh (use existing inject-tokens.json)")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    started_at = datetime.now().isoformat()
    ts_compact = datetime.now().strftime("%Y%m%d_%H%M%S")

    out_dir = Path(args.out_dir or f"C:/tmp_dt/results_{ts_compact}")
    out_dir.mkdir(parents=True, exist_ok=True)
    report_path = Path(args.report or out_dir / "REPORT.md")

    only_set = {s.strip() for s in args.only.split(",") if s.strip()}
    skip_set = {s.strip() for s in args.skip.split(",") if s.strip()}

    # Filter plan
    pairs_to_run: List[Dict] = []
    for p in PLAN:
        if only_set and p["zoho"] not in only_set:
            continue
        if p["zoho"] in skip_set:
            continue
        pairs_to_run.append(p)

    print(f"=== Running {len(pairs_to_run)} pair(s), direction={args.direction} ===")
    print(f"=== Output dir: {out_dir} ===")
    print(f"=== Report:     {report_path} ===")

    if not args.no_token_refresh:
        _refresh_tokens(repo_root)
    last_refresh = time.time()

    results: List[Tuple[Dict, Dict, str, str]] = []

    for idx, plan in enumerate(pairs_to_run, 1):
        # Periodic token refresh for long runs
        if time.time() - last_refresh > TOKEN_REFRESH_EVERY_MINS * 60:
            _refresh_tokens(repo_root)
            last_refresh = time.time()

        print(f"\n[{idx}/{len(pairs_to_run)}] -------- {plan['zoho']} <-> {plan['qbo']} --------")
        print(f"      {plan.get('notes','')}")

        if args.direction in ("z2q", "both"):
            out_path = out_dir / f"{plan['zoho']}__{plan['qbo']}__z2q.json"
            res = _run_pair(
                repo_root,
                source_provider="zohobooks",
                source_entity=plan["zoho"],
                dest_provider="quickbooks",
                dest_entity=plan["qbo"],
                max_columns=plan["max_cols"],
                required_dest=plan.get("required_qbo", ""),
                out_path=out_path,
            )
            results.append((plan, res, "z2q", plan.get("notes", "")))
            time.sleep(args.inter_pair_delay)

        if args.direction in ("q2z", "both"):
            out_path = out_dir / f"{plan['zoho']}__{plan['qbo']}__q2z.json"
            res = _run_pair(
                repo_root,
                source_provider="quickbooks",
                source_entity=plan["qbo"],
                dest_provider="zohobooks",
                dest_entity=plan["zoho"],
                max_columns=plan["max_cols"],
                required_dest=plan.get("required_zoho", ""),
                out_path=out_path,
            )
            results.append((plan, res, "q2z", plan.get("notes", "")))
            time.sleep(args.inter_pair_delay)

    _write_report(results, report_path, started_at)

    # Exit code reflects whether anything failed
    any_fail = any(
        _summarize_status(r).startswith("FAIL")
        for _plan, r, _dir, _notes in results
    )
    return 1 if any_fail else 0


if __name__ == "__main__":
    sys.exit(main())
