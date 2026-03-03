"""
CartridgeLab - Sample Cartridge: Trend Quest (Demo Boss Run)
Macro trend breakout strategy designed for forex, crypto, and gold.

Core idea:
- Trade both long and short so the cartridge can handle two-way markets
- Use EMA structure to define the active regime
- Enter on breakouts confirmed by ADX so we favor expansion over chop
- Use ATR trailing stops to normalize exits across very different vol profiles

This makes it a useful showcase cartridge because it demonstrates:
- multi-indicator confirmation
- long and short trade state handling
- volatility-aware risk logic that ports across asset classes
"""
import backtrader as bt


class TrendQuest(bt.Strategy):
    """
    Trend-following breakout with defensive exits.

    Game framing:
    - Map select: identify whether bulls or bears control the arena
    - Gate unlock: wait for a breakout with enough trend strength
    - Boss fight: ride the move while the trailing barrier tightens
    - Exit portal: leave when the market breaks that barrier
    """

    params = (
        ('fast_ema', 20),
        ('slow_ema', 50),
        ('breakout_period', 20),
        ('adx_period', 14),
        ('adx_floor', 22),
        ('atr_period', 14),
        ('trail_atr_mult', 3.0),
    )

    def __init__(self):
        self.fast = bt.indicators.EMA(self.data.close, period=self.p.fast_ema)
        self.slow = bt.indicators.EMA(self.data.close, period=self.p.slow_ema)
        self.adx = bt.indicators.ADX(self.data, period=self.p.adx_period)
        self.highest = bt.indicators.Highest(self.data.high(-1), period=self.p.breakout_period)
        self.lowest = bt.indicators.Lowest(self.data.low(-1), period=self.p.breakout_period)
        self.atr = bt.indicators.ATR(self.data, period=self.p.atr_period)
        self.order = None
        self.extreme_price = None
        self.stop_price = None

    def notify_order(self, order):
        if order.status in [order.Completed]:
            if order.isbuy():
                self.extreme_price = order.executed.price
                self.stop_price = order.executed.price - (self.atr[0] * self.p.trail_atr_mult)
            else:
                if self.position.size < 0:
                    self.extreme_price = order.executed.price
                    self.stop_price = order.executed.price + (self.atr[0] * self.p.trail_atr_mult)
                else:
                    self.extreme_price = None
                    self.stop_price = None

        if order.status in [order.Completed, order.Cancelled, order.Rejected]:
            self.order = None

    def next(self):
        if self.order:
            return

        bullish_regime = self.fast[0] > self.slow[0]
        bearish_regime = self.fast[0] < self.slow[0]
        trend_strength = self.adx[0] > self.p.adx_floor
        breakout_up = self.data.close[0] > self.highest[0]
        breakout_down = self.data.close[0] < self.lowest[0]

        if not self.position:
            if bullish_regime and trend_strength and breakout_up:
                self.order = self.buy()
            elif bearish_regime and trend_strength and breakout_down:
                self.order = self.sell()
            return

        if self.position.size > 0:
            if self.extreme_price is None or self.data.close[0] > self.extreme_price:
                self.extreme_price = self.data.close[0]

            trailing_stop = self.extreme_price - (self.atr[0] * self.p.trail_atr_mult)
            if self.stop_price is None or trailing_stop > self.stop_price:
                self.stop_price = trailing_stop

            if self.data.close[0] < self.stop_price or bearish_regime:
                self.order = self.close()
            return

        if self.extreme_price is None or self.data.close[0] < self.extreme_price:
            self.extreme_price = self.data.close[0]

        trailing_stop = self.extreme_price + (self.atr[0] * self.p.trail_atr_mult)
        if self.stop_price is None or trailing_stop < self.stop_price:
            self.stop_price = trailing_stop

        if self.data.close[0] > self.stop_price or bullish_regime:
            self.order = self.close()
