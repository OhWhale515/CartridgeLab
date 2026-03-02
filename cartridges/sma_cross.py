"""
CartridgeLab — Sample Cartridge: SMA Cross (Tutorial Level ⭐)
The Hello World of trading strategies. Perfect for first-time cartridge authors.
50/200 SMA Golden Cross entry. Death Cross exit.

HOW TO USE AS A TEMPLATE:
1. Rename the class (e.g., MyAwesomeStrategy)
2. Modify params or add new indicators in __init__
3. Update next() with your entry/exit logic
4. Drop the file into CartridgeLab and press PLAY
"""
import backtrader as bt


class SMACross(bt.Strategy):
    """
    Simple Moving Average Crossover Strategy.
    
    Entry: Golden Cross — fast SMA crosses above slow SMA (bullish signal)
    Exit:  Death Cross  — fast SMA crosses below slow SMA (bearish signal)
    
    Works best on trending markets (SPY, QQQ, trending stocks).
    Suffers in choppy / sideways markets (whipsaw risk).
    """

    params = (
        ('fast_period', 50),    # Fast SMA period
        ('slow_period', 200),   # Slow SMA period (classic 50/200 golden cross)
    )

    def __init__(self):
        # Define the two moving averages
        self.fast_sma = bt.indicators.SMA(
            self.data.close,
            period=self.p.fast_period,
            plotname='Fast SMA'
        )
        self.slow_sma = bt.indicators.SMA(
            self.data.close,
            period=self.p.slow_period,
            plotname='Slow SMA'
        )

        # CrossOver: +1 when fast crosses above slow, -1 when fast crosses below
        self.crossover = bt.indicators.CrossOver(self.fast_sma, self.slow_sma)

        # Track orders to prevent double-firing
        self.order = None

    def notify_order(self, order):
        """Called when an order is submitted/accepted/completed/cancelled."""
        if order.status in [order.Completed, order.Cancelled, order.Rejected]:
            self.order = None

    def next(self):
        """
        Called on every new bar. This is where all trading decisions happen.
        self.data.close[0] = current close price
        self.data.close[-1] = previous bar close price
        """
        # Don't act if an order is already pending
        if self.order:
            return

        if not self.position:
            # We have no position — look for buy signal
            if self.crossover > 0:  # Golden Cross!
                self.order = self.buy()
        else:
            # We have a position — look for exit signal
            if self.crossover < 0:  # Death Cross
                self.order = self.sell()
