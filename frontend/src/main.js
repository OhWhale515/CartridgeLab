/**
 * CartridgeLab — Scene Bootstrap (main.js)
 * Initializes the Three.js console scene, camera, lighting, and animation loop.
 * All scene modules are imported and stitched together here.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import { buildConsole } from './console.js';
import { initCartridgeSystem } from './cartridge.js';
import { initHUD, updateHUD } from './hud.js';
import { initMenu } from './menu.js';
import { initChartWorld, updateTerrain } from './chartworld.js';
import { initReplayLane, renderReplayLane } from './replaylane_pixi.js';
import { fetchIntegrationStatus, fetchRuns, runBacktest } from './api.js';
import { playSound, sonifyEquityCurve, stopSonification, isSonifying } from './sounds.js';
import { initWeather, updateWeather, setWeatherRegime, detectRegimeFromEquity } from './weather.js';
import { shouldShowAutopsy, generateAutopsyData, showAutopsyOverlay, removeAutopsyOverlay } from './autopsy.js';
import { checkAchievements } from './achievements.js';
import { recordRun, getCartridgeWear } from './cartridge_history.js';
import { initDiscoveryMap, renderMap as renderDiscoveryMap } from './discovery_map.js';
import brandImage from '../../slimlogobrain.png';
import gameSplashImage from '../../TradingGame.png';

let splashDismissed = false;
let splashBooting = false;
let sonifyEnabled = false;
let currentStrategyName = '';
const replayState = {
    timer: null,
    paused: false,
    speed: 0.5,
    step: 0,
    result: null,
    selectedTradeIndex: -1,
    eventsShown: 0,
    checkpointsShown: 0,
};
const consoleState = {
    insertTarget: 0,
    insertDisplay: 0,
    shellScaleTarget: 1,
    shellLiftTarget: 0,
    ledTarget: 0.7,
    slotGlowTarget: 0.08,
    stripTarget: 0.35,
};

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
// Note: scene.fog will be managed by weather.js — do not set here

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
const replayLane = initReplayLane(document.getElementById('replay-lane'));
initWeather(scene);
applyThemeBranding();
setGameShellActive(false);
setHeroIdle(true);
setText('brand-hero-subtitle', 'Rank: Apex | Status: Ready | Awaiting deployment.');
setConsolePrompt('SYSTEM READY', 'Select a cartridge to begin.');
initHUD();
initMenu(onCartridgeSelected);
initCartridgeSystem(onFileDropped);
initMenuDock();
initSplashScreen();
initReplayControls();
initTradeInspector();
initConsoleGameDrop();
initControlSurface();
initDiscoveryMap();
initSonifyToggle();

// ─── Event Handlers ───────────────────────────────────────────────────────────
async function onFileDropped(file) {
    await dismissSplashScreen();
    playSound('insert');
    removeAutopsyOverlay();
    setMenuCollapsed(false);
    setGameShellActive(false);
    setHeroIdle(false);
    currentStrategyName = file?.name || 'Custom cartridge';

    if (consoleGroup?.userData?.setCartridgeTheme) {
        consoleGroup.userData.setCartridgeTheme(file?.name || '');
    }

    armConsoleForSelection(currentStrategyName);
    showRunConfig(file);
}

async function onCartridgeSelected(cartridge) {
    await dismissSplashScreen();
    removeAutopsyOverlay();
    setMenuCollapsed(false);
    setGameShellActive(false);
    setHeroIdle(false);
    currentStrategyName = cartridge?.title || cartridge?.name || 'Trading cartridge';

    if (consoleGroup?.userData?.setCartridgeTheme) {
        consoleGroup.userData.setCartridgeTheme(cartridge?.type || cartridge?.title || cartridge?.name || '');
    }

    armConsoleForSelection(currentStrategyName);
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
        const fillPolicy = document.getElementById('cfg-fill-policy').value;
        const spreadBps = parseFloat(document.getElementById('cfg-spread-bps').value);
        const slippageBps = parseFloat(document.getElementById('cfg-slippage-bps').value);
        const commissionBps = parseFloat(document.getElementById('cfg-commission-bps').value);
        const marketDataFile = document.getElementById('cfg-market-data')?.files?.[0] || null;
        panel.classList.add('hidden');
        await runWith(file, preset?.name || null, ticker, start, end, cash, marketDataFile, {
            fillPolicy,
            spreadBps,
            slippageBps,
            commissionBps,
        });
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
    const fillPolicyInput = document.getElementById('cfg-fill-policy');
    const spreadInput = document.getElementById('cfg-spread-bps');
    const slippageInput = document.getElementById('cfg-slippage-bps');
    const commissionInput = document.getElementById('cfg-commission-bps');
    const marketDataInput = document.getElementById('cfg-market-data');

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
        fillPolicyInput.value = 'bar_close';
        spreadInput.value = '2';
        slippageInput.value = '1';
        commissionInput.value = '10';
        if (marketDataInput) {
            marketDataInput.value = '';
        }
        return;
    }

    nameNode.textContent = file?.name || 'CUSTOM CARTRIDGE';
    themeNode.textContent = 'Custom file';
    themeNode.classList.remove('hidden');
    blurbNode.textContent = 'Manual mode: choose the ticker, date range, and capital for this cartridge run.';
    fillPolicyInput.value = 'bar_close';
    spreadInput.value = '2';
    slippageInput.value = '1';
    commissionInput.value = '10';
    if (marketDataInput) {
        marketDataInput.value = '';
    }
}

async function runWith(file, presetFilename, ticker, start, end, cash, marketDataFile = null, executionConfig = {}) {
    await playInsertTransition(presetFilename || file?.name || 'Custom cartridge');
    showLoading(true, 'Initializing Cerebro...');
    setHudStage('Running simulation');
    resetReplay();
    setConsolePrompt('GAME BOOT', 'Launching market arena...');
    playSound('running');

    try {
        const result = await runBacktest(file, presetFilename, ticker, start, end, cash, marketDataFile, executionConfig);
        showLoading(false);
        hideLaunchTransition();
        setGameShellActive(true);
        playSound('reveal');

        startReplay(result, ticker, start, end);

    } catch (err) {
        showLoading(false);
        hideLaunchTransition();
        setHudStage('Run failed');
        setReplayStatus('Run failed before replay.');
        console.error('[CartridgeLab]', err);
        alert('Backtest failed: ' + err.message);
    }
}

// GSAP Animated Insert Transition
async function playInsertTransition(label) {
    const overlay = document.getElementById('launch-transition');
    const title = document.getElementById('launch-transition-title');
    const sub = document.getElementById('launch-transition-sub');

    if (!overlay) return;

    overlay.classList.add('insert-mode', 'is-visible');
    overlay.classList.remove('hidden');

    if (title) {
        title.textContent = String(label || 'Trading cartridge').replace(/[_-]+/g, ' ').toUpperCase();
    }

    setConsolePrompt('INSERTING GAME', 'Seating cartridge into the console bus.');
    playSound('insert');

    // Make sure cartridge starts in its armed (floating) position
    if (consoleGroup && consoleGroup.userData.cartridge) {
        gsap.set(consoleGroup.userData.cartridge.position, { y: 3.8, z: -0.6 });
        gsap.set(consoleGroup.userData.cartridge.rotation, { x: -0.15 });
    }

    // Wrap the timeline in a promise so `await` still works
    return new Promise(resolve => {
        const tl = gsap.timeline({
            onComplete: () => {
                if (sub) sub.textContent = 'Launching trading game...';
                setLaunchTransitionState('Mounting market arena...', 100);
                resolve();
            }
        });

        // Phase 1: Descend to float above slot
        tl.to(consoleGroup.userData.cartridge.position, {
            y: 2.15,
            z: 0.1,
            duration: 0.5,
            ease: "power2.inOut",
            onStart: () => {
                if (sub) sub.textContent = 'Reading cartridge contacts...';
                setLaunchTransitionState('Reading contacts', 22);
                consoleState.ledTarget = 1.55;
            }
        }, 0);

        // Phase 2: Insert violently (snap down into slot, tilt forward)
        tl.to(consoleGroup.userData.cartridge.position, {
            y: 1.5, // Slide deep into the slot
            duration: 0.4,
            ease: "back.out(1.2)",
            onStart: () => {
                if (sub) sub.textContent = 'Locking into console bus...';
                setLaunchTransitionState('Syncing memory rails...', 58);
                consoleState.ledTarget = 2.2;
                consoleState.slotGlowTarget = 0.88;
                consoleState.stripTarget = 1.05;
                playSound('insert'); // Satisfying click
            }
        }, 0.6);

        tl.to(consoleGroup.userData.cartridge.rotation, {
            x: 0, // Tilt flat
            duration: 0.3,
            ease: "power1.out"
        }, 0.6);

        // Phase 3: Console Shake/Rebound
        tl.to(consoleGroup.position, {
            y: consoleGroup.userData.baseShellY - 0.05,
            duration: 0.1,
            yoyo: true,
            repeat: 1,
            onStart: () => {
                if (sub) sub.textContent = 'Cartridge verified.';
                setLaunchTransitionState('Routing control to game core...', 95);
            }
        }, 0.65);

        // Cool down the lights
        tl.to(consoleState, {
            ledTarget: 1.1,
            slotGlowTarget: 0.46,
            stripTarget: 0.72,
            duration: 0.5
        }, "+=0.2");
    });
}

function setLaunchTransitionState(message, progress) {
    const phaseNode = document.getElementById('launch-transition-phase');
    const progressNode = document.getElementById('launch-transition-progress');
    if (phaseNode) {
        phaseNode.textContent = message;
    }
    if (progressNode) {
        progressNode.style.width = `${Math.max(0, Math.min(progress || 0, 100))}%`;
    }
}

function hideLaunchTransition() {
    const overlay = document.getElementById('launch-transition');
    if (!overlay) {
        return;
    }

    overlay.classList.remove('is-visible');
    window.setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('insert-mode');
        setLaunchTransitionState('Awaiting cartridge lock...', 0);
    }, 180);
}

function initMenuDock() {
    const toggle = document.getElementById('menu-toggle');
    if (!toggle) {
        return;
    }

    toggle.textContent = '-';

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
    toggle.setAttribute('aria-label', collapsed ? 'Expand cartridge menu' : 'Collapse cartridge menu');
    toggle.textContent = collapsed ? '+' : '-';
}

function applyThemeBranding() {
    document.documentElement.style.setProperty('--brand-image', `url("${brandImage}")`);
    document.documentElement.style.setProperty('--game-splash-image', `url("${gameSplashImage}")`);
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

function setGameShellActive(active) {
    [
        document.getElementById('brand-hero'),
        document.getElementById('utility-cluster'),
        document.getElementById('market-stage'),
        document.getElementById('telemetry-bar'),
    ].forEach((node) => {
        if (!node) {
            return;
        }
        node.classList.toggle('hidden', !active);
    });

    if (!active) {
        document.getElementById('strategy-badge')?.classList.add('hidden');
        document.getElementById('hud')?.classList.add('hidden');
        document.getElementById('replay-panel')?.classList.add('hidden');
        document.getElementById('trade-inspector')?.classList.add('hidden');
        document.getElementById('execution-analysis')?.classList.add('hidden');
        document.getElementById('run-analysis')?.classList.add('hidden');
    }
}

function initConsoleGameDrop() {
    const canvasTarget = document.getElementById('console-canvas');
    const promptTarget = document.getElementById('console-room-prompt');
    const targets = [canvasTarget, promptTarget].filter(Boolean);
    if (!targets.length) {
        return;
    }

    const readState = () => {
        animateConsoleInsert({
            scale: 1.01,
            lift: 0.02,
            light: 1.45,
            slotGlow: 0.66,
            strip: 0.92,
            insert: 0.04,
        });
        setConsolePrompt('DROP TO INSERT', 'Release the cartridge over the console.');
        document.body.classList.add('console-drop-armed');
    };

    const clearState = () => {
        document.body.classList.remove('console-drop-armed');
    };

    targets.forEach((target) => {
        ['dragenter', 'dragover'].forEach((eventName) => {
            target.addEventListener(eventName, (event) => {
                const types = Array.from(event.dataTransfer?.types || []);
                if (!types.includes('application/x-cartridgelab')) {
                    return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
                readState();
            });
        });

        target.addEventListener('dragleave', () => {
            clearState();
        });

        target.addEventListener('drop', async (event) => {
            const payload = event.dataTransfer?.getData('application/x-cartridgelab');
            if (!payload) {
                return;
            }

            event.preventDefault();
            clearState();
            try {
                const cartridge = JSON.parse(payload);
                await onCartridgeSelected(cartridge);
            } catch (error) {
                console.error('[CartridgeLab]', error);
            }
        });
    });
}

function initControlSurface() {
    const utilityButtons = Array.from(document.querySelectorAll('#utility-cluster .utility-btn'));
    const utilityMap = ['net', 'fx', 'sys'];
    utilityButtons.forEach((button, index) => {
        const panelKey = utilityMap[index] || 'sys';
        button.dataset.panel = panelKey;
        button.textContent = panelKey.toUpperCase();
        button.addEventListener('click', () => openSystemPanel(panelKey));
    });

    const navMap = ['trade', 'market', 'skills', 'quests', 'leaderboard', 'inventory'];
    document.querySelectorAll('.menu-nav-item').forEach((button, index) => {
        const mode = navMap[index] || 'trade';
        button.dataset.panel = mode;
        button.addEventListener('click', () => openSystemPanel(mode));
    });

    document.getElementById('system-panel-close')?.addEventListener('click', () => {
        closeSystemPanel();
    });

    document.getElementById('system-panel-primary')?.addEventListener('click', async () => {
        const panel = document.getElementById('system-panel');
        const mode = panel?.dataset.mode || 'trade';
        if (mode === 'net') {
            await openSystemPanel('net');
            return;
        }
        if (mode === 'market') {
            setGameShellActive(true);
            setConsolePrompt('MARKET WATCH', 'Charts are live in watch mode.');
            closeSystemPanel();
            return;
        }
        if (mode === 'fx') {
            replayState.speed = replayState.speed === 0.5 ? 1 : 0.5;
            const speedButton = document.getElementById('replay-speed');
            if (speedButton) {
                speedButton.textContent = `${replayState.speed}X`;
            }
            openSystemPanel('fx');
            return;
        }
        if (mode === 'leaderboard' || mode === 'trade') {
            await openSystemPanel(mode);
            return;
        }
        closeSystemPanel();
    });
}

async function openSystemPanel(mode) {
    const panel = document.getElementById('system-panel');
    const kicker = document.getElementById('system-panel-kicker');
    const title = document.getElementById('system-panel-title');
    const body = document.getElementById('system-panel-body');
    const meta = document.getElementById('system-panel-meta');
    const primary = document.getElementById('system-panel-primary');
    if (!panel || !kicker || !title || !body || !meta || !primary) {
        return;
    }

    panel.dataset.mode = mode;
    panel.classList.remove('hidden');

    const defaults = {
        trade: {
            kicker: 'TRADE MODULE',
            title: 'Strategy Launch',
            body: 'Load cartridges, configure runs, and enter replay mode from the console.',
            meta: 'Primary path: configure run -> insert cartridge -> launch replay.',
            primary: 'RUN READY',
        },
        market: {
            kicker: 'MARKET VIEW',
            title: 'Chart Watch',
            body: 'Open the market stage without a backtest and use the console as a live chart surface.',
            meta: 'Use this as a TradingView-style watch mode while building toward live Pine bridge support.',
            primary: 'OPEN WATCH',
        },
        skills: {
            kicker: 'SKILLS',
            title: 'Strategy Kits',
            body: 'Future home for templates, strategy assistants, and reusable risk presets.',
            meta: 'Planned: Python cartridges, Pine webhook templates, and coach-mode helpers.',
            primary: 'OK',
        },
        quests: {
            kicker: 'QUESTS',
            title: 'Guided Challenges',
            body: 'Structured missions will teach strategy tuning and benchmark beating.',
            meta: 'Planned: beat drawdown caps, survive chop, and outscore baseline strategies.',
            primary: 'OK',
        },
        leaderboard: {
            kicker: 'LEADERBOARD',
            title: 'Run Ranking',
            body: 'This panel will rank saved runs by score, Sharpe, drawdown, and consistency.',
            meta: 'Planned: best campaigns, strongest boss clears, and most stable systems.',
            primary: 'OK',
        },
        inventory: {
            kicker: 'INVENTORY',
            title: 'Saved Assets',
            body: 'Use this for cartridges, saved presets, datasets, and imported connectors.',
            meta: 'Planned: cartridge vault, data packs, and signal bridge profiles.',
            primary: 'OK',
        },
        fx: {
            kicker: 'FX CONTROL',
            title: 'Replay Speed',
            body: 'Adjust playback pacing and visual intensity for the current simulation.',
            meta: `Current replay speed: ${replayState.speed}X`,
            primary: 'TOGGLE SPEED',
        },
        sys: {
            kicker: 'SYSTEM',
            title: 'Console Status',
            body: 'Inspect runtime state, launch flow, and platform readiness from the console shell.',
            meta: `Game shell: ${document.getElementById('market-stage')?.classList.contains('hidden') ? 'hidden' : 'visible'}`,
            primary: 'OK',
        },
    };

    const selected = defaults[mode] || defaults.trade;
    kicker.textContent = selected.kicker;
    title.textContent = selected.title;
    body.textContent = selected.body;
    meta.textContent = selected.meta;
    primary.textContent = selected.primary;

    if (mode === 'net') {
        kicker.textContent = 'NETWORK';
        title.textContent = 'TradingView Bridge';
        body.textContent = 'Inspect webhook readiness for Pine-script alerts and paper-routing status.';
        meta.textContent = 'Loading integration state...';
        primary.textContent = 'REFRESH';
        try {
            const status = await fetchIntegrationStatus();
            const tv = status.tradingview || {};
            const network = status.network || {};
            meta.textContent = [
                `API: ${network.api || 'unknown'}`,
                `ENGINE: ${network.engine || 'unknown'}`,
                `PAPER ROUTER: ${network.paper_router || 'unknown'}`,
                `TV MODE: ${tv.mode || 'unknown'}`,
                `WEBHOOK: ${tv.webhook_url || 'n/a'}`,
                `LAST SIGNAL: ${tv.last_signal ? `${tv.last_signal.signal} ${tv.last_signal.symbol}` : 'none'}`,
            ].join('\n');
        } catch (error) {
            meta.textContent = `Integration status unavailable.\n${error.message}`;
        }
        return;
    }

    if (mode === 'trade' && replayState.result?.run_id) {
        const assumptions = replayState.result.execution_assumptions || {};
        const lifecycleCount = Array.isArray(replayState.result.order_lifecycle) ? replayState.result.order_lifecycle.length : 0;
        const executionSummary = replayState.result.execution_summary || {};
        const analysis = replayState.result.run_analysis || {};
        const fillStress = replayState.result.fill_stress || {};
        meta.textContent = [
            `RUN ID: ${replayState.result.run_id}`,
            `STRATEGY: ${replayState.result.strategy_name || 'unknown'}`,
            `PAIR: ${replayState.result.ticker || 'n/a'}`,
            `RETURN: ${Number(replayState.result.total_return || 0).toFixed(2)}%`,
            `W/L: ${Number(analysis.winning_trades || 0)} / ${Number(analysis.losing_trades || 0)}`,
            `FILL POLICY: ${String(assumptions.fill_model || 'bar_close').toUpperCase()}`,
            `SPREAD: ${Number(assumptions.spread_bps || 0).toFixed(2)} bps`,
            `SLIPPAGE: ${Number(assumptions.slippage_bps || 0).toFixed(2)} bps`,
            `ORDER LIFECYCLES: ${lifecycleCount}`,
            `AVG EXEC: ${executionQualityLabel(executionSummary.avg_quality_bps || 0)}`,
            `TOTAL COMM: ${Number(executionSummary.total_commission || 0).toFixed(2)}`,
            `EXPECTANCY: ${Number(analysis.expectancy || 0).toFixed(2)}`,
            `MODELED FRICTION: ${Number(fillStress.expected_friction_bps || 0).toFixed(2)} bps`,
            `IMPACTED ORDERS: ${Number(fillStress.impacted_orders || 0)} / ${Number(fillStress.completed_orders || 0)}`,
        ].join('\n');
        return;
    }

    if (mode === 'leaderboard') {
        body.textContent = 'Loading stored backtest runs from the platform archive...';
        meta.textContent = 'Reading saved runs...';
        primary.textContent = 'REFRESH';
        try {
            const runs = await fetchRuns(8);
            if (!runs.length) {
                body.textContent = 'No saved runs yet. Complete a backtest and it will be archived automatically.';
                meta.textContent = 'Archive is empty.';
                return;
            }

            body.textContent = 'Recent archived runs are now persisted with run IDs so they can be inspected and ranked.';
            meta.textContent = runs.map((run, index) => {
                const strategy = run.strategy_name || 'Unknown';
                const ticker = run.ticker || 'n/a';
                const ret = Number(run.total_return || 0).toFixed(2);
                const dd = Number(run.max_drawdown || 0).toFixed(2);
                const exec = executionQualityLabel(run.avg_execution_quality_bps || 0);
                const comm = Number(run.total_execution_commission || 0).toFixed(2);
                const expectancy = Number(run.expectancy || 0).toFixed(2);
                const stress = Number(run.expected_friction_bps || 0).toFixed(2);
                const impactRate = Number(run.impact_rate || 0).toFixed(2);
                const confidence = `${Number(run.high_confidence_trades || 0)}/${Number(run.medium_confidence_trades || 0)}/${Number(run.low_confidence_trades || 0)}/${Number(run.unmatched_trades || 0)}`;
                return `${index + 1}. ${strategy} | ${ticker} | ${ret}% | DD ${dd}% | EXP ${expectancy} | MATCH H/M/L/U ${confidence} | EXEC ${exec} | STRESS ${stress}bps ${impactRate}% | COMM ${comm} | ${run.run_id}`;
            }).join('\n');
        } catch (error) {
            meta.textContent = `Run archive unavailable.\n${error.message}`;
        }
    }
}

function closeSystemPanel() {
    document.getElementById('system-panel')?.classList.add('hidden');
}

function setConsolePrompt(title, subtitle) {
    setText('console-room-title', title);
    setText('console-room-sub', subtitle);
}

function armConsoleForSelection(label) {
    const friendly = String(label || 'Trading cartridge')
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .toUpperCase();
    setConsolePrompt('CARTRIDGE SELECTED', `Ready to load ${friendly}. Press play to mount.`);
    animateConsoleInsert({
        scale: 1,
        lift: 0,
        light: 1.15,
        slotGlow: 0.26,
        strip: 0.52,
        insert: 0.08,
    });
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

function initReplayControls() {
    const toggle = document.getElementById('replay-toggle');
    const step = document.getElementById('replay-step');
    const next = document.getElementById('replay-next');
    const speed = document.getElementById('replay-speed');
    if (toggle) {
        toggle.addEventListener('click', () => {
            replayState.paused = !replayState.paused;
            toggle.textContent = replayState.paused ? 'PLAY' : 'PAUSE';
            setReplayStatus(replayState.paused ? 'Replay paused.' : replayStatusForCurrentStep());
        });
    }

    if (step) {
        step.addEventListener('click', () => {
            replayState.paused = true;
            advanceReplayBy(1);
            if (toggle) {
                toggle.textContent = 'PLAY';
            }
        });
    }

    if (next) {
        next.addEventListener('click', () => {
            replayState.paused = true;
            jumpToNextTrade();
            if (toggle) {
                toggle.textContent = 'PLAY';
            }
        });
    }

    if (speed) {
        speed.addEventListener('click', () => {
            replayState.speed = replayState.speed === 0.5 ? 1 :
                replayState.speed === 1 ? 2 :
                    replayState.speed === 2 ? 4 :
                        0.5;
            speed.textContent = `${replayState.speed}X`;
        });
    }
}

function initTradeInspector() {
    document.getElementById('trade-inspector-prev')?.addEventListener('click', () => {
        selectTradeByIndex(replayState.selectedTradeIndex - 1, true);
    });
    document.getElementById('trade-inspector-next')?.addEventListener('click', () => {
        selectTradeByIndex(replayState.selectedTradeIndex + 1, true);
    });
}

function replayDelayForSpeed() {
    return Math.max(45, Math.round(180 / Math.max(replayState.speed || 1, 0.25)));
}

function startReplay(result, ticker, start, end) {
    replayState.result = result;
    replayState.selectedTradeIndex = -1;
    replayState.step = 0;
    replayState.eventsShown = 0;
    replayState.checkpointsShown = 0;
    replayState.paused = false;
    clearReplayTimer();

    document.getElementById('replay-toggle').textContent = 'PAUSE';
    document.getElementById('replay-speed').textContent = `${replayState.speed}X`;
    document.getElementById('replay-panel').classList.remove('hidden');
    document.getElementById('replay-log').innerHTML = '';

    setMenuCollapsed(true);
    setHeroIdle(false);
    setConsolePrompt('SIMULATION LIVE', `${result.strategy_name} is now running on ${ticker}.`);
    initializeMarketStage(result, ticker);
    initializeTradeInspector(result);
    initializeExecutionAnalysis(result);
    initializeRunAnalysis(result);
    updateTradeTelemetry(result, ticker, 0);
    appendChatMessage(`System: ${result.strategy_name} deployed on ${ticker}.`);
    setReplayStatus(replayStatusForCurrentStep());
    updateTerrain(chartWorld, result.equity_curve, {
        visibleCount: 1,
        trades: [],
    });

    const stepReplay = () => {
        if (!replayState.result) {
            return;
        }

        if (replayState.paused) {
            replayState.timer = window.setTimeout(stepReplay, 120);
            return;
        }

        advanceReplayBy(1, ticker);

        if (replayState.step >= getReplayTotalSteps()) {
            finishReplay(result, ticker, start, end);
            return;
        }

        replayState.timer = window.setTimeout(stepReplay, replayDelayForSpeed());
    };

    replayState.timer = window.setTimeout(stepReplay, replayDelayForSpeed());
}

function finishReplay(result, ticker, start, end) {
    clearReplayTimer();
    updateTerrain(chartWorld, result.equity_curve, {
        visibleCount: result.equity_curve?.length || 0,
        trades: result.trades || [],
    });
    updateHUD(result);
    setHudStage(`${result.strategy_name} replay cleared`);
    document.getElementById('hud').classList.remove('hidden');

    const badge = document.getElementById('strategy-badge');
    const badgeText = document.getElementById('strategy-badge-text');
    badgeText.textContent = `${result.strategy_name} | ${ticker} | ${start} -> ${end}`;
    badge.classList.remove('hidden');

    updateMarketStageFrame(result, (result.price_bars || []).length || replayState.step);
    updateTradeTelemetry(result, ticker, (result.price_bars || []).length || replayState.step);
    syncTradeInspectorToReplay();
    setReplayStatus(buildReplayOutcome(result));
    setConsolePrompt('RUN COMPLETE', buildReplayOutcome(result));
    appendChatMessage(`System: ${buildReplayOutcome(result)}`);
    triggerResultReveal();

    /* ── Innovation hooks: post-backtest ── */
    // Achievements
    checkAchievements(result);

    // Cartridge history + discovery map
    recordRun(currentStrategyName, result);
    renderDiscoveryMap();

    // Strategy Autopsy (GAME OVER screen)
    if (shouldShowAutopsy(result)) {
        const autopsyData = generateAutopsyData(result);
        if (autopsyData) {
            playSound('autopsy');
            setTimeout(() => showAutopsyOverlay(autopsyData), 1200);
        }
    }

    // Sonification
    if (sonifyEnabled && result.equity_curve?.length > 0) {
        sonifyEquityCurve(result.equity_curve, { speed: 40, volume: 0.01 });
    }

    // Set final weather regime
    const finalRegime = detectRegimeFromEquity(
        result.equity_curve,
        (result.equity_curve?.length || 1) - 1,
    );
    setWeatherRegime(finalRegime);
}

