"""
CartridgeLab — Sample Cartridge: Bollinger Breakout (Advanced ⭐⭐⭐)
Bollinger Band squeeze breakout strategy.
Enter on volatility expansion after low-volatility squeeze.
"""
import backtrader as bt


class BollingerBreakout(bt.Strategy):
    """
    Bollinger Band Squeeze Breakout Strategy.

    Squeeze detection: when BB width narrows below a threshold (low volatility period)
    Breakout entry: price closes above upper band (bullish expansion)
    Exit: price closes below the middle band (momentum exhausted)
    """

    params = (
        ('bb_period', 20),
        ('bb_devfactor', 2.0),
        ('squeeze_pct', 0.05),    # BB width < 5% of price = squeeze
    )

    def __init__(self):
        self.bb = bt.indicators.BollingerBands(
            self.data.close,
            period=self.p.bb_period,
            devfactor=self.p.bb_devfactor
        )
        self.order = None

    def _bb_width(self):
        """Relative BB width = (upper - lower) / middle"""
        mid = self.bb.lines.mid[0]
        if mid == 0:
            return 0.0
        return (self.bb.lines.top[0] - self.bb.lines.bot[0]) / mid

    def notify_order(self, order):
        if order.status in [order.Completed, order.Cancelled, order.Rejected]:
            self.order = None

    def next(self):
        if self.order:
            return

        bb_width = self._bb_width()

        if not self.position:
            # Look for squeeze followed by breakout above upper band
            in_squeeze = bb_width < self.p.squeeze_pct
            breakout_up = self.data.close[0] > self.bb.lines.top[0]
            if breakout_up and not in_squeeze:
                self.order = self.buy()
        else:
            # Exit when price falls back below middle band
            if self.data.close[0] < self.bb.lines.mid[0]:
                self.order = self.sell()
