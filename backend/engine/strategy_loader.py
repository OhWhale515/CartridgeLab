"""
CartridgeLab — Strategy Loader (The Cartridge Reader)
Detects file type and routes to the correct loader/adapter.
Always falls back to the demo SMA strategy — Yokoi's graceful degradation principle.
"""
import backtrader as bt
from typing import Tuple, Type


def load_strategy(file_content: str, file_ext: str, filename: str) -> Tuple[Type[bt.Strategy], str, str]:
    """
    Load a strategy from file content. Routes based on file extension.

    Returns:
        (strategy_class, strategy_name, file_type)
    """
    ext = file_ext.lower().strip('.')

    if ext == 'py':
        return _load_python(file_content, filename)
    elif ext == 'pine':
        return _load_pinescript(file_content, filename)
    elif ext in ('mq4', 'mq5'):
        return _load_mql(file_content, filename, ext)
    else:
        print(f"[CartridgeLab] Unknown extension '{ext}' — loading demo strategy")
        return _demo_strategy(), 'DemoSMACross', 'demo'


def _load_python(content: str, filename: str) -> Tuple[Type[bt.Strategy], str, str]:
    """Execute Python strategy file in controlled namespace."""
    namespace = {'bt': bt, '__builtins__': {
        'print': print, 'len': len, 'range': range, 'enumerate': enumerate,
        'zip': zip, 'abs': abs, 'min': min, 'max': max, 'sum': sum,
        'isinstance': isinstance, 'hasattr': hasattr, 'getattr': getattr,
        'True': True, 'False': False, 'None': None,
    }}

    try:
        exec(compile(content, filename, 'exec'), namespace)
    except Exception as e:
        print(f"[CartridgeLab] Python exec failed: {e} — falling back to demo")
        return _demo_strategy(), 'DemoSMACross', 'python_fallback'

    # Find the bt.Strategy subclass in the namespace
    strategy_class = None
    strategy_name = 'UnknownStrategy'
    for name, obj in namespace.items():
        if (isinstance(obj, type) and issubclass(obj, bt.Strategy)
                and obj is not bt.Strategy and name != 'DemoSMACross'):
            strategy_class = obj
            strategy_name = name
            break

    if strategy_class is None:
        print("[CartridgeLab] No bt.Strategy subclass found — falling back to demo")
        return _demo_strategy(), 'DemoSMACross', 'python_fallback'

    # Validate required methods
    if not hasattr(strategy_class, 'next'):
        print("[CartridgeLab] Strategy missing next() method — falling back to demo")
        return _demo_strategy(), 'DemoSMACross', 'python_fallback'

    return strategy_class, strategy_name, 'python'


def _load_pinescript(content: str, filename: str) -> Tuple[Type[bt.Strategy], str, str]:
    """Route PineScript to the adapter."""
    try:
        from .pinescript_adapter import pinescript_to_strategy
        strategy_class = pinescript_to_strategy(content)
        return strategy_class, 'PineScriptStrategy', 'pinescript'
    except Exception as e:
        print(f"[CartridgeLab] PineScript adapter failed: {e} — falling back to demo")
        return _demo_strategy(), 'DemoSMACross', 'pinescript_fallback'


def _load_mql(content: str, filename: str, ext: str) -> Tuple[Type[bt.Strategy], str, str]:
    """Route MQL to the adapter."""
    try:
        from .mql_adapter import mql_to_strategy
        strategy_class = mql_to_strategy(content)
        return strategy_class, 'MQLStrategy', ext.upper()
    except Exception as e:
        print(f"[CartridgeLab] MQL adapter failed: {e} — falling back to demo")
        return _demo_strategy(), 'DemoSMACross', 'mql_fallback'


def _demo_strategy() -> Type[bt.Strategy]:
    """
    The demo cartridge — always works, always ships.
    50/200 SMA golden cross. The Hello World of trading strategies.
    """
    class DemoSMACross(bt.Strategy):
        params = (('fast', 50), ('slow', 200),)

        def __init__(self):
            fast = bt.indicators.SMA(self.data.close, period=self.p.fast)
            slow = bt.indicators.SMA(self.data.close, period=self.p.slow)
            self.crossover = bt.indicators.CrossOver(fast, slow)

        def next(self):
            if self.crossover > 0 and not self.position:
                self.buy()
            elif self.crossover < 0 and self.position:
                self.sell()

    return DemoSMACross