function resetReplay() {
    clearReplayTimer();
    replayState.step = 0;
    replayState.eventsShown = 0;
    replayState.checkpointsShown = 0;
    replayState.selectedTradeIndex = -1;
    replayState.result = null;
    replayState.paused = false;
    setConsolePrompt('SYSTEM READY', 'Select a cartridge to begin.');
    animateConsoleInsert({
        scale: 1,
        lift: 0,
        light: 0.8,
        slotGlow: 0.08,
        strip: 0.35,
        insert: 0,
    });
    const panel = document.getElementById('replay-panel');
    if (panel) {
        panel.classList.add('hidden');
    }
    document.getElementById('trade-inspector')?.classList.add('hidden');
    document.getElementById('execution-analysis')?.classList.add('hidden');
    document.getElementById('run-analysis')?.classList.add('hidden');
}

function getReplayTotalSteps() {
    const result = replayState.result;
    return (result?.price_bars?.length || result?.equity_curve?.length || 1);
}

function advanceReplayBy(amount, tickerHint = null) {
    if (!replayState.result) {
        return;
    }

    const curve = replayState.result.equity_curve || [];
    const trades = replayState.result.trades || [];
    const totalSteps = getReplayTotalSteps();
    replayState.step = Math.min(replayState.step + amount, totalSteps);

    const tradesVisible = Math.floor((replayState.step / Math.max(totalSteps, 1)) * trades.length);
    updateTerrain(chartWorld, curve, {
        visibleCount: replayState.step,
        trades: trades.slice(0, tradesVisible),
    });

    /* ── Weather regime shift during replay ── */
    if (replayState.step % 5 === 0 && curve.length > 10) {
        const regime = detectRegimeFromEquity(curve, replayState.step);
        setWeatherRegime(regime);
    }

    const ticker = tickerHint || document.getElementById('trade-pair')?.textContent || 'SPY';
    updateMarketStageFrame(replayState.result, replayState.step);
    updateTradeTelemetry(replayState.result, ticker, replayState.step);
    syncTradeInspectorToReplay();
    appendReplayEvents(replayState.result);
    maybeShowCheckpoint();
    setReplayStatus(replayStatusForCurrentStep());
}

