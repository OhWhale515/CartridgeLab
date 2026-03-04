"""
CartridgeLab — Metrics Extractor
Post-run analytics extraction. Transforms raw Backtrader analyzer results
into the structured metrics JSON returned to the Three.js frontend.
"""
import math
from datetime import datetime


def extract_metrics(strat, starting_cash: float, final_value: float, price_data=None) -> dict:
    """
    Extract all performance metrics from a completed Backtrader strategy run.

    Args:
        strat: The Backtrader strategy instance post-run
        starting_cash: Starting portfolio value
        final_value: Final portfolio value
        price_data: The raw price DataFrame (for equity curve reconstruction)

    Returns:
        Structured metrics dict ready for JSON serialization
    """
    total_return = ((final_value - starting_cash) / starting_cash) * 100

    # --- Sharpe Ratio ---
    sharpe = 0.0
    try:
        sharpe_analysis = strat.analyzers.sharpe.get_analysis()
        sr = sharpe_analysis.get('sharperatio', None)
        sharpe = round(sr, 4) if sr and not math.isnan(sr) else 0.0
    except Exception:
        pass

    # --- Drawdown ---
    max_drawdown = 0.0
    max_drawdown_cash = 0.0
    try:
        dd_analysis = strat.analyzers.drawdown.get_analysis()
        max_drawdown = round(dd_analysis.get('max', {}).get('drawdown', 0.0), 2)
        max_drawdown_cash = round(dd_analysis.get('max', {}).get('moneydown', 0.0), 2)
    except Exception:
        pass

    # --- Trade Statistics ---
    total_trades = 0
    won_trades = 0
    lost_trades = 0
    win_rate = 0.0
    profit_factor = 0.0
    avg_trade_pnl = 0.0
    gross_profit = 0.0
    gross_loss = 0.0

    try:
        ta = strat.analyzers.trades.get_analysis()
        total_trades = ta.get('total', {}).get('closed', 0)
        won_trades = ta.get('won', {}).get('total', 0)
        lost_trades = ta.get('lost', {}).get('total', 0)
        gross_profit = ta.get('won', {}).get('pnl', {}).get('total', 0.0)
        gross_loss = abs(ta.get('lost', {}).get('pnl', {}).get('total', 0.0))

        if total_trades > 0:
            win_rate = round((won_trades / total_trades) * 100, 2)
        if gross_loss > 0:
            profit_factor = round(gross_profit / gross_loss, 4)
        if total_trades > 0:
            avg_trade_pnl = round((gross_profit - gross_loss) / total_trades, 2)
    except Exception:
        pass

    # --- Annual Return ---
    annual_return = {}
    try:
        annual_analysis = strat.analyzers.annual.get_analysis()
        annual_return = {str(k): round(v * 100, 2) for k, v in annual_analysis.items()}
    except Exception:
        pass

    # --- Equity Curve (reconstructed from price data + broker value tracking) ---
    equity_curve = _build_equity_curve(strat, price_data, starting_cash)
    order_ledger = _extract_order_log(strat)
    trades = _extract_trade_log(strat, order_ledger)
    price_bars = _build_price_bars(price_data)
    replay_events = _build_replay_events(price_bars, trades)

    # --- Sortino (approximation from returns) ---
    sortino = _approx_sortino(sharpe)

    return {
        "total_return": round(total_return, 2),
        "final_value": round(final_value, 2),
        "starting_cash": starting_cash,
        "sharpe": sharpe,
        "sortino": sortino,
        "max_drawdown": max_drawdown,
        "max_drawdown_cash": max_drawdown_cash,
        "total_trades": total_trades,
        "won_trades": won_trades,
        "lost_trades": lost_trades,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "avg_trade_pnl": avg_trade_pnl,
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "annual_return": annual_return,
        "equity_curve": equity_curve,
        "order_ledger": order_ledger,
        "trades": trades,
        "price_bars": price_bars,
        "replay_events": replay_events,
    }


