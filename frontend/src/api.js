/**
 * CartridgeLab — REST API Client (api.js)
 * Handles all communication between the Three.js frontend and the Flask backend.
 */

const API_BASE = '/api';

/**
 * Run a backtest. Accepts either a File object (user upload) or a preset filename (sample cartridge).
 */
export async function runBacktest(file, presetFilename, ticker, start, end, cash) {
    const formData = new FormData();

    if (file) {
        formData.append('file', file);
    } else if (presetFilename) {
        // Fetch sample cartridge from backend and re-upload as blob
        const resp = await fetch(`${API_BASE}/cartridge-file/${encodeURIComponent(presetFilename)}`);
        if (!resp.ok) throw new Error(`Could not load sample cartridge: ${presetFilename}`);
        const blob = await resp.blob();
        formData.append('file', blob, presetFilename);
    } else {
        throw new Error('No file or preset filename provided');
    }

    formData.append('ticker', ticker);
    formData.append('start', start);
    formData.append('end', end);
    formData.append('cash', cash.toString());

    const response = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        body: formData,
    });

    const data = await response.json();

    if (!response.ok || data.status === 'error') {
        throw new Error(data.message || 'Unknown backtest error');
    }

    return data;
}

/**
 * Fetch list of available sample cartridges.
 */
export async function fetchCartridges() {
    const resp = await fetch(`${API_BASE}/cartridges`);
    if (!resp.ok) throw new Error('Could not fetch cartridges');
    const data = await resp.json();
    return data.cartridges;
}

/**
 * Health check.
 */
export async function checkHealth() {
    const resp = await fetch(`${API_BASE}/health`);
    return resp.json();
}