function jumpToNextTrade() {
    if (!replayState.result?.replay_events) {
        return;
    }

    const currentBar = Math.max(replayState.step - 1, 0);
    const nextEvent = replayState.result.replay_events.find((event) =>
        (event.bar_index ?? 0) > currentBar && event.type !== 'scan' && event.type !== 'finish'
    );

    if (!nextEvent) {
        advanceReplayBy(1);
        return;
    }

    const nextStep = Math.max(1, (nextEvent.bar_index ?? 0) + 1);
    advanceReplayBy(Math.max(nextStep - replayState.step, 1));
}

function maybeShowCheckpoint() {
    const totalSteps = getReplayTotalSteps();
    if (!totalSteps || replayState.checkpointsShown >= 3) {
        return;
    }

    const thresholds = [0.25, 0.5, 0.75];
    const nextThreshold = thresholds[replayState.checkpointsShown];
    if (!nextThreshold) {
        return;
    }

    if ((replayState.step / totalSteps) >= nextThreshold) {
        replayState.checkpointsShown += 1;
        showCheckpointBanner(`Checkpoint ${replayState.checkpointsShown}`, Math.round(nextThreshold * 100));
    }
}

function showCheckpointBanner(label, progress) {
    const node = document.getElementById('stage-checkpoint');
    if (!node) {
        return;
    }

    node.textContent = `${label} | ${progress}%`;
    node.classList.remove('hidden');
    appendChatMessage(`System: ${label} reached at ${progress}% of the run.`);
    window.setTimeout(() => {
        node.classList.add('hidden');
    }, 1400);
}

