import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.bootstrap import configure_local_vendor
configure_local_vendor()

print("Local vendor configured.")

from backend.engine.strategy_loader import load_strategy
from backend.engine.cerebro_runner import run_backtest

print("Imports complete. Loading cartridge...")

content = open('cartridges/sma_cross.py', encoding='utf-8').read()
strategy_class, sname, stype = load_strategy(content, '.py', 'sma_cross.py')

print(f"Loaded: {sname} ({stype}). Running backtest now...")

try:
    res = run_backtest(strategy_class, 'AAPL', '2023-01-01', '2024-01-01', 100000.0)
    print("Success! Keys:", res.keys())
except Exception as e:
    print("Error:", e)
