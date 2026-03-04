"""
Improved backtest engine for CartridgeLab.

Adds:
- explicit order/fill ledger capture
- optional imported CSV market data
- consistent payload metadata for analysis and replay
"""
from __future__ import annotations

import io
from contextlib import redirect_stderr, redirect_stdout
from math import sin

import backtrader as bt
import pandas as pd
import yfinance as yf

from .execution_simulator import normalize_execution_config
from .metrics_extractor import extract_metrics


class EquityCurveAnalyzer(bt.Analyzer):
    """Capture broker value at each bar for frontend visualization."""

    def start(self):
        self.values = []

    def next(self):
        dt = self.strategy.datas[0].datetime.datetime(0)
        self.values.append([int(dt.timestamp() * 1000), round(self.strategy.broker.getvalue(), 2)])

    def get_analysis(self):
        return self.values


class TradeLogAnalyzer(bt.Analyzer):
    """Capture completed trades in a lightweight JSON-friendly structure."""

    def start(self):
        self.trades = []

    def notify_trade(self, trade):
        if not trade.isclosed:
            return

        opened_at = bt.num2date(trade.dtopen) if trade.dtopen else None
        closed_at = bt.num2date(trade.dtclose) if trade.dtclose else None
        self.trades.append({
            "opened_at": opened_at.isoformat() if opened_at else None,
            "closed_at": closed_at.isoformat() if closed_at else None,
            "size": round(trade.size, 8),
            "pnl": round(trade.pnl, 2),
            "pnl_comm": round(trade.pnlcomm, 2),
            "bar_len": trade.barlen,
        })

    def get_analysis(self):
        return self.trades


class OrderLedgerAnalyzer(bt.Analyzer):
    """Capture order lifecycle notifications for execution-grade fills."""

    STATUS_NAMES = {
        bt.Order.Created: 'created',
        bt.Order.Submitted: 'submitted',
        bt.Order.Accepted: 'accepted',
        bt.Order.Partial: 'partial',
        bt.Order.Completed: 'completed',
        bt.Order.Canceled: 'canceled',
        bt.Order.Expired: 'expired',
        bt.Order.Margin: 'margin',
        bt.Order.Rejected: 'rejected',
    }
    EXEC_TYPES = {
        bt.Order.Market: 'market',
        bt.Order.Close: 'close',
        bt.Order.Limit: 'limit',
        bt.Order.Stop: 'stop',
        bt.Order.StopLimit: 'stop_limit',
        bt.Order.StopTrail: 'stop_trail',
        bt.Order.StopTrailLimit: 'stop_trail_limit',
    }

    def start(self):
        self.orders = []

    def notify_order(self, order):
        created_dt = bt.num2date(order.created.dt) if getattr(order.created, 'dt', None) else None
        executed_dt = bt.num2date(order.executed.dt) if getattr(order.executed, 'dt', None) else None
        self.orders.append({
            "ref": int(order.ref),
            "status": self.STATUS_NAMES.get(order.status, str(order.getstatusname()).lower()),
            "side": "buy" if order.isbuy() else "sell",
            "order_type": self.EXEC_TYPES.get(order.exectype, "unknown"),
            "created_at": created_dt.isoformat() if created_dt else None,
            "executed_at": executed_dt.isoformat() if executed_dt else None,
            "created_price": _safe_float(getattr(order.created, 'price', None)),
            "created_size": _safe_float(getattr(order.created, 'size', None)),
            "executed_price": _safe_float(getattr(order.executed, 'price', None)),
            "executed_size": _safe_float(getattr(order.executed, 'size', None)),
            "executed_value": _safe_float(getattr(order.executed, 'value', None)),
            "executed_comm": _safe_float(getattr(order.executed, 'comm', None)),
            "remaining_size": _safe_float(getattr(order.executed, 'remsize', None)),
            "alive": bool(order.alive()),
        })

    def get_analysis(self):
        return self.orders


def run_backtest(
    strategy_class,
    ticker: str,
    start: str,
    end: str,
    cash: float,
    market_data_bytes: bytes | None = None,
    market_data_name: str | None = None,
    execution_config: dict | None = None,
) -> dict:
    """Run a full backtest using imported CSV data or downloaded history."""
    normalized_execution = normalize_execution_config(execution_config)
    spread_bps = normalized_execution['spread_bps']
    slippage_bps = normalized_execution['slippage_bps']
    commission_bps = normalized_execution['commission_bps']
    fill_policy = normalized_execution['fill_model']

    raw, data_source = load_market_data(
        ticker=ticker,
        start=start,
        end=end,
        market_data_bytes=market_data_bytes,
        market_data_name=market_data_name,
    )
    feed = bt.feeds.PandasData(dataname=raw)

    cerebro = bt.Cerebro(stdstats=False)
    cerebro.adddata(feed)
    cerebro.addstrategy(strategy_class)
    cerebro.addobserver(bt.observers.Broker)
    cerebro.broker.setcash(cash)
    cerebro.broker.setcommission(commission=commission_bps / 10000)
    _apply_fill_policy(cerebro, fill_policy)
    effective_execution_bps = normalized_execution['effective_execution_bps']
    if effective_execution_bps > 0 and fill_policy != 'strict_limit':
        cerebro.broker.set_slippage_perc(
            perc=effective_execution_bps / 10000,
            slip_open=True,
            slip_limit=True,
            slip_match=True,
            slip_out=True,
        )

    cerebro.addanalyzer(
        bt.analyzers.SharpeRatio,
        _name='sharpe',
        riskfreerate=0.05,
        annualize=True,
        timeframe=bt.TimeFrame.Days,
    )
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name='drawdown')
    cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name='trades')
    cerebro.addanalyzer(bt.analyzers.Returns, _name='returns')
    cerebro.addanalyzer(bt.analyzers.AnnualReturn, _name='annual')
    cerebro.addanalyzer(EquityCurveAnalyzer, _name='equitycurve')
    cerebro.addanalyzer(TradeLogAnalyzer, _name='tradelog')
    cerebro.addanalyzer(OrderLedgerAnalyzer, _name='orderledger')

    results = cerebro.run()
    strat = results[0]
    setattr(strat, '_cartridgelab_execution_assumptions', normalized_execution)
    final_value = cerebro.broker.getvalue()

    payload = extract_metrics(strat, cash, final_value, raw)
    payload['data_source'] = data_source
    payload['execution_assumptions'] = normalized_execution
    return payload


