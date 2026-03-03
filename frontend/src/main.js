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
import { initReplayLane, renderReplayLane } from './replaylane_pixi.js';
import { runBacktest } from './api.js';
import { playSound } from './sounds.js';
import brandImage from '../../slimlogobrain.png';
import gameSplashImage from '../../TradingGame.png';

let splashDismissed = false;
let splashBooting = false;
const replayState = {
    timer: null,
    paused: false,
    speed: 2,
    step: 0,
    result: null,
    eventsShown: 0,
    checkpointsShown: 0,
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
const replayLane = initReplayLane(document.getElementById('replay-lane'));
applyThemeBranding();
setHeroIdle(true);
setText('brand-hero-subtitle', 'Rank: Apex | Status: Ready | Awaiting deployment.');
initHUD();
initMenu(onCartridgeSelected);
initCartridgeSystem(onFileDropped);
initMenuDock();
initSplashScreen();
initReplayControls();

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
    await playInsertTransition(presetFilename || file?.name || 'Custom cartridge');
    showLoading(true, 'Initializing Cerebro...');
    setHudStage('Running simulation');
    resetReplay();
    playSound('running');

    try {
        const result = await runBacktest(file, presetFilename, ticker, start, end, cash);
        showLoading(false);
        playSound('reveal');

        startReplay(result, ticker, start, end);

    } catch (err) {
        showLoading(false);
        setHudStage('Run failed');
        setReplayStatus('Run failed before replay.');
        console.error('[CartridgeLab]', err);
        alert('Backtest failed: ' + err.message);
    }
}

async function playInsertTransition(label) {
    const overlay = document.getElementById('launch-transition');
    const title = document.getElementById('launch-transition-title');
    const sub = document.getElementById('launch-transition-sub');
    const phases = [
        { sub: 'Inserting cartridge...', detail: 'Reading cartridge contacts...', progress: 22, scale: 0.92, light: 1.55, waitMs: 260 },
        { sub: 'Locking into console bus...', detail: 'Syncing memory rails...', progress: 58, scale: 1.04, light: 1.95, waitMs: 260 },
        { sub: 'Cartridge verified.', detail: 'Routing control to game core...', progress: 100, scale: 1.01, light: 2.2, waitMs: 220 },
    ];
    if (!overlay) {
        return;
    }

    overlay.classList.add('insert-mode');
    overlay.classList.remove('hidden');
    overlay.classList.add('is-visible');
    if (title) {
        title.textContent = String(label || 'Trading cartridge').replace(/[_-]+/g, ' ').toUpperCase();
    }
    playSound('insert');
    for (const phase of phases) {
        if (sub) {
            sub.textContent = phase.sub;
        }
        setLaunchTransitionState(phase.detail, phase.progress);
        animateConsoleInsert(phase.scale, phase.light);
        await wait(phase.waitMs);
    }
    overlay.classList.remove('is-visible');
    await wait(180);
    overlay.classList.add('hidden');
    overlay.classList.remove('insert-mode');
    setLaunchTransitionState('Awaiting cartridge lock...', 0);
    animateConsoleInsert(1, 0.8);
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

function animateConsoleInsert(scaleY, ledIntensity) {
    if (!consoleGroup) {
        return;
    }

    consoleGroup.scale.y = scaleY;
    consoleGroup.position.y = scaleY < 1 ? -0.06 : scaleY > 1 ? 0.04 : 0;
    const led = consoleGroup?.userData?.powerLED;
    if (led?.material) {
        led.material.emissiveIntensity = ledIntensity;
    }
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
            replayState.speed = replayState.speed === 1 ? 2 : replayState.speed === 2 ? 4 : 1;
            speed.textContent = `${replayState.speed}X`;
        });
    }
}

function startReplay(result, ticker, start, end) {
    replayState.result = result;
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
    initializeMarketStage(result, ticker);
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

        advanceReplayBy(replayState.speed, ticker);

        if (replayState.step >= getReplayTotalSteps()) {
            finishReplay(result, ticker, start, end);
            return;
        }

        replayState.timer = window.setTimeout(stepReplay, 90);
    };

    replayState.timer = window.setTimeout(stepReplay, 120);
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
    setReplayStatus(buildReplayOutcome(result));
    appendChatMessage(`System: ${buildReplayOutcome(result)}`);
    triggerResultReveal();
}

function resetReplay() {
    clearReplayTimer();
    replayState.step = 0;
    replayState.eventsShown = 0;
    replayState.checkpointsShown = 0;
    replayState.result = null;
    replayState.paused = false;
    const panel = document.getElementById('replay-panel');
    if (panel) {
        panel.classList.add('hidden');
    }
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

    const ticker = tickerHint || document.getElementById('trade-pair')?.textContent || 'SPY';
    updateMarketStageFrame(replayState.result, replayState.step);
    updateTradeTelemetry(replayState.result, ticker, replayState.step);
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
    setStageSignal(
        latestEvent ? latestEvent.label : 'Tracking trend',
        latestEvent?.type || null,
    );
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
