"""
CartridgeLab — Flask API Server
The console's I/O interface. Accepts cartridge files, runs backtests, returns results.
"""
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from engine.cerebro_runner import run_backtest
from engine.strategy_loader import load_strategy

app = Flask(__name__)
CORS(app)

CARTRIDGES_DIR = os.path.join(os.path.dirname(__file__), '..', 'cartridges')


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "platform": "CartridgeLab", "version": "0.1.0"})


@app.route('/api/cartridges', methods=['GET'])
def list_cartridges():
    """Return all available sample cartridges from the cartridges/ directory."""
    cartridges = []
    for fname in os.listdir(CARTRIDGES_DIR):
        ext = os.path.splitext(fname)[1].lower()
        if ext in ('.py', '.pine', '.mq4', '.mq5'):
            cartridges.append({
                "name": fname,
                "type": ext.lstrip('.'),
                "path": fname,
            })
    return jsonify({"cartridges": cartridges})


@app.route('/api/run', methods=['POST'])
def run():
    """
    Run a backtest from an uploaded strategy file (the cartridge).

    Form fields:
      file   — strategy file (.py / .pine / .mq4 / .mq5)
      ticker — Yahoo Finance ticker symbol (e.g. SPY, AAPL, BTC-USD)
      start  — start date YYYY-MM-DD
      end    — end date YYYY-MM-DD
      cash   — starting capital (default 100000)
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    ticker = request.form.get('ticker', 'SPY')
    start = request.form.get('start', '2020-01-01')
    end = request.form.get('end', '2023-12-31')
    cash = float(request.form.get('cash', 100000))

    file_content = file.read().decode('utf-8', errors='replace')
    file_ext = os.path.splitext(file.filename)[1].lower()

    try:
        strategy_class, strategy_name, file_type = load_strategy(file_content, file_ext, file.filename)
        results = run_backtest(strategy_class, ticker, start, end, cash)
        results['strategy_name'] = strategy_name
        results['file_type'] = file_type
        results['status'] = 'success'
        return jsonify(results)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    print(f"CartridgeLab Console booting on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