def load_market_data(
    ticker: str,
    start: str,
    end: str,
    market_data_bytes: bytes | None = None,
    market_data_name: str | None = None,
) -> tuple[pd.DataFrame, str]:
    """Load market data from an imported CSV file or from Yahoo Finance."""
    if market_data_bytes:
        raw = pd.read_csv(io.BytesIO(market_data_bytes))
        if raw.empty:
            raise ValueError("Imported market data file is empty")

        raw.columns = [str(column).strip().lower() for column in raw.columns]
        dt_column = next((name for name in ('datetime', 'date', 'timestamp', 'time') if name in raw.columns), None)
        if not dt_column:
            raise ValueError("Imported market data must include a datetime/date/timestamp column")

        raw[dt_column] = pd.to_datetime(raw[dt_column], utc=False)
        raw = raw.set_index(dt_column).sort_index()

        for column in ('open', 'high', 'low', 'close'):
            if column not in raw.columns:
                raise ValueError(f"Imported market data is missing required column '{column}'")
            raw[column] = pd.to_numeric(raw[column], errors='coerce')

        if 'volume' not in raw.columns:
            raw['volume'] = 0.0
        raw['volume'] = pd.to_numeric(raw['volume'], errors='coerce').fillna(0.0)
        raw = raw[['open', 'high', 'low', 'close', 'volume']].dropna()
        if raw.empty:
            raise ValueError("Imported market data did not contain usable OHLC rows")
        return raw, f"import:{market_data_name or 'uploaded.csv'}"

    with io.StringIO() as sink, redirect_stdout(sink), redirect_stderr(sink):
        raw = yf.download(ticker, start=start, end=end, auto_adjust=True, progress=False)
    if raw.empty:
        return _build_synthetic_market_data(ticker, start, end), f"synthetic:{ticker}"

    raw.columns = [c.lower() if isinstance(c, str) else c[0].lower() for c in raw.columns]
    raw.index = pd.to_datetime(raw.index)
    return raw, f"yfinance:{ticker}"


def _safe_float(value):
    try:
        if value is None:
            return 0.0
        return round(float(value), 8)
    except Exception:
        return 0.0


def _build_synthetic_market_data(ticker: str, start: str, end: str) -> pd.DataFrame:
    """Return deterministic business-day OHLCV data when network fetches fail."""
    index = pd.date_range(start=start, end=end, freq='B')
    if len(index) < 2:
        raise ValueError(f"Unable to build fallback data for ticker '{ticker}' from {start} to {end}")

    base_price = 100.0 + (sum(ord(char) for char in str(ticker or 'MARKET')) % 50)
    records = []
    for offset, stamp in enumerate(index):
        drift = offset * 0.18
        wave = sin(offset / 7.0) * 2.4
        close = round(base_price + drift + wave, 4)
        open_price = round(close - 0.45 + sin(offset / 3.0) * 0.3, 4)
        high = round(max(open_price, close) + 0.75, 4)
        low = round(min(open_price, close) - 0.75, 4)
        volume = int(1_000_000 + ((offset % 20) * 12_500))
        records.append((stamp, open_price, high, low, close, volume))

    frame = pd.DataFrame.from_records(
        records,
        columns=['datetime', 'open', 'high', 'low', 'close', 'volume'],
    ).set_index('datetime')
    frame.index = pd.to_datetime(frame.index)
    return frame


def _apply_fill_policy(cerebro, fill_policy):
    broker = cerebro.broker
    if fill_policy == 'next_open':
        try:
            broker.set_coc(False)
            broker.set_coo(True)
        except Exception:
            pass
        return
    if fill_policy == 'strict_limit':
        try:
            broker.set_coc(False)
            broker.set_coo(False)
            broker.set_slippage_fixed(0.0, slip_open=False, slip_limit=False, slip_match=False, slip_out=False)
        except Exception:
            pass
        return
    if fill_policy == 'aggressive':
        try:
            broker.set_coc(True)
            broker.set_coo(True)
        except Exception:
            pass
        return
    try:
        broker.set_coc(True)
        broker.set_coo(False)
    except Exception:
        pass
