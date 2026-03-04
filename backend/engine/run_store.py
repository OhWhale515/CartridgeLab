"""
Persistent run storage for CartridgeLab.

Stores each completed backtest as a JSON artifact so runs can be reopened,
ranked, and inspected later.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
RUNS_DIR = Path(os.environ.get("CARTRIDGELAB_RUNS_DIR", PROJECT_DIR / ".runtime" / "runs"))
FALLBACK_RUNS_DIRS = (
    PROJECT_DIR / "runtime" / "runs",
    BACKEND_DIR / ".tmp" / "runs",
)


def persist_run_record(record: dict) -> dict:
    """Write a completed run to disk and return the stored payload."""
    runs_dir = _resolve_runs_dir()

    payload = dict(record)
    payload.setdefault("run_id", _new_run_id())
    payload.setdefault("created_at", datetime.now(timezone.utc).isoformat())
    payload["summary"] = _build_summary(payload)

    if runs_dir is None:
        payload["archive_status"] = "unavailable"
        payload["archive_error"] = "No writable run storage directory is available"
        return payload

    path = runs_dir / f"{payload['run_id']}.json"
    try:
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        payload["archive_status"] = "persisted"
        payload["archive_path"] = str(path)
    except OSError as exc:
        payload["archive_status"] = "unavailable"
        payload["archive_error"] = str(exc)
    return payload


def list_run_records(limit: int = 20) -> list[dict]:
    """Return the most recent stored run summaries."""
    runs_dir = _resolve_runs_dir(create=False)
    if not runs_dir or not runs_dir.exists():
        return []

    records = []
    for path in sorted(runs_dir.glob("*.json"), reverse=True):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            records.append(payload.get("summary") or _build_summary(payload))
        except Exception:
            continue

    records.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return records[: max(1, int(limit or 1))]


def load_run_record(run_id: str) -> dict | None:
    """Load a stored run payload by ID."""
    safe_id = str(run_id or "").strip()
    if not safe_id:
        return None

    runs_dir = _resolve_runs_dir(create=False)
    if not runs_dir:
        return None

    path = runs_dir / f"{safe_id}.json"
    if not path.exists():
        return None

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _build_summary(payload: dict) -> dict:
    return {
        "run_id": payload.get("run_id"),
        "created_at": payload.get("created_at"),
        "strategy_name": payload.get("strategy_name"),
        "ticker": payload.get("ticker"),
        "start": payload.get("start"),
        "end": payload.get("end"),
        "file_type": payload.get("file_type"),
        "source_file": payload.get("source_file"),
        "data_source": payload.get("data_source"),
        "total_return": payload.get("total_return"),
        "sharpe": payload.get("sharpe"),
        "max_drawdown": payload.get("max_drawdown"),
        "win_rate": payload.get("win_rate"),
        "total_trades": payload.get("total_trades"),
        "final_value": payload.get("final_value"),
        "spread_bps": payload.get("spread_bps"),
        "slippage_bps": payload.get("slippage_bps"),
        "commission_bps": payload.get("commission_bps"),
        "fill_policy": payload.get("fill_policy"),
        "execution_order_count": payload.get("execution_summary", {}).get("order_count"),
        "completed_execution_orders": payload.get("execution_diagnostics", {}).get("completed_order_count"),
        "avg_execution_quality_bps": payload.get("execution_summary", {}).get("avg_quality_bps"),
        "best_execution_quality_bps": payload.get("execution_summary", {}).get("best_quality_bps"),
        "worst_execution_quality_bps": payload.get("execution_summary", {}).get("worst_quality_bps"),
        "total_execution_commission": payload.get("execution_summary", {}).get("total_commission"),
        "expectancy": payload.get("run_analysis", {}).get("expectancy"),
        "net_pnl": payload.get("run_analysis", {}).get("net_pnl"),
        "winning_trades": payload.get("run_analysis", {}).get("winning_trades"),
        "losing_trades": payload.get("run_analysis", {}).get("losing_trades"),
        "high_confidence_trades": payload.get("run_analysis", {}).get("high_confidence_trades"),
        "medium_confidence_trades": payload.get("run_analysis", {}).get("medium_confidence_trades"),
        "low_confidence_trades": payload.get("run_analysis", {}).get("low_confidence_trades"),
        "unmatched_trades": payload.get("run_analysis", {}).get("unmatched_trades"),
        "expected_friction_bps": payload.get("fill_stress", {}).get("expected_friction_bps"),
        "impacted_orders": payload.get("fill_stress", {}).get("impacted_orders"),
        "completed_orders": payload.get("fill_stress", {}).get("completed_orders"),
        "impact_rate": payload.get("fill_stress", {}).get("impact_rate"),
    }


def _new_run_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"run_{stamp}_{uuid4().hex[:8]}"


def _resolve_runs_dir(create: bool = True) -> Path | None:
    candidates = (RUNS_DIR,) + FALLBACK_RUNS_DIRS + _temp_runs_dirs()
    for candidate in candidates:
        path = Path(candidate)
        try:
            if create:
                path.mkdir(parents=True, exist_ok=True)
            if path.exists() and path.is_dir():
                return path
        except OSError:
            continue
    return None


def _temp_runs_dirs() -> tuple[Path, ...]:
    try:
        from tempfile import gettempdir

        return (Path(gettempdir()) / "CartridgeLab" / "runs",)
    except Exception:
        return ()