function updateStageProgress(step, total) {
    const safeTotal = Math.max(total || 1, 1);
    const progress = Math.max(0, Math.min(100, Math.round((Math.max(step, 0) / safeTotal) * 100)));
    const chapter = progress < 25 ? 1 : progress < 50 ? 2 : progress < 75 ? 3 : 4;
    setText('stage-chapter-label', `CHAPTER ${chapter}`);
    setText('stage-progress-label', `${progress}%`);
    const bar = document.getElementById('stage-progress-bar');
    if (bar) {
        bar.style.width = `${progress}%`;
    }
    document.querySelectorAll('.stage-chapter-node').forEach((node) => {
        const nodeChapter = Number(node.getAttribute('data-chapter') || 0);
        node.classList.toggle('is-active', nodeChapter <= chapter);
    });
}

function clearReplayTimer() {
    if (replayState.timer) {
        window.clearTimeout(replayState.timer);
        replayState.timer = null;
    }
}

function initializeTradeInspector(result) {
    const panel = document.getElementById('trade-inspector');
    const list = document.getElementById('trade-inspector-list');
    if (!panel || !list) {
        return;
    }

    const trades = result?.trades || [];
    panel.classList.toggle('hidden', !trades.length);
    list.innerHTML = '';

    trades.forEach((trade, index) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'trade-inspector-chip';
        chip.textContent = buildTradeChipLabel(trade, index);
        chip.addEventListener('click', () => {
            selectTradeByIndex(index, true);
        });
        list.appendChild(chip);
    });

    if (trades.length) {
        selectTradeByIndex(0, false);
    }
}

function initializeExecutionAnalysis(result) {
    const panel = document.getElementById('execution-analysis');
    if (!panel) {
        return;
    }

    const diagnostics = result?.execution_diagnostics || {};
    const summary = result?.execution_summary || {};
    const orderCount = Number(summary.order_count || 0);
    panel.classList.toggle('hidden', orderCount <= 0);
    if (orderCount <= 0) {
        return;
    }

    setText(
        'execution-analysis-title',
        `${result?.strategy_name || 'Run'} | ${result?.ticker || 'MARKET'} | ${String((result?.execution_assumptions || {}).fill_model || 'bar_close').toUpperCase()}`
    );
    setText(
        'execution-analysis-summary',
        `Orders ${orderCount} | Completed ${Number(diagnostics.completed_order_count || 0)} | Buy ${Number(diagnostics.buy_order_count || 0)} | Sell ${Number(diagnostics.sell_order_count || 0)}`
    );

    const stats = document.getElementById('execution-analysis-stats');
    if (stats) {
        stats.innerHTML = [
            executionStatMarkup('Avg Exec', executionQualityLabel(summary.avg_quality_bps || 0)),
            executionStatMarkup('Best Fill', executionQualityLabel(summary.best_quality_bps || 0)),
            executionStatMarkup('Worst Fill', executionQualityLabel(summary.worst_quality_bps || 0)),
            executionStatMarkup('Commission', Number(summary.total_commission || 0).toFixed(2)),
        ].join('');
    }

    renderExecutionDiagnosticsRows('execution-analysis-best', diagnostics.best_orders || []);
    renderExecutionDiagnosticsRows('execution-analysis-worst', diagnostics.worst_orders || []);
}

