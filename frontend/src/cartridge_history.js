/* ────────────────────────────────────────────────────────────────────
   Cartridge History — localStorage Persistence Layer
   Tracks per-cartridge run history, wear data, and boss kills.
   Powers the cartridge battle scars and discovery map.
   ──────────────────────────────────────────────────────────────────── */

const HISTORY_KEY = 'cartridgelab_cartridge_history';
const MAP_KEY = 'cartridgelab_discovery_map';

/* ── simple string hash for strategy identification ── */
function hashStrategy(name) {
    let hash = 0;
    const str = String(name || 'unknown');
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return 'strat_' + Math.abs(hash).toString(36);
}

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    } catch {
        return {};
    }
}

function saveHistory(history) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch { /* full */ }
}

/* ────────────────────────────────────────────────────────────────────
   getCartridgeWear — returns wear data for the 3D cartridge model
   ──────────────────────────────────────────────────────────────────── */
export function getCartridgeWear(strategyName) {
    const history = loadHistory();
    const id = hashStrategy(strategyName);
    const entry = history[id];

    if (!entry) {
        return {
            runs: 0,
            worstDD: 0,
            bestSharpe: 0,
            bossesBeaten: [],
            failures: 0,
            wearLevel: 0,  // 0 = pristine, 1 = scuffed, 2 = veteran, 3 = legendary
        };
    }

    let wearLevel = 0;
    if (entry.runs >= 3) wearLevel = 1;
    if (entry.runs >= 10 || entry.bossesBeaten.length > 0) wearLevel = 2;
    if (entry.runs >= 25 || entry.bossesBeaten.length >= 3) wearLevel = 3;

    return { ...entry, wearLevel };
}

/* ────────────────────────────────────────────────────────────────────
   recordRun — update history after a backtest
   ──────────────────────────────────────────────────────────────────── */
export function recordRun(strategyName, results, bossId = null) {
    const history = loadHistory();
    const id = hashStrategy(strategyName);

    if (!history[id]) {
        history[id] = {
            name: strategyName,
            runs: 0,
            worstDD: 0,
            bestSharpe: -Infinity,
            bossesBeaten: [],
            failures: 0,
            lastRun: null,
        };
    }

    const entry = history[id];
    entry.runs += 1;
    entry.lastRun = Date.now();

    const sharpe = Number(results?.sharpe ?? 0);
    const maxDD = Math.abs(Number(results?.max_drawdown ?? 0));
    const totalReturn = Number(results?.total_return ?? 0);

    if (maxDD > entry.worstDD) entry.worstDD = maxDD;
    if (sharpe > entry.bestSharpe) entry.bestSharpe = sharpe;
    if (sharpe < 0.5 || totalReturn < -20) entry.failures += 1;

    if (bossId && totalReturn > -25 && !entry.bossesBeaten.includes(bossId)) {
        entry.bossesBeaten.push(bossId);
    }

    saveHistory(history);

    /* also record to the discovery map */
    recordToDiscoveryMap(strategyName, results, bossId);

    return getCartridgeWear(strategyName);
}

/* ────────────────────────────────────────────────────────────────────
   Discovery Map Data
   Each run = a tile on the persistent exploration map.
   ──────────────────────────────────────────────────────────────────── */
function loadMapData() {
    try {
        return JSON.parse(localStorage.getItem(MAP_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveMapData(data) {
    try {
        localStorage.setItem(MAP_KEY, JSON.stringify(data));
    } catch { /* full */ }
}

function recordToDiscoveryMap(strategyName, results, bossId) {
    const map = loadMapData();

    map.push({
        id: Date.now().toString(36),
        name: strategyName,
        timestamp: Date.now(),
        sharpe: Number(results?.sharpe ?? 0),
        totalReturn: Number(results?.total_return ?? 0),
        maxDrawdown: Math.abs(Number(results?.max_drawdown ?? 0)),
        tradeCount: (results?.trades || []).length,
        bossId: bossId || null,
        profitable: Number(results?.total_return ?? 0) > 0,
    });

    /* cap at 200 entries to prevent localStorage bloat */
    if (map.length > 200) {
        map.splice(0, map.length - 200);
    }

    saveMapData(map);
}

export function getDiscoveryMapData() {
    return loadMapData();
}

export function getMapStats() {
    const map = loadMapData();
    return {
        totalRuns: map.length,
        profitable: map.filter((e) => e.profitable).length,
        unprofitable: map.filter((e) => !e.profitable).length,
        bossAttempts: map.filter((e) => e.bossId).length,
        bestSharpe: map.reduce((best, e) => Math.max(best, e.sharpe), -Infinity),
        uniqueStrategies: new Set(map.map((e) => e.name)).size,
    };
}
