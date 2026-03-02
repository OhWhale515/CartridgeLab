"""
CartridgeLab — Sample Cartridge: RSI Reversal (Intermediate ⭐⭐)
RSI mean-reversion strategy with ATR-based position sizing.
Buy when RSI is oversold (<30). Sell when RSI is overbought (>70).
Works best on mean-reverting assets (indices, large-cap stocks).
"""
import backtrader as bt


class RSIReversal(bt.Strategy):
    """
    RSI Mean-Reversion Strategy with ATR Position Sizing.
    
    Entry: Buy when RSI(14) drops below 30 (oversold)
    Exit:  Sell when RSI(14) rises above 70 (overbought)
    Sizing: Risk 2% of portfolio per trade, sized by ATR(14)
    """

    params = (
        ('rsi_period', 14),
        ('rsi_oversold', 30),
        ('rsi_overbought', 70),
        ('atr_period', 14),
        ('risk_pct', 0.02),       # Risk 2% of capital per trade
        ('atr_stop_mult', 2.0),   # Stop loss = 2x ATR from entry
    )

    def __init__(self):
        self.rsi = bt.indicators.RSI(
            self.data.close,
            period=self.p.rsi_period,
            safediv=True
        )
        self.atr = bt.indicators.ATR(self.data, period=self.p.atr_period)
        self.order = None
        self.entry_price = None

    def notify_order(self, order):
        if order.status in [order.Completed]:
            if order.isbuy():
                self.entry_price = order.executed.price
        if order.status in [order.Completed, order.Cancelled, order.Rejected]:
            self.order = None

    def next(self):
        if self.order:
            return

        if not self.position:
            if self.rsi[0] < self.p.rsi_oversold:
                # ATR-based position sizing: risk_pct of portfolio / (atr_mult * ATR)
                atr_val = self.atr[0]
                if atr_val > 0:
                    risk_capital = self.broker.getvalue() * self.p.risk_pct
                    stop_distance = self.p.atr_stop_mult * atr_val
                    size = max(1, int(risk_capital / stop_distance))
                    self.order = self.buy(size=size)
        else:
            if self.rsi[0] > self.p.rsi_overbought:
                self.order = self.sell()