function initializeRunAnalysis(result) {
    const panel = document.getElementById('run-analysis');
    if (!panel) {
        return;
    }

    const analysis = result?.run_analysis || {};
    const fillStress = result?.fill_stress || {};
    const tradeCount = Number(analysis.trade_count || 0);
    panel.classList.toggle('hidden', tradeCount <= 0);
    if (tradeCount <= 0) {
        return;
    }

    setText(
        'run-analysis-title',
        `${result?.strategy_name || 'Run'} | ${result?.ticker || 'MARKET'} | ${tradeCount} trades`
    );
    setText(
        'run-analysis-summary',
        `Expectancy ${Number(analysis.expectancy || 0).toFixed(2)} | Avg winner ${Number(analysis.avg_winner || 0).toFixed(2)} | Avg loser ${Number(analysis.avg_loser || 0).toFixed(2)} | Match H/M/L/U ${Number(analysis.high_confidence_trades || 0)}/${Number(analysis.medium_confidence_trades || 0)}/${Number(analysis.low_confidence_trades || 0)}/${Number(analysis.unmatched_trades || 0)}`
    );

    const stats = document.getElementById('run-analysis-stats');
    if (stats) {
        stats.innerHTML = [
            runAnalysisStatMarkup('Win / Loss', `${Number(analysis.winning_trades || 0)} / ${Number(analysis.losing_trades || 0)}`),
            runAnalysisStatMarkup('Long / Short', `${Number(analysis.long_trades || 0)} / ${Number(analysis.short_trades || 0)}`),
            runAnalysisStatMarkup('Net PnL', Number(analysis.net_pnl || 0).toFixed(2)),
            runAnalysisStatMarkup('Avg Bars', Number(analysis.avg_bars_held || 0).toFixed(2)),
            runAnalysisStatMarkup('Gross Profit', Number(analysis.gross_profit || 0).toFixed(2)),
            runAnalysisStatMarkup('Gross Loss', Number(analysis.gross_loss || 0).toFixed(2)),
        ].join('');
    }

    setText(
        'run-analysis-stress',
        `Execution stress | Model ${String(fillStress.fill_model || 'bar_close').toUpperCase()} | Expected friction ${Number(fillStress.expected_friction_bps || 0).toFixed(2)} bps | Impacted ${Number(fillStress.impacted_orders || 0)}/${Number(fillStress.completed_orders || 0)} orders (${Number(fillStress.impact_rate || 0).toFixed(2)}%)`
    );
}

function syncTradeInspectorToReplay() {
    const result = replayState.result;
    if (!result?.trades?.length) {
        return;
    }

    const currentBar = Math.max(replayState.step - 1, 0);
    const activeTrade = currentTradeWindow(result.replay_events || [], currentBar);
    if (activeTrade?.trade_index) {
        selectTradeByIndex(activeTrade.trade_index - 1, false);
        return;
    }

    const closedEvents = (result.replay_events || []).filter((event) =>
        (event.type === 'sell' || event.type === 'damage') && (event.bar_index ?? 0) <= currentBar
    );
    if (closedEvents.length) {
        const latest = closedEvents[closedEvents.length - 1];
        selectTradeByIndex((latest.trade_index || 1) - 1, false);
    }
}

function selectTradeByIndex(index, jumpToTrade) {
    const result = replayState.result;
    const trades = result?.trades || [];
    if (!trades.length) {
        return;
    }

    const safeIndex = Math.max(0, Math.min(index, trades.length - 1));
    replayState.selectedTradeIndex = safeIndex;
    renderTradeInspector(result, safeIndex);

    if (jumpToTrade) {
        focusTradeInReplay(result, safeIndex);
    }
}

function renderTradeInspector(result, index) {
    const trade = result?.trades?.[index];
    const panel = document.getElementById('trade-inspector');
    if (!trade || !panel) {
        return;
    }

    panel.classList.remove('hidden');

    const tradeNo = index + 1;
    const pnl = Number(trade.pnl ?? 0);
    const detail = tradeDetails(result, tradeNo);
    const entry = Number(detail.entry_price || trade.entry_price || 0);
    const exit = Number(detail.exit_price || trade.exit_price || 0);
    const requestedEntry = Number(detail.requested_entry_price || trade.requested_entry_price || 0);
    const requestedExit = Number(detail.requested_exit_price || trade.requested_exit_price || 0);
    const entryGapBps = Number(detail.entry_fill_gap_bps ?? trade.entry_fill_gap_bps ?? 0);
    const exitGapBps = Number(detail.exit_fill_gap_bps ?? trade.exit_fill_gap_bps ?? 0);
    const entryQualityBps = Number(detail.entry_quality_bps ?? trade.entry_quality_bps ?? 0);
    const exitQualityBps = Number(detail.exit_quality_bps ?? trade.exit_quality_bps ?? 0);
    const bars = Number(detail.span_bars ?? trade.bar_len ?? 0);
    const direction = String(detail.position_direction || trade.position_direction || '').toUpperCase();
    const executionDetail = tradeExecutionDetail(result, tradeNo, detail.entry_event, detail.exit_event);
    const outcome = pnl >= 0 ? 'Profit' : 'Risk';

    setText('trade-inspector-title', `Trade ${tradeNo} | ${direction || 'TRADE'} | ${outcome}`);
    setText(
        'trade-inspector-summary',
        `${outcome} | Opened ${formatIsoShort(trade.opened_at)} | Closed ${formatIsoShort(trade.closed_at)} | Req/Filled ${requestedEntry ? requestedEntry.toFixed(2) : 'n/a'} -> ${entry ? entry.toFixed(2) : 'n/a'}`
    );
    setText('trade-inspector-entry', entry ? entry.toFixed(2) : 'n/a');
    setText('trade-inspector-exit', exit ? exit.toFixed(2) : 'n/a');
    setText('trade-inspector-pnl', `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`);
    setText('trade-inspector-bars', String(bars || 0));
    setText(
        'trade-inspector-reason',
        `${detail.reason || 'Trade completed without a recorded explanation.'} Entry gap ${entryGapBps >= 0 ? '+' : ''}${entryGapBps.toFixed(2)} bps | Exit gap ${exitGapBps >= 0 ? '+' : ''}${exitGapBps.toFixed(2)} bps.`
    );
    setText(
        'trade-inspector-exec',
        `Execution | Entry requested ${requestedEntry ? requestedEntry.toFixed(2) : 'n/a'} -> filled ${entry ? entry.toFixed(2) : 'n/a'} (${executionQualityLabel(entryQualityBps)}) | Exit requested ${requestedExit ? requestedExit.toFixed(2) : 'n/a'} -> filled ${exit ? exit.toFixed(2) : 'n/a'} (${executionQualityLabel(exitQualityBps)})`
    );
    setText(
        'trade-inspector-order',
        `Orders | Entry ref ${executionDetail.entry_order?.ref ?? 'n/a'} ${String(executionDetail.entry_order?.order_type || 'n/a').toUpperCase()} [${formatStatusPath(executionDetail.entry_status_path)}] | Exit ref ${executionDetail.exit_order?.ref ?? 'n/a'} ${String(executionDetail.exit_order?.order_type || 'n/a').toUpperCase()} [${formatStatusPath(executionDetail.exit_status_path)}] | Comm ${Number(executionDetail.total_commission || 0).toFixed(2)} | Match ${String(trade.fill_match_confidence || 'unknown').toUpperCase()} | ${trade.fill_match_note || 'No match note.'}`
    );
    setText('trade-inspector-run', summarizeExecutionRun(result));
    renderTradeLifecycleRows(executionDetail.lifecycle_rows || []);

    document.querySelectorAll('.trade-inspector-chip').forEach((chip, chipIndex) => {
        chip.classList.toggle('is-active', chipIndex === index);
    });
    document.querySelectorAll('.replay-entry[data-trade-index]').forEach((node) => {
        node.classList.toggle('is-active', Number(node.dataset.tradeIndex) === tradeNo);
    });

    const prev = document.getElementById('trade-inspector-prev');
    const next = document.getElementById('trade-inspector-next');
    if (prev) {
        prev.disabled = index <= 0;
    }
    if (next) {
        next.disabled = index >= (result.trades.length - 1);
    }
}

function tradeDetails(result, tradeIndex) {
    const events = result?.replay_events || [];
    const entry = events.find((event) => event.trade_index === tradeIndex && (event.type === 'buy' || event.type === 'engage'));
    const exit = events.find((event) => event.trade_index === tradeIndex && (event.type === 'sell' || event.type === 'damage'));

    return {
        entry_event: entry || null,
        exit_event: exit || null,
        entry_price: entry?.entry_price || exit?.entry_price || 0,
        requested_entry_price: entry?.requested_entry_price || exit?.requested_entry_price || 0,
        entry_fill_gap_bps: entry?.entry_fill_gap_bps || exit?.entry_fill_gap_bps || 0,
        entry_quality_bps: entry?.entry_quality_bps || exit?.entry_quality_bps || 0,
        position_direction: entry?.position_direction || exit?.position_direction || '',
        exit_price: exit?.exit_price || entry?.exit_price || 0,
        requested_exit_price: exit?.requested_exit_price || entry?.requested_exit_price || 0,
        exit_fill_gap_bps: exit?.exit_fill_gap_bps || entry?.exit_fill_gap_bps || 0,
        exit_quality_bps: exit?.exit_quality_bps || entry?.exit_quality_bps || 0,
        execution_detail: tradeExecutionDetail(result, tradeIndex, entry, exit),
        span_bars: exit?.span_bars ?? entry?.span_bars ?? 0,
        reason: exit?.reason || entry?.reason || '',
        entry_bar: entry?.bar_index ?? 0,
    };
}

