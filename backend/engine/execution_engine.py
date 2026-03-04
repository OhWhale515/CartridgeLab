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
        entry_fill, exit_fill = _match_trade_fills(candidates, opened_at, closed_at)
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
        confidence, note = _match_confidence(entry_fill, exit_fill, candidates)
        record['fill_match_confidence'] = confidence
        record['fill_match_note'] = note
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


def build_run_analysis(trades: list, execution_assumptions: dict | None = None) -> dict:
    """Aggregate trade-level strategy results for a serious analysis surface."""
    items = list(trades or [])
    long_trades = [trade for trade in items if str(trade.get('position_direction') or '').lower() == 'long']
    short_trades = [trade for trade in items if str(trade.get('position_direction') or '').lower() == 'short']
    winners = [float(trade.get('pnl') or 0.0) for trade in items if float(trade.get('pnl') or 0.0) > 0]
    losers = [float(trade.get('pnl') or 0.0) for trade in items if float(trade.get('pnl') or 0.0) < 0]
    pnl_values = [float(trade.get('pnl') or 0.0) for trade in items]
    bars = [float(trade.get('bar_len') or trade.get('span_bars') or 0.0) for trade in items]
    count = len(items)
    net = sum(pnl_values)
    expectancy = (net / count) if count else 0.0
    return {
        "trade_count": count,
        "winning_trades": len(winners),
        "losing_trades": len(losers),
        "long_trades": len(long_trades),
        "short_trades": len(short_trades),
        "gross_profit": round(sum(winners), 4),
        "gross_loss": round(sum(losers), 4),
        "net_pnl": round(net, 4),
        "expectancy": round(expectancy, 4),
        "avg_winner": round((sum(winners) / len(winners)) if winners else 0.0, 4),
        "avg_loser": round((sum(losers) / len(losers)) if losers else 0.0, 4),
        "avg_bars_held": round((sum(bars) / len(bars)) if bars else 0.0, 4),
        "fill_model": (execution_assumptions or {}).get('fill_model', 'bar_close'),
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


def _match_trade_fills(candidates: list, opened_iso, closed_iso) -> tuple[dict | None, dict | None]:
    """Pick distinct entry/exit fills for a trade using time and side heuristics."""
    entry_fill = _nearest_fill(candidates, opened_iso)
    if not entry_fill:
        return None, None

    remaining = [fill for fill in candidates if fill is not entry_fill and int(fill.get('ref') or 0) != int(entry_fill.get('ref') or 0)]
    preferred_exit_side = 'sell' if str(entry_fill.get('side') or '').lower() == 'buy' else 'buy'
    side_filtered = [
        fill for fill in remaining
        if str(fill.get('side') or '').lower() == preferred_exit_side
    ]
    post_open_filtered = [
        fill for fill in (side_filtered or remaining)
        if (_to_timestamp_ms(fill.get('executed_at')) or 0) >= (_to_timestamp_ms(opened_iso) or 0)
    ]
    exit_fill = _nearest_fill(post_open_filtered or side_filtered or remaining, closed_iso)

    if not exit_fill:
        fallback = _nearest_fill(
            [fill for fill in candidates if int(fill.get('ref') or 0) != int(entry_fill.get('ref') or 0)],
            closed_iso,
        )
        exit_fill = fallback

    return entry_fill, exit_fill


def _match_confidence(entry_fill, exit_fill, candidates: list) -> tuple[str, str]:
    candidate_count = len(candidates or [])
    if not entry_fill and not exit_fill:
        return 'none', 'No eligible fills matched this trade window.'
    if entry_fill and exit_fill:
        if int(entry_fill.get('ref') or 0) != int(exit_fill.get('ref') or 0):
            return 'high', 'Entry and exit matched to distinct order refs.'
        return 'medium', 'Entry and exit collapsed to the same ref; broker data was limited.'
    if candidate_count <= 1:
        return 'low', 'Only one candidate fill was available in the trade window.'
    return 'medium', 'Trade was partially matched; one side relied on nearest-fill fallback.'
