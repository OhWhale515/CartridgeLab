"""
CartridgeLab — Flask API Server
The console's I/O interface. Accepts cartridge files, runs backtests, returns results.
"""
import os
from bootstrap import BASE_DIR, configure_local_vendor

configure_local_vendor()

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from engine.cerebro_runner import run_backtest
from engine.strategy_loader import load_strategy

app = Flask(__name__)
CORS(app)

CARTRIDGES_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'cartridges'))
SUPPORTED_EXTENSIONS = {'.py', '.pine', '.mq4', '.mq5'}
SAMPLE_CARTRIDGE_METADATA = {
    'trend_quest.py': {
        'title': 'Trend Quest',
        'theme': 'Macro breakout baseline',
        'description': 'Baseline boss run: identify the dominant regime, wait for a confirmed breakout, then defend the move with an ATR trail.',
        'defaults': {
            'ticker': 'BTC-USD',
            'start': '2022-01-01',
            'end': '2025-01-01',
            'cash': 100000,
        },
    },
    'crypto_breakout_blitz.py': {
        'title': 'Crypto Breakout Blitz',
        'theme': 'Crypto arcade breakout',
        'description': 'Arcade sprint: chase explosive breakouts only when trend strength is live, then ride until the volatility shield fails.',
        'defaults': {
            'ticker': 'BTC-USD',
            'start': '2021-01-01',
            'end': '2025-01-01',
            'cash': 100000,
        },
    },
    'forex_range_raid.py': {
        'title': 'Forex Range Raid',
        'theme': 'Forex arena counter-fighter',
        'description': 'Counter-fighter mode: fade overstretched moves at the edges of the range and exit on the snap back toward equilibrium.',
        'defaults': {
            'ticker': 'EURUSD=X',
            'start': '2021-01-01',
            'end': '2025-01-01',
            'cash': 100000,
        },
    },
    'metals_momentum_guard.py': {
        'title': 'Metals Momentum Guard',
        'theme': 'Metals heavyweight boss fight',
        'description': 'Heavyweight duel: wait for momentum to reset, strike with the trend, and stay in until the metal loses force.',
        'defaults': {
            'ticker': 'GC=F',
            'start': '2020-01-01',
            'end': '2025-01-01',
            'cash': 100000,
        },
    },
    'stock_pullback_story.py': {
        'title': 'Stock Pullback Story',
        'theme': 'Stock campaign mode',
        'description': 'Campaign climb: buy controlled dips inside established uptrends and exit when the chapter overheats or breaks.',
        'defaults': {
            'ticker': 'SPY',
            'start': '2020-01-01',
            'end': '2025-01-01',
            'cash': 100000,
        },
    },
}


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "platform": "CartridgeLab", "version": "0.1.0"})


@app.route('/api/cartridges', methods=['GET'])
def list_cartridges():
    """Return all available sample cartridges from the cartridges/ directory."""
    cartridges = []
    for fname in os.listdir(CARTRIDGES_DIR):
        ext = os.path.splitext(fname)[1].lower()
        if ext in SUPPORTED_EXTENSIONS:
            metadata = SAMPLE_CARTRIDGE_METADATA.get(fname, {})
            cartridges.append({
                "name": fname,
                "type": ext.lstrip('.'),
                "path": fname,
                "title": metadata.get('title', fname),
                "theme": metadata.get('theme'),
                "description": metadata.get('description'),
                "defaults": metadata.get('defaults'),
            })
    return jsonify({"cartridges": cartridges})


@app.route('/api/cartridge-file/<path:filename>', methods=['GET'])
def get_cartridge_file(filename: str):
    """Return a sample cartridge file so the frontend can run presets."""
    safe_name = os.path.basename(filename)
    ext = os.path.splitext(safe_name)[1].lower()

    if safe_name != filename or ext not in SUPPORTED_EXTENSIONS:
        return jsonify({"error": "Invalid cartridge filename"}), 400

    full_path = os.path.join(CARTRIDGES_DIR, safe_name)
    if not os.path.isfile(full_path):
        return jsonify({"error": "Cartridge not found"}), 404

    return send_from_directory(CARTRIDGES_DIR, safe_name, as_attachment=False)


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
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"status": "error", "message": "Uploaded file must have a filename"}), 400

    ticker = request.form.get('ticker', 'SPY')
    start = request.form.get('start', '2020-01-01')
    end = request.form.get('end', '2023-12-31')
    try:
        cash = float(request.form.get('cash', 100000))
    except (TypeError, ValueError):
        return jsonify({"status": "error", "message": "Cash must be a valid number"}), 400

    if cash <= 0:
        return jsonify({"status": "error", "message": "Cash must be greater than zero"}), 400

    file_content = file.read().decode('utf-8', errors='replace')
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in SUPPORTED_EXTENSIONS:
        return jsonify({"status": "error", "message": f"Unsupported cartridge type: {file_ext or 'unknown'}"}), 400

    try:
        strategy_class, strategy_name, file_type = load_strategy(file_content, file_ext, file.filename)
        results = run_backtest(strategy_class, ticker, start, end, cash)
        results['strategy_name'] = strategy_name
        results['file_type'] = file_type
        results['status'] = 'success'
        return jsonify(results)
    except ValueError as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    print(f"CartridgeLab Console booting on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