def _build_equity_curve(strat, price_data, starting_cash: float) -> list:
    """Build a simplified equity curve from price index. Returns [[timestamp_ms, value], ...]."""
    try:
        curve = strat.analyzers.equitycurve.get_analysis()
        if curve:
            return curve
    except Exception:
        pass

    try:
        if price_data is not None and not price_data.empty:
            first_dt = price_data.index[0]
            return [[int(first_dt.timestamp() * 1000), round(starting_cash, 2)]]
    except Exception:
        pass

    return []


def _extract_trade_log(strat, order_ledger=None) -> list:
    """Return analyzer-captured closed trades enriched with matching fills."""
    try:
        return _enrich_trade_log(strat.analyzers.tradelog.get_analysis(), order_ledger or [])
    except Exception:
        return []


def _extract_order_log(strat) -> list:
    """Return full order lifecycle notifications, or an empty list."""
    try:
        return strat.analyzers.orderledger.get_analysis()
    except Exception:
        return []


def _build_price_bars(price_data) -> list:
    """Compress OHLCV data into a frontend-friendly replay payload."""
    try:
        if price_data is None or price_data.empty:
            return []

        total_rows = len(price_data)
        target = 140
        stride = max(1, total_rows // target)
        rows = price_data.iloc[::stride]
        bars = []

        for ts, row in rows.iterrows():
            bars.append({
                "ts": int(ts.timestamp() * 1000),
                "open": round(float(row.get('open', row.get('close', 0.0))), 4),
                "high": round(float(row.get('high', row.get('close', 0.0))), 4),
                "low": round(float(row.get('low', row.get('close', 0.0))), 4),
                "close": round(float(row.get('close', 0.0)), 4),
                "volume": round(float(row.get('volume', 0.0)), 2),
            })
        return bars
    except Exception:
        return []


def _enrich_trade_log(trades: list, order_ledger: list) -> list:
    """Attach entry/exit fill details from the order ledger to each closed trade."""
    if not trades:
        return []

    fills = [
        order for order in order_ledger
        if order.get('status') in {'completed', 'partial'} and abs(float(order.get('executed_size') or 0.0)) > 0
    ]
    fills.sort(key=lambda item: item.get('executed_at') or '')

    enriched = []
    for trade in trades:
        opened_at = trade.get('opened_at')
        closed_at = trade.get('closed_at')
        matching = [
            fill for fill in fills
            if _between(fill.get('executed_at'), opened_at, closed_at)
        ]
        if not matching:
            matching = _nearest_fills(fills, opened_at, closed_at)

        entry_fill = matching[0] if matching else None
        exit_fill = matching[-1] if matching else None
        record = dict(trade)
        if entry_fill:
            record['entry_price'] = _safe_price(entry_fill.get('executed_price'))
            record['requested_entry_price'] = _safe_price(entry_fill.get('created_price'))
            record['entry_order_ref'] = entry_fill.get('ref')
            record['entry_order_type'] = entry_fill.get('order_type')
            record['entry_side'] = entry_fill.get('side')
        if exit_fill:
            record['exit_price'] = _safe_price(exit_fill.get('executed_price'))
            record['requested_exit_price'] = _safe_price(exit_fill.get('created_price'))
            record['exit_order_ref'] = exit_fill.get('ref')
            record['exit_order_type'] = exit_fill.get('order_type')
            record['exit_side'] = exit_fill.get('side')
        enriched.append(record)

    return enriched


def _build_replay_events(price_bars: list, trades: list) -> list:
    """Build approximate entry/exit events aligned to compressed price bars."""
    if not price_bars:
        return []

    bar_timestamps = [bar["ts"] for bar in price_bars]
    events = [{
        "type": "scan",
        "label": "Scanning for regime",
        "bar_index": 0,
    }]

    for trade_index, trade in enumerate(trades, start=1):
        opened_at = _to_timestamp_ms(trade.get("opened_at"))
        closed_at = _to_timestamp_ms(trade.get("closed_at"))
        pnl = round(float(trade.get("pnl", 0.0)), 2)
        profitable = pnl >= 0
        open_bar_index = _nearest_bar_index(bar_timestamps, opened_at)
        close_bar_index = _nearest_bar_index(bar_timestamps, closed_at)
        entry_price = _safe_price(
            trade.get("entry_price"),
            trade.get("open_price"),
            trade.get("opened_price"),
            trade.get("price_in"),
        )
        exit_price = _safe_price(
            trade.get("exit_price"),
            trade.get("close_price"),
            trade.get("closed_price"),
            trade.get("price_out"),
        )
        span_bars = max(close_bar_index - open_bar_index, 0)
        if not entry_price and 0 <= open_bar_index < len(price_bars):
            entry_price = _safe_price(price_bars[open_bar_index].get("close"))
        if not exit_price and 0 <= close_bar_index < len(price_bars):
            exit_price = _safe_price(price_bars[close_bar_index].get("close"))

        events.append({
            "type": "buy" if profitable else "engage",
            "label": f"Trade {trade_index} opened",
            "bar_index": open_bar_index,
            "trade_index": trade_index,
            "pnl": pnl,
            "entry_price": entry_price,
            "requested_entry_price": _safe_price(trade.get("requested_entry_price")),
            "exit_price": exit_price,
            "reason": "Breakout or pullback entry confirmed. Position armed." if profitable else "Entry armed under pressure. Risk control is active.",
            "outcome": "profit" if profitable else "risk",
            "span_bars": span_bars,
        })
        events.append({
            "type": "sell" if profitable else "damage",
            "label": f"Trade {trade_index} closed",
            "bar_index": close_bar_index,
            "trade_index": trade_index,
            "pnl": pnl,
            "entry_price": entry_price,
            "requested_entry_price": _safe_price(trade.get("requested_entry_price")),
            "exit_price": exit_price,
            "requested_exit_price": _safe_price(trade.get("requested_exit_price")),
            "reason": "Profit captured. Trend follow-through paid out." if profitable else "Risk exit triggered. The strategy cut the position.",
            "outcome": "profit" if profitable else "risk",
            "span_bars": span_bars,
        })

    events.append({
        "type": "finish",
        "label": "Replay complete",
        "bar_index": max(len(price_bars) - 1, 0),
    })
    return sorted(events, key=lambda item: (item.get("bar_index", 0), item.get("trade_index", 0)))


def _to_timestamp_ms(value) -> int:
    if not value:
        return 0
    try:
        return int(datetime.fromisoformat(value).timestamp() * 1000)
    except Exception:
        return 0


def _nearest_bar_index(bar_timestamps: list, target_ts: int) -> int:
    if not bar_timestamps or target_ts <= 0:
        return 0

    nearest_index = 0
    nearest_distance = abs(bar_timestamps[0] - target_ts)
    for index, timestamp in enumerate(bar_timestamps):
        distance = abs(timestamp - target_ts)
        if distance < nearest_distance:
            nearest_distance = distance
            nearest_index = index
    return nearest_index


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


def _nearest_fills(fills: list, opened_iso, closed_iso) -> list:
    opened = _to_timestamp_ms(opened_iso)
    closed = _to_timestamp_ms(closed_iso)
    if not fills:
        return []

    ranked = sorted(
        fills,
        key=lambda fill: (
            abs((_to_timestamp_ms(fill.get('executed_at')) or 0) - opened),
            abs((_to_timestamp_ms(fill.get('executed_at')) or 0) - closed),
        ),
    )
    if not ranked:
        return []
    if len(ranked) == 1:
        return [ranked[0]]
    return sorted(ranked[:2], key=lambda fill: fill.get('executed_at') or '')


def _approx_sortino(sharpe: float) -> float:
    """Approximate Sortino from Sharpe (Sortino ≈ Sharpe * sqrt(2) for symmetric distributions)."""
    return round(sharpe * 1.414, 4) if sharpe else 0.0


def _safe_price(*values) -> float:
    for value in values:
        try:
            if value is None:
                continue
            return round(float(value), 4)
        except Exception:
            continue
    return 0.0
