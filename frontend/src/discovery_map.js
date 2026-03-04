/* ────────────────────────────────────────────────────────────────────
   Discovery Map — Persistent 2D Exploration Overview
   Shows all past runs as hexagonal tiles. Green = profitable,
   red = unprofitable, gold = boss battle survived.
   Hover to see details. Click to revisit.
   Inspired by Metroid's map: the joy of seeing it fill in.
   ──────────────────────────────────────────────────────────────────── */

import { getDiscoveryMapData, getMapStats } from './cartridge_history.js';

const MAP_SIZE = 200;
const MAP_SIZE_XL = 400;
const HEX_RADIUS = 14;
const COLS = 10;

export function initDiscoveryMap() {
    /* remove existing if present */
    const existing = document.getElementById('discovery-map');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'discovery-map';
    wrapper.className = 'discovery-map';

    const header = document.createElement('div');
    header.className = 'discovery-map-header';
    header.innerHTML = '🗺️ DISCOVERY MAP';
    wrapper.appendChild(header);

    const canvas = document.createElement('canvas');
    canvas.id = 'discovery-map-canvas';
    canvas.width = MAP_SIZE;
    canvas.height = MAP_SIZE;
    canvas.className = 'discovery-map-canvas';
    wrapper.appendChild(canvas);

    const stats = document.createElement('div');
    stats.id = 'discovery-map-stats';
    stats.className = 'discovery-map-stats';
    wrapper.appendChild(stats);

    document.body.appendChild(wrapper);

    renderMap();

    /* hover to expand */
    wrapper.addEventListener('mouseenter', () => {
        canvas.width = MAP_SIZE_XL;
        canvas.height = MAP_SIZE_XL;
        renderMap();
    });

    wrapper.addEventListener('mouseleave', () => {
        canvas.width = MAP_SIZE;
        canvas.height = MAP_SIZE;
        renderMap();
    });
}

export function renderMap() {
    const canvas = document.getElementById('discovery-map-canvas');
    const statsEl = document.getElementById('discovery-map-stats');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const data = getDiscoveryMapData();
    const mapStats = getMapStats();

    /* clear */
    ctx.fillStyle = '#04070f';
    ctx.fillRect(0, 0, w, h);

    /* grid of hex slots */
    const hexR = (w / MAP_SIZE) * HEX_RADIUS;
    const hexW = hexR * 2;
    const hexH = Math.sqrt(3) * hexR;
    const cols = COLS;
    const rows = Math.ceil(200 / cols);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const idx = row * cols + col;
            const offsetX = (row % 2) * (hexW * 0.75);
            const cx = col * hexW * 1.5 + hexR + 4 + offsetX;
            const cy = row * hexH + hexR + 4;

            if (cx > w - 4 || cy > h - 4) continue;

            const entry = data[idx];

            if (entry) {
                /* filled tile */
                let fillColor = entry.profitable ? '#00ff88' : '#ff2255';
                if (entry.bossId) fillColor = '#ffd56a';

                drawHex(ctx, cx, cy, hexR - 1, fillColor, 0.75);

                /* tiny label */
                ctx.fillStyle = '#ffffff';
                ctx.font = `${Math.max(6, hexR * 0.45)}px monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(
                    entry.sharpe > 0 ? entry.sharpe.toFixed(1) : '✕',
                    cx, cy + hexR * 0.18,
                );
            } else {
                /* fog of war — unexplored */
                drawHex(ctx, cx, cy, hexR - 1, '#0a1830', 0.3);
            }
        }
    }

    /* grid border glow */
    ctx.strokeStyle = '#2af6ff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.15;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.globalAlpha = 1.0;

    /* stats */
    if (statsEl) {
        statsEl.innerHTML = `
            <span class="map-stat">${mapStats.totalRuns} runs</span>
            <span class="map-stat green">${mapStats.profitable} ✓</span>
            <span class="map-stat red">${mapStats.unprofitable} ✕</span>
        `;
    }
}

function drawHex(ctx, cx, cy, r, color, alpha) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();

    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = '#2af6ff';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.globalAlpha = 1.0;
}