function tradeExecutionDetail(result, tradeIndex, entryEvent, exitEvent) {
    const trade = result?.trades?.[Math.max(0, tradeIndex - 1)] || {};
    const detail = trade.execution_detail || {};
    const lifecycle = result?.order_lifecycle || [];
    const entryRef = Number(detail.entry_order?.ref || trade.entry_order_ref || 0);
    const exitRef = Number(detail.exit_order?.ref || trade.exit_order_ref || 0);
    const entryOrder = detail.entry_order || lifecycle.find((item) => Number(item.ref || 0) === entryRef) || null;
    const exitOrder = detail.exit_order || lifecycle.find((item) => Number(item.ref || 0) === exitRef) || null;
    return {
        entry_order: entryOrder,
        exit_order: exitOrder,
        total_commission: Number(detail.total_commission || ((entryOrder?.commission || 0) + (exitOrder?.commission || 0))),
        entry_status_path: detail.entry_status_path || entryOrder?.status_path || [],
        exit_status_path: detail.exit_status_path || exitOrder?.status_path || [],
        lifecycle_rows: Array.isArray(detail.lifecycle_rows) && detail.lifecycle_rows.length
            ? detail.lifecycle_rows
            : [entryOrder, exitOrder].filter((row, index, items) => row && items.indexOf(row) === index),
        position_direction: entryEvent?.position_direction || exitEvent?.position_direction || trade.position_direction || '',
    };
}

function focusTradeInReplay(result, index) {
    const detail = tradeDetails(result, index + 1);
    const targetStep = Math.max(1, (detail.entry_bar || 0) + 1);
    replayState.paused = true;
    document.getElementById('replay-toggle').textContent = 'PLAY';
    if (targetStep === replayState.step) {
        updateMarketStageFrame(result, replayState.step);
        syncTradeInspectorToReplay();
        return;
    }
    if (targetStep < replayState.step) {
        replayState.step = 0;
        replayState.eventsShown = 0;
        replayState.checkpointsShown = 0;
        const log = document.getElementById('replay-log');
        if (log) {
            log.innerHTML = '';
        }
        advanceReplayBy(targetStep, document.getElementById('trade-pair')?.textContent || 'SPY');
        return;
    }
    advanceReplayBy(Math.max(targetStep - replayState.step, 1), document.getElementById('trade-pair')?.textContent || 'SPY');
}

function buildTradeChipLabel(trade, index) {
    const pnl = Number(trade?.pnl ?? 0);
    return `T${index + 1} ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`;
}

function formatIsoShort(value) {
    if (!value) {
        return 'n/a';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'n/a';
    }
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function executionQualityLabel(value) {
    const quality = Number(value || 0);
    const sign = quality >= 0 ? '+' : '';
    const tone = quality > 0.01 ? 'better' : quality < -0.01 ? 'worse' : 'neutral';
    return `${sign}${quality.toFixed(2)} bps ${tone}`;
}

function formatStatusPath(items) {
    const path = Array.isArray(items) ? items : [];
    return path.length ? path.join(' > ') : 'n/a';
}

function summarizeExecutionRun(result) {
    const lifecycle = Array.isArray(result?.order_lifecycle) ? result.order_lifecycle : [];
    if (!lifecycle.length) {
        return 'Run execution summary unavailable.';
    }
    const qualities = lifecycle
        .map((item) => Number(item.execution_quality_bps || 0))
        .filter((value) => Number.isFinite(value));
    const commissions = lifecycle
        .map((item) => Number(item.commission || 0))
        .filter((value) => Number.isFinite(value));
    const avg = qualities.length ? (qualities.reduce((sum, value) => sum + value, 0) / qualities.length) : 0;
    const worst = qualities.length ? Math.min(...qualities) : 0;
    const totalCommission = commissions.reduce((sum, value) => sum + value, 0);
    return `Run execution | Orders ${lifecycle.length} | Avg ${executionQualityLabel(avg)} | Worst ${executionQualityLabel(worst)} | Total comm ${totalCommission.toFixed(2)}`;
}

function renderTradeLifecycleRows(rows) {
    const container = document.getElementById('trade-inspector-lifecycle');
    if (!container) {
        return;
    }

    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
        container.innerHTML = '<div class="trade-inspector-lifecycle-row">No lifecycle rows for this trade.</div>';
        return;
    }

    container.innerHTML = items.map((row) => `
        <div class="trade-inspector-lifecycle-row">
            REF ${row.ref ?? 'n/a'} | ${String(row.side || '').toUpperCase()} | ${String(row.order_type || '').toUpperCase()} | ${String(row.final_status || '').toUpperCase()}
            <br />
            Req ${row.requested_price ? Number(row.requested_price).toFixed(2) : 'n/a'} -> Fill ${row.filled_price ? Number(row.filled_price).toFixed(2) : 'n/a'} | ${executionQualityLabel(row.execution_quality_bps || 0)} | Comm ${Number(row.commission || 0).toFixed(2)}
            <br />
            Path: ${formatStatusPath(row.status_path || [])}
        </div>
    `).join('');
}

function executionStatMarkup(label, value) {
    return `
        <div class="execution-analysis-stat">
            <span class="execution-analysis-stat-label">${label}</span>
            <span class="execution-analysis-stat-value">${value}</span>
        </div>
    `;
}

function renderExecutionDiagnosticsRows(id, rows) {
    const container = document.getElementById(id);
    if (!container) {
        return;
    }

    const items = Array.isArray(rows) ? rows : [];
    if (!items.length) {
        container.innerHTML = '<div class="execution-analysis-row">No execution rows recorded.</div>';
        return;
    }

    container.innerHTML = items.map((row) => `
        <div class="execution-analysis-row">
            REF ${row.ref ?? 'n/a'} | ${String(row.side || '').toUpperCase()} | ${String(row.order_type || '').toUpperCase()}
            <br />
            ${executionQualityLabel(row.execution_quality_bps || 0)} | Comm ${Number(row.commission || 0).toFixed(2)}
            <br />
            ${String(row.final_status || 'n/a').toUpperCase()}
        </div>
    `).join('');
}

function runAnalysisStatMarkup(label, value) {
    return `
        <div class="run-analysis-stat">
            <span class="run-analysis-stat-label">${label}</span>
            <span class="run-analysis-stat-value">${value}</span>
        </div>
    `;
}

function appendReplayEvents(result) {
    const log = document.getElementById('replay-log');
    if (!log) {
        return;
    }

    const events = result.replay_events || [];
    const targetEventCount = events.filter((event) => (event.bar_index ?? 0) <= Math.max(replayState.step - 1, 0)).length;

    while (replayState.eventsShown < targetEventCount) {
        const event = events[replayState.eventsShown];
        const node = document.createElement('div');
        node.className = 'replay-entry';
        if (event?.trade_index) {
            node.classList.add('is-linked');
            node.dataset.tradeIndex = String(event.trade_index);
            node.addEventListener('click', () => {
                selectTradeByIndex((event.trade_index || 1) - 1, true);
            });
        }
        node.textContent = replayEventText(event);
        log.prepend(node);
        if (event?.type && event.type !== 'scan') {
            if (event.type === 'buy' || event.type === 'sell' || event.type === 'damage') {
                playSound(event.type);
            }
            appendChatMessage(`System: ${replayEventText(event)}`);
        }
        replayState.eventsShown += 1;
    }
}

function replayEventText(event) {
    if (!event) {
        return 'Standby.';
    }

    if (event.type === 'scan') {
        return 'Arena online: scanning market regime.';
    }
    if (event.type === 'finish') {
        return 'Final stretch: protecting gains and closing the run.';
    }
    const pnl = Number(event.pnl ?? 0);
    const action = event.type === 'buy' ? 'BUY signal fired' :
        event.type === 'sell' ? 'TP HIT' :
            event.type === 'damage' ? 'SL HIT' :
                event.type === 'engage' ? 'Pressure building' :
                    'Position engaged';
    return `${action}: ${event.label}${Number.isFinite(pnl) ? ` (${pnl.toFixed(2)})` : ''}.`;
}

function replayStatusForCurrentStep() {
    const result = replayState.result;
    const total = (result?.price_bars?.length || result?.equity_curve?.length || 0);
    if (!total) {
        return 'Preparing replay...';
    }

    const progress = Math.min(100, Math.round((replayState.step / total) * 100));
    const theme = themeLabelForResult(result);
    return `${theme} replay ${progress}%`;
}

