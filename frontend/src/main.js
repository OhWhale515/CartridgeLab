/**
 * CartridgeLab — Scene Bootstrap (main.js)
 * Initializes the Three.js console scene, camera, lighting, and animation loop.
 * All scene modules are imported and stitched together here.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildConsole } from './console.js';
import { initCartridgeSystem } from './cartridge.js';
import { initHUD, updateHUD } from './hud.js';
import { initMenu } from './menu.js';
import { initChartWorld, updateTerrain } from './chartworld.js';
import { runBacktest } from './api.js';
import { playSound } from './sounds.js';

// ─── Scene Setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('console-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05000f);
scene.fog = new THREE.FogExp2(0x05000f, 0.04);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4, 10);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 25;
controls.maxPolarAngle = Math.PI * 0.75;

// ─── Lighting — Neon Console Aesthetic ───────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x110022, 1.5);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0x00ffee, 2.0); // cyan key
keyLight.position.set(5, 8, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xaa00ff, 1.2); // purple fill
fillLight.position.set(-5, 3, -5);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xff6600, 0.6); // amber rim
rimLight.position.set(0, -2, -8);
scene.add(rimLight);

// ─── Build Scene Modules ──────────────────────────────────────────────────────
const consoleGroup = buildConsole(scene);
const chartWorld = initChartWorld(scene);
initHUD();
initMenu(onCartridgeSelected);
initCartridgeSystem(onFileDropped);

// ─── Event Handlers ───────────────────────────────────────────────────────────
async function onFileDropped(file) {
    playSound('insert');
    showRunConfig(file);
}

async function onCartridgeSelected(filename) {
    showRunConfig(null, filename);
}

function showRunConfig(file, presetFilename = null) {
    const panel = document.getElementById('run-config');
    panel.classList.remove('hidden');
    panel.dataset.file = presetFilename || '';

    document.getElementById('btn-run').onclick = async () => {
        const ticker = document.getElementById('cfg-ticker').value.trim().toUpperCase();
        const start = document.getElementById('cfg-start').value.trim();
        const end = document.getElementById('cfg-end').value.trim();
        const cash = parseFloat(document.getElementById('cfg-cash').value);
        panel.classList.add('hidden');
        await runWith(file, presetFilename, ticker, start, end, cash);
    };
}

async function runWith(file, presetFilename, ticker, start, end, cash) {
    showLoading(true, 'Initializing Cerebro...');
    playSound('running');

    try {
        const result = await runBacktest(file, presetFilename, ticker, start, end, cash);
        showLoading(false);
        playSound('reveal');

        // Update 3D terrain with equity curve
        updateTerrain(chartWorld, result.equity_curve);

        // Update HUD
        updateHUD(result);

        // Show HUD
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('cartridge-menu').classList.add('collapsed');

        // Strategy label
        const badge = document.getElementById('strategy-badge');
        badge.textContent = `${result.strategy_name} · ${ticker} · ${start} → ${end}`;
        badge.classList.remove('hidden');

    } catch (err) {
        showLoading(false);
        console.error('[CartridgeLab]', err);
        alert('Backtest failed: ' + err.message);
    }
}

function showLoading(show, message = '') {
    const screen = document.getElementById('loading-screen');
    if (show) {
        screen.classList.remove('hidden');
        document.getElementById('loading-sub').textContent = message;
        animateLoadingBar();
    } else {
        screen.classList.add('hidden');
    }
}

function animateLoadingBar() {
    const bar = document.getElementById('loading-bar');
    let progress = 0;
    const interval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 15, 90);
        bar.style.width = progress + '%';
        if (progress >= 90) clearInterval(interval);
    }, 200);
}

// ─── Resize Handler ───────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Animation Loop ───────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    controls.update();

    // Breathe the console power LED
    if (consoleGroup.userData.powerLED) {
        consoleGroup.userData.powerLED.material.emissiveIntensity =
            0.6 + Math.sin(elapsed * 1.5) * 0.4;
    }

    renderer.render(scene, camera);
}

animate();
console.log('%c🎮 CartridgeLab Console Ready', 'color:#00ffee;font-size:16px;font-family:monospace;');
