"""
Order-model normalization helpers.

These helpers turn raw broker notifications into a cleaner execution model that
the analysis layer can consume now and a custom fill engine can replace later.
"""
from __future__ import annotations


def build_order_lifecycle(order_ledger: list) -> list:
    """Normalize raw order notifications into one record per order ref."""
    if not order_ledger:
        return []

    grouped = {}
    for event in order_ledger:
        ref = int(event.get('ref') or 0)
        if ref <= 0:
            continue
        bucket = grouped.setdefault(ref, {
            "ref": ref,
            "side": event.get('side'),
            "order_type": event.get('order_type'),
            "requested_at": event.get('created_at'),
            "requested_price": safe_price(event.get('created_price')),
            "requested_size": safe_price(event.get('created_size')),
            "filled_at": None,
            "filled_price": 0.0,
            "filled_size": 0.0,
            "filled_value": 0.0,
            "commission": 0.0,
            "final_status": event.get('status'),
            "status_path": [],
        })
        status = str(event.get('status') or '').lower()
        if status:
            bucket["status_path"].append(status)
            bucket["final_status"] = status
        if event.get('executed_at'):
            bucket["filled_at"] = event.get('executed_at')
        if event.get('executed_price'):
            bucket["filled_price"] = safe_price(event.get('executed_price'))
        if event.get('executed_size'):
            bucket["filled_size"] = safe_price(event.get('executed_size'))
        if event.get('executed_value'):
            bucket["filled_value"] = safe_price(event.get('executed_value'))
        if event.get('executed_comm'):
            bucket["commission"] = safe_price(event.get('executed_comm'))

    records = []
    for bucket in grouped.values():
        bucket["status_path"] = unique_path(bucket["status_path"])
        bucket["fill_gap_bps"] = price_gap_bps(
            bucket.get("requested_price"),
            bucket.get("filled_price"),
        )
        bucket["execution_quality_bps"] = execution_quality_bps(
            bucket.get("requested_price"),
            bucket.get("filled_price"),
            bucket.get("side"),
        )
        records.append(bucket)

    return sorted(records, key=lambda item: item.get("ref") or 0)


def index_order_lifecycle(order_lifecycle: list) -> dict:
    """Index normalized lifecycle rows by order ref."""
    return {
        int(item.get("ref")): item
        for item in (order_lifecycle or [])
        if int(item.get("ref") or 0) > 0
    }


def build_trade_execution_detail(trade: dict, lifecycle_by_ref: dict) -> dict:
    """Attach exact entry/exit order rows to a trade-level execution detail block."""
    entry_ref = int(trade.get('entry_order_ref') or 0)
    exit_ref = int(trade.get('exit_order_ref') or 0)
    entry_order = lifecycle_by_ref.get(entry_ref) if entry_ref else None
    exit_order = lifecycle_by_ref.get(exit_ref) if exit_ref else None
    lifecycle_rows = select_lifecycle_rows(lifecycle_by_ref, entry_ref, exit_ref)

    return {
        "entry_order": entry_order,
        "exit_order": exit_order,
        "lifecycle_rows": lifecycle_rows,
        "total_commission": round(
            float((entry_order or {}).get('commission') or 0.0) +
            float((exit_order or {}).get('commission') or 0.0),
            4,
        ),
        "entry_status_path": list((entry_order or {}).get('status_path') or []),
        "exit_status_path": list((exit_order or {}).get('status_path') or []),
    }


def select_lifecycle_rows(lifecycle_by_ref: dict, *refs) -> list:
    """Return distinct normalized lifecycle rows for the provided order refs."""
    selected = []
    seen = set()
    for ref in refs:
        key = int(ref or 0)
        if key <= 0 or key in seen:
            continue
        row = lifecycle_by_ref.get(key)
        if not row:
            continue
        selected.append(row)
        seen.add(key)
    return selected


def build_execution_summary(order_lifecycle: list) -> dict:
    """Aggregate execution-level diagnostics for the entire run."""
    if not order_lifecycle:
        return {
            "order_count": 0,
            "avg_quality_bps": 0.0,
            "best_quality_bps": 0.0,
            "worst_quality_bps": 0.0,
            "total_commission": 0.0,
        }

    quality = [
        float(item.get('execution_quality_bps') or 0.0)
        for item in order_lifecycle
    ]
    commission = [
        float(item.get('commission') or 0.0)
        for item in order_lifecycle
    ]
    avg_quality = sum(quality) / len(quality) if quality else 0.0

    return {
        "order_count": len(order_lifecycle),
        "avg_quality_bps": round(avg_quality, 4),
        "best_quality_bps": round(max(quality) if quality else 0.0, 4),
        "worst_quality_bps": round(min(quality) if quality else 0.0, 4),
        "total_commission": round(sum(commission), 4),
    }


def price_gap_bps(requested_price, filled_price) -> float:
    try:
        requested = float(requested_price or 0.0)
        filled = float(filled_price or 0.0)
        if requested <= 0:
            return 0.0
        return round(((filled - requested) / requested) * 10000, 4)
    except Exception:
        return 0.0


def execution_quality_bps(requested_price, filled_price, side) -> float:
    """
    Side-aware execution quality.

    Positive means better than requested:
    - buy: lower fill than requested is positive
    - sell: higher fill than requested is positive
    """
    raw_gap = price_gap_bps(requested_price, filled_price)
    normalized_side = str(side or '').lower()
    if normalized_side == 'buy':
        return round(-raw_gap, 4)
    return round(raw_gap, 4)


def unique_path(items: list) -> list:
    seen = set()
    ordered = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered


def safe_price(*values) -> float:
    for value in values:
        try:
            if value is None:
                continue
            return round(float(value), 4)
        except Exception:
            continue
    return 0.0