function buildReplayOutcome(result) {
    const totalReturn = Number(result.total_return ?? 0);
    if (totalReturn > 10) {
        return 'Victory: dominant clear.';
    }
    if (totalReturn > 0) {
        return 'Survived the run with profit.';
    }
    if (totalReturn === 0) {
        return 'Draw: flat finish.';
    }
    return 'Defeat: the market won this round.';
}

function themeLabelForResult(result) {
    const name = String(result.strategy_name || '').toLowerCase();
    if (name.includes('crypto')) return 'Arcade';
    if (name.includes('forex')) return 'Counter-fight';
    if (name.includes('metals')) return 'Boss battle';
    if (name.includes('stock') || name.includes('bull')) return 'Campaign';
    return 'Flagship';
}

function setReplayStatus(message) {
    const node = document.getElementById('replay-status');
    if (!node) {
        return;
    }
    node.textContent = message;
}

function initializeMarketStage(result, ticker) {
    const symbol = document.getElementById('stage-symbol');
    const theme = document.getElementById('stage-theme');
    const status = document.getElementById('stage-status');
    const profile = document.getElementById('brand-hero-subtitle');
    if (symbol) symbol.textContent = ticker;
    if (theme) theme.textContent = themeLabelForResult(result);
    if (status) status.textContent = 'Deploying runner';
    if (profile) profile.textContent = `Rank: Apex | Status: Running | ${result.strategy_name}`;
    setText('trade-pair', ticker);
    setText('stage-runner-name', runnerNameForResult(result));
    setText('stage-runner-level', runnerLevelForResult(result));
    updateStageProgress(0, 1);
    applyUiSignalState(null);
    renderReplayLane(replayLane, result.price_bars || [], 1, { signalType: null, latestEvent: null });
    renderCandleStage(result.price_bars || [], 1);
    updateStageIndicators(result.price_bars || [], 1);
    updateStageExplainer(result, 0, null);
    setStageSignal('No signal', null);
}

function updateMarketStageFrame(result, visibleCount) {
    const bars = result.price_bars || [];
    if (!bars.length) {
        return;
    }

    const barIndex = Math.max(0, Math.min(visibleCount - 1, bars.length - 1));
    const bar = bars[barIndex];
    const activeEvents = (result.replay_events || []).filter((event) => event.bar_index === barIndex);
    const latestEvent = activeEvents[activeEvents.length - 1] || null;
    renderReplayLane(replayLane, bars, visibleCount, {
        signalType: visualStateForEvent(latestEvent),
        latestEvent,
        events: result.replay_events || [],
        currentStep: visibleCount,
    });
    renderCandleStage(bars, visibleCount);

    const status = document.getElementById('stage-status');
    const price = document.getElementById('stage-price');
    if (status) {
        status.textContent = latestEvent ? latestEvent.label : 'Runner advancing';
    }
    if (price) {
        price.textContent = `Close ${Number(bar.close).toFixed(2)} | Volume ${Math.round(Number(bar.volume || 0))}`;
    }
    updateStageProgress(visibleCount, bars.length);
    updateStageIndicators(bars, visibleCount);
    updateStageExplainer(result, barIndex, latestEvent);
    setStageSignal(
        latestEvent ? latestEvent.label : 'Tracking trend',
        latestEvent?.type || null,
    );
}

function updateStageExplainer(result, barIndex, latestEvent) {
    const strategyNote = document.getElementById('stage-strategy-note');
    const tradeNote = document.getElementById('stage-trade-note');
    if (!strategyNote || !tradeNote) {
        return;
    }

    const bars = result?.price_bars || [];
    const events = result?.replay_events || [];
    const activeTrade = currentTradeWindow(events, barIndex);
    const currentBar = bars[Math.max(0, Math.min(barIndex, bars.length - 1))];

    if (latestEvent?.reason) {
        strategyNote.textContent = latestEvent.reason;
    } else {
        strategyNote.textContent = 'The strategy is scanning trend, momentum, and risk before committing capital.';
    }

    if (activeTrade && currentBar) {
        const entry = Number(activeTrade.entry_price || currentBar.close || 0);
        const live = Number(currentBar.close || 0);
        const movePct = entry ? (((live - entry) / entry) * 100) : 0;
        tradeNote.textContent = `Trade ${activeTrade.trade_index} active | Entry ${entry.toFixed(2)} | Live ${live.toFixed(2)} | Move ${movePct >= 0 ? '+' : ''}${movePct.toFixed(2)}%`;
        return;
    }

    if (latestEvent?.type === 'sell' || latestEvent?.type === 'damage') {
        const exit = Number(latestEvent.exit_price || 0);
        tradeNote.textContent = `Trade ${latestEvent.trade_index || '-'} closed | Exit ${exit ? exit.toFixed(2) : 'n/a'} | PnL ${Number(latestEvent.pnl || 0).toFixed(2)}`;
        return;
    }

    tradeNote.textContent = 'No active trade. The strategy is waiting for confirmation.';
}

function currentTradeWindow(events, barIndex) {
    const opens = events
        .filter((event) => (event.type === 'buy' || event.type === 'engage') && (event.bar_index ?? 0) <= barIndex)
        .sort((a, b) => (b.bar_index ?? 0) - (a.bar_index ?? 0));

    for (const openEvent of opens) {
        const closeEvent = events.find((event) =>
            event.trade_index === openEvent.trade_index &&
            (event.type === 'sell' || event.type === 'damage')
        );
        const closeBar = closeEvent?.bar_index ?? Number.POSITIVE_INFINITY;
        if (barIndex < closeBar) {
            return openEvent;
        }
    }
    return null;
}

function renderCandleStage(priceBars, visibleCount) {
    const stage = document.getElementById('candle-stage');
    const runner = document.getElementById('runner-avatar');
    const burst = document.getElementById('runner-burst');
    if (!stage || !runner || !burst) {
        return;
    }

    if (!priceBars.length) {
        stage.innerHTML = '';
        return;
    }

    const total = priceBars.length;
    const count = Math.max(1, Math.min(visibleCount, total));
    const visibleBars = priceBars.slice(0, count);
    const highs = priceBars.map((bar) => Number(bar.high));
    const lows = priceBars.map((bar) => Number(bar.low));
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const span = Math.max(maxHigh - minLow, 0.0001);

    stage.innerHTML = visibleBars.map((bar) => {
        const open = Number(bar.open);
        const close = Number(bar.close);
        const high = Number(bar.high);
        const low = Number(bar.low);
        const bullish = close >= open;
        const bodyHeight = Math.max(10, Math.abs(close - open) / span * 180);
        const wickTop = ((maxHigh - high) / span) * 180;
        const wickHeight = Math.max(12, ((high - low) / span) * 180);
        const bodyTop = ((maxHigh - Math.max(open, close)) / span) * 180;
        return `
            <div class="stage-candle ${bullish ? 'bull' : 'bear'}">
                <span class="stage-wick" style="top:${wickTop}px;height:${wickHeight}px;"></span>
                <span class="stage-body" style="top:${bodyTop}px;height:${bodyHeight}px;"></span>
            </div>
        `;
    }).join('');

    const progress = total > 1 ? (count - 1) / (total - 1) : 0;
    const stageWidth = stage.clientWidth || 720;
    const x = progress * Math.max(stageWidth - 78, 1);
    const currentBar = visibleBars[visibleBars.length - 1];
    const closeOffset = ((Number(currentBar.close) - minLow) / span) * 180;
    const hop = Math.sin(progress * Math.PI * 14) * 8;
    runner.style.bottom = `${Math.max(56, 28 + closeOffset)}px`;
    runner.style.transform = `translate(${x}px, ${-hop}px)`;

    const signalType = currentStageEventType();
    runner.classList.toggle('runner-buy', signalType === 'buy');
    runner.classList.toggle('runner-sell', signalType === 'sell' || signalType === 'damage');
    runner.classList.toggle('runner-hit', signalType === 'damage');
    burst.classList.toggle('active', signalType === 'buy' || signalType === 'sell' || signalType === 'damage');
    burst.style.left = `${x + 22}px`;
}

function setStageSignal(message, type) {
    const node = document.getElementById('stage-signal');
    const state = visualStateForEvent(type ? { type } : null);
    if (!node) {
        return;
    }
    node.textContent = state === 'tp' ? 'TP HIT' :
        state === 'sl' ? 'SL HIT' :
            message;
    node.dataset.signal = state || 'neutral';
    applyUiSignalState(state);
}

function currentStageEventType() {
    const result = replayState.result;
    if (!result?.replay_events) {
        return null;
    }
    const barIndex = Math.max(replayState.step - 1, 0);
    const events = result.replay_events.filter((event) => event.bar_index === barIndex);
    return events.length ? events[events.length - 1].type : null;
}

function visualStateForEvent(event) {
    const type = typeof event === 'string' ? event : event?.type;
    if (!type) {
        return null;
    }
    if (type === 'buy') {
        return 'buy';
    }
    if (type === 'sell') {
        return 'tp';
    }
    if (type === 'damage') {
        return 'sl';
    }
    if (type === 'engage') {
        return 'sell';
    }
    return null;
}

