"""
Persistent run storage for CartridgeLab.

Stores each completed backtest as a JSON artifact so runs can be reopened,
ranked, and inspected later.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


BACKEND_DIR = Path(__file__).resolve().parents[1]
RUNS_DIR = BACKEND_DIR / "data" / "runs"


def persist_run_record(record: dict) -> dict:
    """Write a completed run to disk and return the stored payload."""
    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    payload = dict(record)
    payload.setdefault("run_id", _new_run_id())
    payload.setdefault("created_at", datetime.now(timezone.utc).isoformat())
    payload["summary"] = _build_summary(payload)

    path = RUNS_DIR / f"{payload['run_id']}.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def list_run_records(limit: int = 20) -> list[dict]:
    """Return the most recent stored run summaries."""
    if not RUNS_DIR.exists():
        return []

    records = []
    for path in sorted(RUNS_DIR.glob("*.json"), reverse=True):
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

    path = RUNS_DIR / f"{safe_id}.json"
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
        "total_return": payload.get("total_return"),
        "sharpe": payload.get("sharpe"),
        "max_drawdown": payload.get("max_drawdown"),
        "win_rate": payload.get("win_rate"),
        "total_trades": payload.get("total_trades"),
        "final_value": payload.get("final_value"),
    }


def _new_run_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"run_{stamp}_{uuid4().hex[:8]}"
