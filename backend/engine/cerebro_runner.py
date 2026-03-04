"""
CartridgeLab — Cerebro Runner
The Console Engine. Orchestrates Backtrader's Cerebro for each cartridge run.
Each call gets a fresh Cerebro instance — stateless by design.
"""
import backtrader as bt

from .backtest_engine import load_market_data
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


def run_backtest(strategy_class, ticker: str, start: str, end: str, cash: float) -> dict:
    """
    Run a full backtest — the equivalent of pressing PLAY on the console.

    Args:
        strategy_class: A bt.Strategy subclass (the loaded cartridge)
        ticker: Yahoo Finance symbol
        start: Start date string YYYY-MM-DD
        end: End date string YYYY-MM-DD
        cash: Starting portfolio cash

    Returns:
        dict with full metrics, equity_curve, and trade log
    """
    # Download market data (the game ROM — read-only market history)
    raw, _data_source = load_market_data(ticker=ticker, start=start, end=end)
    if raw.empty:
        raise ValueError(f"No data returned for ticker '{ticker}' in range {start} → {end}")

    # Normalize column names to Backtrader expectations
    feed = bt.feeds.PandasData(dataname=raw)

    # Instantiate fresh Cerebro — the console is ready
    cerebro = bt.Cerebro(stdstats=False)
    cerebro.adddata(feed)
    cerebro.addstrategy(strategy_class)
    cerebro.addobserver(bt.observers.Broker)
    cerebro.broker.setcash(cash)
    cerebro.broker.setcommission(commission=0.001)  # 0.1% per trade

    # Add the Renaissance-grade analyzer suite
    cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name='sharpe',
                        riskfreerate=0.05, annualize=True, timeframe=bt.TimeFrame.Days)
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name='drawdown')
    cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name='trades')
    cerebro.addanalyzer(bt.analyzers.Returns, _name='returns')
    cerebro.addanalyzer(bt.analyzers.AnnualReturn, _name='annual')
    cerebro.addanalyzer(EquityCurveAnalyzer, _name='equitycurve')
    cerebro.addanalyzer(TradeLogAnalyzer, _name='tradelog')

    # Run — cerebro.run() is PRESS PLAY
    results = cerebro.run()
    strat = results[0]

    final_value = cerebro.broker.getvalue()

    return extract_metrics(strat, cash, final_value, raw)
