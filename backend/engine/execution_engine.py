"""
Execution-analysis helpers.

This module is the first standalone boundary between the raw Backtrader broker
notifications and CartridgeLab's internal execution-analysis model.
"""
from __future__ import annotations

from .order_model import (
    build_execution_summary,
    build_order_lifecycle,
    build_trade_execution_detail,
    execution_quality_bps,
    index_order_lifecycle,
    price_gap_bps,
    safe_price,
)


def analyze_execution(order_ledger: list, trades: list) -> dict:
    """Return normalized lifecycle data, enriched trades, and run diagnostics."""
    order_lifecycle = build_order_lifecycle(order_ledger or [])
    lifecycle_by_ref = index_order_lifecycle(order_lifecycle)
    enriched_trades = enrich_trade_log(trades or [], order_ledger or [], lifecycle_by_ref)
    execution_summary = build_execution_summary(order_lifecycle)
    execution_diagnostics = build_execution_diagnostics(order_lifecycle, execution_summary)
    return {
        "order_lifecycle": order_lifecycle,
        "execution_summary": execution_summary,
        "execution_diagnostics": execution_diagnostics,
        "trades": enriched_trades,
    }


def enrich_trade_log(trades: list, order_ledger: list, lifecycle_by_ref: dict | None = None) -> list:
    """Attach entry/exit fill details from the order ledger to each closed trade."""
    if not trades:
        return []

    lifecycle_by_ref = lifecycle_by_ref or index_order_lifecycle(build_order_lifecycle(order_ledger))
    fills = [
        order for order in (order_ledger or [])
        if order.get('status') in {'completed', 'partial'} and abs(float(order.get('executed_size') or 0.0)) > 0
    ]
    fills.sort(key=lambda item: item.get('executed_at') or '')

    enriched = []
    for trade in trades:
        opened_at = trade.get('opened_at')
        closed_at = trade.get('closed_at')
        window_fills = [
            fill for fill in fills
            if _between(fill.get('executed_at'), opened_at, closed_at)
        ]
        candidates = window_fills or fills
        entry_fill = _nearest_fill(candidates, opened_at)
        remaining = [fill for fill in candidates if fill is not entry_fill]
        preferred_exit_side = None
        if entry_fill:
            preferred_exit_side = 'sell' if str(entry_fill.get('side') or '').lower() == 'buy' else 'buy'
        side_filtered = [
            fill for fill in remaining
            if str(fill.get('side') or '').lower() == preferred_exit_side
        ] if preferred_exit_side else []
        exit_fill = _nearest_fill(side_filtered or remaining or candidates, closed_at)
        record = dict(trade)
        if entry_fill:
            record['entry_price'] = safe_price(entry_fill.get('executed_price'))
            record['requested_entry_price'] = safe_price(entry_fill.get('created_price'))
            record['entry_order_ref'] = entry_fill.get('ref')
            record['entry_order_type'] = entry_fill.get('order_type')
            record['entry_side'] = entry_fill.get('side')
            record['position_direction'] = 'long' if str(record.get('entry_side') or '').lower() == 'buy' else 'short'
            record['entry_fill_gap_bps'] = price_gap_bps(
                record.get('requested_entry_price'),
                record.get('entry_price'),
            )
            record['entry_quality_bps'] = execution_quality_bps(
                record.get('requested_entry_price'),
                record.get('entry_price'),
                record.get('entry_side'),
            )
        if exit_fill:
            record['exit_price'] = safe_price(exit_fill.get('executed_price'))
            record['requested_exit_price'] = safe_price(exit_fill.get('created_price'))
            record['exit_order_ref'] = exit_fill.get('ref')
            record['exit_order_type'] = exit_fill.get('order_type')
            record['exit_side'] = exit_fill.get('side')
            record['exit_fill_gap_bps'] = price_gap_bps(
                record.get('requested_exit_price'),
                record.get('exit_price'),
            )
            record['exit_quality_bps'] = execution_quality_bps(
                record.get('requested_exit_price'),
                record.get('exit_price'),
                record.get('exit_side'),
            )
        record['execution_detail'] = build_trade_execution_detail(record, lifecycle_by_ref)
        enriched.append(record)

    return enriched


def build_execution_diagnostics(order_lifecycle: list, execution_summary: dict | None = None) -> dict:
    """Return run-level execution diagnostics for quick inspection surfaces."""
    lifecycle = list(order_lifecycle or [])
    summary = execution_summary or build_execution_summary(lifecycle)
    completed = [
        item for item in lifecycle
        if str(item.get('final_status') or '').lower() in {'completed', 'partial'}
    ]
    buys = [item for item in lifecycle if str(item.get('side') or '').lower() == 'buy']
    sells = [item for item in lifecycle if str(item.get('side') or '').lower() == 'sell']
    ranked = sorted(
        completed or lifecycle,
        key=lambda item: float(item.get('execution_quality_bps') or 0.0),
    )
    worst_rows = [dict(row) for row in ranked[:3]]
    best_rows = [dict(row) for row in ranked[-3:]][::-1]

    return {
        "completed_order_count": len(completed),
        "buy_order_count": len(buys),
        "sell_order_count": len(sells),
        "avg_quality_bps": float(summary.get('avg_quality_bps') or 0.0),
        "best_quality_bps": float(summary.get('best_quality_bps') or 0.0),
        "worst_quality_bps": float(summary.get('worst_quality_bps') or 0.0),
        "total_commission": float(summary.get('total_commission') or 0.0),
        "best_orders": best_rows,
        "worst_orders": worst_rows,
    }


def _to_timestamp_ms(value) -> int:
    if not value:
        return 0
    try:
        from datetime import datetime
        return int(datetime.fromisoformat(value).timestamp() * 1000)
    except Exception:
        return 0


def _between(candidate_iso, opened_iso, closed_iso) -> bool:
    candidate = _to_timestamp_ms(candidate_iso)
    opened = _to_timestamp_ms(opened_iso)
    closed = _to_timestamp_ms(closed_iso)
    if not candidate:
        return False
    if opened and candidate < opened:
        return False
    if closed and candidate > closed:
        return False
    return True


def _nearest_fill(fills: list, target_iso) -> dict | None:
    target = _to_timestamp_ms(target_iso)
    if not fills:
        return None
    if not target:
        return fills[0]
    return min(
        fills,
        key=lambda fill: abs((_to_timestamp_ms(fill.get('executed_at')) or 0) - target),
    )