function applyUiSignalState(state) {
    const targets = [
        document.getElementById('market-stage'),
        document.getElementById('replay-panel'),
        document.getElementById('telemetry-bar'),
    ];
    targets.forEach((node) => {
        if (node) {
            node.dataset.signalState = state || 'neutral';
        }
    });
}

function updateStageIndicators(bars, visibleCount) {
    if (!bars.length) {
        return;
    }

    const count = Math.max(1, Math.min(visibleCount, bars.length));
    const closes = bars.slice(0, count).map((bar) => Number(bar.close || 0));
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);

    setText('stage-ema-fast', `EMA 20 ${ema20.toFixed(2)}`);
    setText('stage-ema-mid', `EMA 50 ${ema50.toFixed(2)}`);
    setText('stage-ema-slow', `EMA 200 ${ema200.toFixed(2)}`);
    setText('stage-timeframe', bars.length > 90 ? '15M' : '1H');
}

function calculateEMA(values, period) {
    if (!values.length) {
        return 0;
    }

    const alpha = 2 / (Math.min(period, values.length) + 1);
    let ema = values[0];
    for (let index = 1; index < values.length; index += 1) {
        ema = values[index] * alpha + ema * (1 - alpha);
    }
    return ema;
}

function runnerNameForResult(result) {
    const name = String(result?.strategy_name || 'Runner').replace(/[^a-z0-9]+/gi, '_').toUpperCase();
    return name.slice(0, 18) || 'SHINOBI_ZERO';
}

function runnerLevelForResult(result) {
    const trades = Number(result?.total_trades || 0);
    return `LV ${String(Math.max(12, 40 + trades)).padStart(2, '0')}`;
}

function updateTradeTelemetry(result, ticker, visibleCount) {
    const bars = result?.price_bars || [];
    if (!bars.length) {
        return;
    }

    const index = Math.max(0, Math.min(visibleCount - 1, bars.length - 1));
    const bar = bars[index];
    const firstClose = Number(bars[0]?.close || bar.close || 0);
    const lastClose = Number(bar.close || 0);
    const change = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;
    const activeEvents = (result.replay_events || []).filter((event) => event.bar_index === index);
    const latestEvent = activeEvents[activeEvents.length - 1] || null;
    const buyEvents = (result.replay_events || []).filter((event) => event.type === 'buy' && event.bar_index <= index).length;
    const sellEvents = (result.replay_events || []).filter((event) => (event.type === 'sell' || event.type === 'damage') && event.bar_index <= index).length;
    const progress = bars.length > 1 ? index / (bars.length - 1) : 1;
    const runningValue = Number(result.starting_cash || 0) + ((Number(result.final_value || 0) - Number(result.starting_cash || 0)) * progress);
    const liveProfit = runningValue - Number(result.starting_cash || 0);

    setText('trade-pair', ticker);
    setText('trade-price', lastClose.toFixed(2));
    setText('trade-change', `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
    setText('trade-buys', String(buyEvents));
    setText('trade-sells', String(sellEvents));
    setText('trade-profit', `${liveProfit >= 0 ? '+' : ''}${liveProfit.toFixed(2)}`);
    setText('trade-bid-1', (lastClose - 0.18).toFixed(2));
    setText('trade-bid-2', (lastClose - 0.32).toFixed(2));
    setText('trade-bid-3', (lastClose - 0.47).toFixed(2));
    setText('trade-ask-1', (lastClose + 0.18).toFixed(2));
    setText('trade-ask-2', (lastClose + 0.33).toFixed(2));
    setText('trade-ask-3', (lastClose + 0.48).toFixed(2));
    setText('feed-primary', `${ticker} ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
    setText('feed-secondary', latestEvent ? latestEvent.label : 'Signal: Tracking trend');
    setText('account-balance', `$${runningValue.toFixed(2)}`);
    setText('trade-clock', formatReplayClock(bar.ts));

    const action = document.getElementById('trade-action');
    if (action) {
        const state = visualStateForEvent(latestEvent) ||
            document.getElementById('market-stage')?.dataset.signalState ||
            null;
        action.textContent = state === 'buy' ? '[BUY]' :
            state === 'tp' ? '[TP HIT]' :
                state === 'sl' ? '[SL HIT]' :
                    state === 'sell' ? '[SELL]' :
                        '[TRACK]';
    }
}

function appendChatMessage(message) {
    const feed = document.getElementById('chat-feed');
    if (!feed || !message) {
        return;
    }

    const line = document.createElement('div');
    line.className = 'chat-line';
    line.textContent = message;
    feed.prepend(line);

    while (feed.children.length > 4) {
        feed.removeChild(feed.lastChild);
    }
}

function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
        node.textContent = value;
    }
}

function formatReplayClock(timestampMs) {
    if (!timestampMs) {
        return '00:00:00 UTC';
    }

    const date = new Date(timestampMs);
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')} UTC`;
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
    consoleState.ledTarget = targetIntensity;
    consoleState.slotGlowTarget = Math.max(consoleState.slotGlowTarget, targetIntensity * 0.18);
    consoleState.stripTarget = Math.max(consoleState.stripTarget, targetIntensity * 0.28);
    window.setTimeout(() => {
        consoleState.ledTarget = Math.max(consoleState.ledTarget, 0.7);
    }, 180);
}

function updateConsoleScene(elapsed) {
    if (!consoleGroup) {
        return;
    }

    consoleState.insertDisplay += (consoleState.insertTarget - consoleState.insertDisplay) * 0.14;
    consoleGroup.scale.y += (consoleState.shellScaleTarget - consoleGroup.scale.y) * 0.12;
    consoleGroup.position.y += (consoleState.shellLiftTarget - consoleGroup.position.y) * 0.12;

    const led = consoleGroup?.userData?.powerLED;
    if (led?.material) {
        const idlePulse = 0.58 + Math.sin(elapsed * 1.5) * 0.18;
        led.material.emissiveIntensity += ((Math.max(idlePulse, consoleState.ledTarget)) - led.material.emissiveIntensity) * 0.14;
    }

    const slotGlow = consoleGroup?.userData?.slotGlow;
    if (slotGlow?.material) {
        const target = consoleState.slotGlowTarget + Math.sin(elapsed * 2.2) * 0.03;
        slotGlow.material.emissiveIntensity += (target - slotGlow.material.emissiveIntensity) * 0.14;
        slotGlow.material.opacity = Math.min(1, 0.35 + slotGlow.material.emissiveIntensity * 0.45);
    }

    const frontStrip = consoleGroup?.userData?.frontStrip;
    if (frontStrip?.material) {
        const target = consoleState.stripTarget + Math.sin(elapsed * 1.9) * 0.03;
        frontStrip.material.emissiveIntensity += (target - frontStrip.material.emissiveIntensity) * 0.12;
    }

    const cartridge = consoleGroup?.userData?.cartridge;
    if (cartridge) {
        // Subtle floating effect combined with the current Y position (set by GSAP)
        // We avoid hard overwriting position.y so GSAP tweens remain intact
        const labelMesh = cartridge.children[1];
        if (labelMesh?.material) {
            // Emissive pulse on the label
            labelMesh.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 3) * 0.1;
        }
    }
}

function showLoading(show, message = '') {
    const screen = document.getElementById('loading-screen');
    if (show) {
        screen.classList.add('hidden');
        const sub = document.getElementById('launch-transition-sub');
        if (sub && message) {
            sub.textContent = message;
        }
        setLaunchTransitionState('Building replay stream...', 100);
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
let prevTime = 0;

function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    const delta = elapsed - prevTime;
    prevTime = elapsed;

    controls.update();
    updateConsoleScene(elapsed);
    updateWeather(elapsed, delta);

    renderer.render(scene, camera);
}

animate();
console.log('%c🎮 CartridgeLab Console Ready', 'color:#00ffee;font-size:16px;font-family:monospace;');

/* ────────────────────────────────────────────────────────────────────
   Sonification Toggle Button
   ──────────────────────────────────────────────────────────────────── */
function initSonifyToggle() {
    const btn = document.createElement('button');
    btn.id = 'sonify-toggle';
    btn.className = 'sonify-toggle';
    btn.type = 'button';
    btn.innerHTML = '<span class="sonify-toggle-icon">🔇</span> SONIFY';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
        sonifyEnabled = !sonifyEnabled;
        btn.classList.toggle('is-active', sonifyEnabled);
        btn.querySelector('.sonify-toggle-icon').textContent = sonifyEnabled ? '🔊' : '🔇';

        if (!sonifyEnabled && isSonifying()) {
            stopSonification();
        }

        // If replay is already finished and we toggle ON, sonify the current result
        if (sonifyEnabled && replayState.result?.equity_curve?.length > 0 && !isSonifying()) {
            sonifyEquityCurve(replayState.result.equity_curve, { speed: 40, volume: 0.01 });
        }
    });
}
