"""
CartridgeLab — Cerebro Runner
The Console Engine. Orchestrates Backtrader's Cerebro for each cartridge run.
Each call gets a fresh Cerebro instance — stateless by design.
"""
import backtrader as bt
import yfinance as yf
import pandas as pd
from .metrics_extractor import extract_metrics


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
    raw = yf.download(ticker, start=start, end=end, auto_adjust=True, progress=False)
    if raw.empty:
        raise ValueError(f"No data returned for ticker '{ticker}' in range {start} → {end}")

    # Normalize column names to Backtrader expectations
    raw.columns = [c.lower() if isinstance(c, str) else c[0].lower() for c in raw.columns]
    raw.index = pd.to_datetime(raw.index)
    feed = bt.feeds.PandasData(dataname=raw)

    # Instantiate fresh Cerebro — the console is ready
    cerebro = bt.Cerebro(stdstats=False)
    cerebro.adddata(feed)
    cerebro.addstrategy(strategy_class)
    cerebro.broker.setcash(cash)
    cerebro.broker.setcommission(commission=0.001)  # 0.1% per trade

    # Add the Renaissance-grade analyzer suite
    cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name='sharpe',
                        riskfreerate=0.05, annualize=True, timeframe=bt.TimeFrame.Days)
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name='drawdown')
    cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name='trades')
    cerebro.addanalyzer(bt.analyzers.Returns, _name='returns')
    cerebro.addanalyzer(bt.analyzers.AnnualReturn, _name='annual')

    # Track equity curve via observer-style approach
    equity_curve = [cash]
    trade_log = []

    class EquityObserver(bt.Strategy):
        pass

    # Run — cerebro.run() is PRESS PLAY
    results = cerebro.run()
    strat = results[0]

    final_value = cerebro.broker.getvalue()

    return extract_metrics(strat, cash, final_value, raw)
