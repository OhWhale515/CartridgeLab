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
import brandImage from '../../cjcrib.jfif';

let splashDismissed = false;
let splashBooting = false;

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
applyThemeBranding();
setHeroIdle(true);
initHUD();
initMenu(onCartridgeSelected);
initCartridgeSystem(onFileDropped);
initMenuDock();
initSplashScreen();

// ─── Event Handlers ───────────────────────────────────────────────────────────
async function onFileDropped(file) {
    await dismissSplashScreen();
    playSound('insert');
    setMenuCollapsed(false);
    setHeroIdle(false);
    showRunConfig(file);
}

async function onCartridgeSelected(cartridge) {
    await dismissSplashScreen();
    setMenuCollapsed(false);
    setHeroIdle(false);
    showRunConfig(null, cartridge);
}

function showRunConfig(file, preset = null) {
    const panel = document.getElementById('run-config');
    panel.classList.remove('hidden');
    panel.dataset.file = preset?.name || '';

    applyRunConfigPreset(file, preset);

    document.getElementById('btn-run').onclick = async () => {
        const ticker = document.getElementById('cfg-ticker').value.trim().toUpperCase();
        const start = document.getElementById('cfg-start').value.trim();
        const end = document.getElementById('cfg-end').value.trim();
        const cash = parseFloat(document.getElementById('cfg-cash').value);
        panel.classList.add('hidden');
        await runWith(file, preset?.name || null, ticker, start, end, cash);
    };
}

function applyRunConfigPreset(file, preset) {
    const nameNode = document.getElementById('cfg-game-name');
    const themeNode = document.getElementById('cfg-game-theme');
    const blurbNode = document.getElementById('cfg-game-blurb');
    const tickerInput = document.getElementById('cfg-ticker');
    const startInput = document.getElementById('cfg-start');
    const endInput = document.getElementById('cfg-end');
    const cashInput = document.getElementById('cfg-cash');

    if (preset) {
        nameNode.textContent = preset.title || preset.name;

        if (preset.theme) {
            themeNode.textContent = preset.theme;
            themeNode.classList.remove('hidden');
        } else {
            themeNode.textContent = '';
            themeNode.classList.add('hidden');
        }

        blurbNode.textContent = preset.description || 'Select the market, then press play.';

        if (preset.defaults) {
            tickerInput.value = preset.defaults.ticker || tickerInput.value;
            startInput.value = preset.defaults.start || startInput.value;
            endInput.value = preset.defaults.end || endInput.value;
            cashInput.value = String(preset.defaults.cash || cashInput.value);
        }
        return;
    }

    nameNode.textContent = file?.name || 'CUSTOM CARTRIDGE';
    themeNode.textContent = 'Custom file';
    themeNode.classList.remove('hidden');
    blurbNode.textContent = 'Manual mode: choose the ticker, date range, and capital for this cartridge run.';
}

async function runWith(file, presetFilename, ticker, start, end, cash) {
    showLoading(true, 'Initializing Cerebro...');
    setHudStage('Running simulation');
    playSound('running');

    try {
        const result = await runBacktest(file, presetFilename, ticker, start, end, cash);
        showLoading(false);
        playSound('reveal');

        // Update 3D terrain with equity curve
        updateTerrain(chartWorld, result.equity_curve);

        // Update HUD
        updateHUD(result);
        setHudStage(`${result.strategy_name} loaded`);

        // Show HUD
        document.getElementById('hud').classList.remove('hidden');
        setMenuCollapsed(true);
        setHeroIdle(false);
        triggerResultReveal();

        // Strategy label
        const badge = document.getElementById('strategy-badge');
        const badgeText = document.getElementById('strategy-badge-text');
        badgeText.textContent = `${result.strategy_name} · ${ticker} · ${start} → ${end}`;
        badge.classList.remove('hidden');

    } catch (err) {
        showLoading(false);
        setHudStage('Run failed');
        console.error('[CartridgeLab]', err);
        alert('Backtest failed: ' + err.message);
    }
}

function initMenuDock() {
    const toggle = document.getElementById('menu-toggle');
    if (!toggle) {
        return;
    }

    toggle.addEventListener('click', () => {
        const menu = document.getElementById('cartridge-menu');
        const isCollapsed = menu?.classList.contains('collapsed');
        setMenuCollapsed(!isCollapsed);
    });
}

function setMenuCollapsed(collapsed) {
    const menu = document.getElementById('cartridge-menu');
    const toggle = document.getElementById('menu-toggle');
    if (!menu || !toggle) {
        return;
    }

    menu.classList.toggle('collapsed', collapsed);
    toggle.textContent = collapsed ? '▶' : '◀';
    toggle.setAttribute('aria-label', collapsed ? 'Expand cartridge menu' : 'Collapse cartridge menu');
}

function applyThemeBranding() {
    document.documentElement.style.setProperty('--brand-image', `url("${brandImage}")`);
}

function initSplashScreen() {
    const startButton = document.getElementById('splash-start');
    if (!startButton) {
        return;
    }

    startButton.addEventListener('click', async () => {
        await dismissSplashScreen();
    });

    window.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            await dismissSplashScreen();
        }
    });
}

async function dismissSplashScreen() {
    const splash = document.getElementById('splash-screen');
    const startButton = document.getElementById('splash-start');
    if (!splash || splashDismissed) {
        return;
    }

    if (splashBooting) {
        return;
    }

    splashBooting = true;
    if (startButton) {
        startButton.disabled = true;
        startButton.textContent = 'BOOTING...';
    }

    await runBootSequence();
    splash.classList.add('is-dismissed');
    splashDismissed = true;
    splashBooting = false;
}

function setHeroIdle(isIdle) {
    const hero = document.getElementById('brand-hero');
    if (!hero) {
        return;
    }

    hero.classList.toggle('brand-hero-idle', isIdle);
    hero.classList.toggle('brand-hero-compact', !isIdle);
}

function setHudStage(message) {
    const node = document.getElementById('hud-stage');
    if (!node) {
        return;
    }

    node.textContent = message;
}

function triggerResultReveal() {
    const hud = document.getElementById('hud');
    const badge = document.getElementById('strategy-badge');
    if (!hud || !badge) {
        return;
    }

    hud.classList.remove('is-revealing');
    badge.classList.remove('is-revealing');

    requestAnimationFrame(() => {
        hud.classList.add('is-revealing');
        badge.classList.add('is-revealing');
    });
}

async function runBootSequence() {
    const phases = [
        { label: 'Warming the flagship core...', progress: 24, sound: 'boot1', light: 0.95 },
        { label: 'Loading cartridge library...', progress: 56, sound: 'boot2', light: 1.2 },
        { label: 'Syncing market terrain...', progress: 82, sound: 'boot3', light: 1.45 },
        { label: 'Console ready.', progress: 100, sound: 'boot4', light: 1.7 },
    ];

    for (const phase of phases) {
        setSplashStatus(phase.label, phase.progress);
        playSound(phase.sound);
        pulseBootLight(phase.light);
        await wait(320);
    }
}

function setSplashStatus(message, progress) {
    const status = document.getElementById('splash-status');
    const bar = document.getElementById('splash-progress');
    if (status) {
        status.textContent = message;
    }
    if (bar) {
        bar.style.width = `${progress}%`;
    }
}

function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pulseBootLight(targetIntensity) {
    const led = consoleGroup?.userData?.powerLED;
    if (!led?.material) {
        return;
    }

    led.material.emissiveIntensity = targetIntensity;
    window.setTimeout(() => {
        led.material.emissiveIntensity = 0.7;
    }, 180);
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
