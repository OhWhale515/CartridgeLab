import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { animationForSignal, runnerTintForSignal, RUNNER_SPRITE_SPEC } from './runnerSprite.js';

export function initReplayLane(canvas) {
    if (!canvas) {
        return null;
    }

    const host = canvas.parentElement;
    const lane = {
        canvas,
        host,
        app: null,
        ready: false,
        pending: null,
        layers: null,
        lastBurstKey: '',
    };

    const app = new Application();
    lane.app = app;
    lane.readyPromise = app.init({
        canvas,
        resizeTo: host || undefined,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
    }).then(() => {
        lane.layers = buildScene(app.stage);
        lane.ready = true;
        if (lane.pending) {
            const pending = lane.pending;
            lane.pending = null;
            renderReplayLane(lane, pending.priceBars, pending.visibleCount, pending.options);
        }
    }).catch((error) => {
        console.error('[ReplayLane]', error);
    });

    return lane;
}

export function renderReplayLane(lane, priceBars = [], visibleCount = 0, options = {}) {
    if (!lane?.app) {
        return;
    }

    if (!lane.ready || !lane.layers) {
        lane.pending = { priceBars, visibleCount, options };
        return;
    }

    const { renderer } = lane.app;
    const width = lane.host?.clientWidth || renderer.width || 960;
    const height = lane.host?.clientHeight || renderer.height || 420;
    if (renderer.width !== width || renderer.height !== height) {
        renderer.resize(width, height);
    }

    const signalType = options.signalType || null;
    const latestEvent = options.latestEvent || null;
    drawBackground(lane.layers.background, lane.layers.farGlow, lane.layers.nearGlow, width, height, visibleCount, priceBars.length, signalType);

    if (!priceBars.length) {
        clearChartLayers(lane);
        return;
    }

    const count = Math.max(1, Math.min(visibleCount || 1, priceBars.length));
    const bars = priceBars.slice(0, count);
    const min = Math.min(...bars.map((bar) => Number(bar.low || bar.close || 0)));
    const max = Math.max(...bars.map((bar) => Number(bar.high || bar.close || 0)));
    const span = Math.max(max - min, 0.0001);

    const leftPad = 112;
    const rightPad = 24;
    const topPad = 40;
    const bottomPad = 40;
    const chartHeight = height - topPad - bottomPad;
    const chartWidth = width - leftPad - rightPad;
    const step = chartWidth / Math.max(bars.length - 1, 1);
    const candleWidth = Math.max(6, Math.min(16, step * 0.45));
    const runnerX = leftPad + (bars.length - 1) * step;
    const runnerY = projectY(Number(bars[bars.length - 1].close || 0), min, span, topPad, chartHeight) - 8;

    drawVolume(lane.layers.volume, bars, leftPad, width - rightPad, height - bottomPad + 4, 64);
    drawIndicatorRibbon(lane.layers.ribbons[0], bars, leftPad, topPad, chartWidth, chartHeight, 12, 0x9df5ff, 0.82);
    drawIndicatorRibbon(lane.layers.ribbons[1], bars, leftPad, topPad, chartWidth, chartHeight, 26, 0xffcf67, 0.72);
    drawIndicatorRibbon(lane.layers.ribbons[2], bars, leftPad, topPad, chartWidth, chartHeight, 42, 0x7cfccb, 0.64);
    drawCandles(lane.layers.candles, bars, leftPad, topPad, chartHeight, min, span, step, candleWidth);
    drawPriceScale(lane.layers.priceTag, lane.layers.priceText, bars[bars.length - 1], width - rightPad + 2, topPad, chartHeight);
    drawRunner(lane.layers.runner, runnerX, runnerY, signalType, visibleCount);
    updateParticles(lane, runnerX, runnerY, signalType, latestEvent);
}

function buildScene(stage) {
    const root = new Container();
    stage.addChild(root);

    const background = new Graphics();
    const farGlow = new Graphics();
    const nearGlow = new Graphics();
    const volume = new Graphics();
    const ribbonA = new Graphics();
    const ribbonB = new Graphics();
    const ribbonC = new Graphics();
    const candles = new Graphics();
    const particles = new Container();
    const runner = buildRunner();
    const priceTag = new Graphics();
    const priceText = new Text('', new TextStyle({
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 12,
        fill: 0x04111f,
        fontWeight: '700',
    }));

    root.addChild(background, farGlow, nearGlow, volume, ribbonA, ribbonB, ribbonC, candles, particles, runner, priceTag, priceText);

    return {
        root,
        background,
        farGlow,
        nearGlow,
        volume,
        ribbons: [ribbonA, ribbonB, ribbonC],
        candles,
        particles,
        runner,
        priceTag,
        priceText,
    };
}

function clearChartLayers(lane) {
    const { layers } = lane;
    layers.volume.clear();
    layers.farGlow.clear();
    layers.nearGlow.clear();
    layers.ribbons.forEach((ribbon) => ribbon.clear());
    layers.candles.clear();
    layers.priceTag.clear();
    layers.priceText.text = '';
    layers.runner.visible = false;
    clearParticles(layers.particles);
    lane.lastBurstKey = '';
}

function drawBackground(graphics, farGlow, nearGlow, width, height, visibleCount, totalCount, signalType) {
    graphics.clear();
    farGlow.clear();
    nearGlow.clear();

    const progress = totalCount > 1 ? Math.max(0, Math.min(1, (visibleCount - 1) / (totalCount - 1))) : 0;
    const drift = progress * 42;

    graphics.beginFill(0x0a1834, 0.08);
    graphics.drawRect(0, 0, width, height);
    graphics.endFill();

    const farColor = signalType === 'buy' ? 0xb8ff4a :
        signalType === 'tp' ? 0xfff07a :
            signalType === 'sell' ? 0xff8d4a :
                signalType === 'sl' ? 0xff5f49 :
                    0x2af6ff;
    const nearColor = signalType === 'buy' ? 0xefff7a :
        signalType === 'tp' ? 0x68ffbe :
            signalType === 'sell' ? 0xff7b43 :
                signalType === 'sl' ? 0xff4f6d :
                    0xff58ae;

    farGlow.beginFill(farColor, signalType ? 0.08 : 0.05);
    farGlow.drawEllipse(width * 0.36 - drift * 0.35, height * 0.22, width * 0.24, height * 0.12);
    farGlow.endFill();

    nearGlow.beginFill(nearColor, signalType ? 0.07 : 0.04);
    nearGlow.drawEllipse(width * 0.72 - drift * 0.6, height * 0.28, width * 0.18, height * 0.1);
    nearGlow.endFill();

    const skyline = [
        [0.12, 0.46, 0.08],
        [0.22, 0.34, 0.06],
        [0.32, 0.52, 0.09],
        [0.48, 0.42, 0.08],
        [0.62, 0.58, 0.11],
        [0.78, 0.38, 0.07],
        [0.88, 0.48, 0.08],
    ];

    skyline.forEach(([xRatio, hRatio, wRatio], index) => {
        const x = width * xRatio - drift * (0.2 + index * 0.06);
        const buildingWidth = width * wRatio;
        const buildingHeight = height * hRatio;
        const y = height * 0.58 - buildingHeight;
        graphics.beginFill(index % 2 === 0 ? farColor : nearColor, 0.07);
        graphics.drawRoundedRect(x, y, buildingWidth, buildingHeight, 8);
        graphics.endFill();
    });
}

function drawVolume(graphics, bars, startX, endX, baseY, maxHeight) {
    graphics.clear();
    const width = endX - startX;
    const step = width / Math.max(bars.length, 1);
    const maxVolume = Math.max(...bars.map((bar) => Number(bar.volume || 0)), 1);

    bars.forEach((bar, index) => {
        const volume = Number(bar.volume || 0);
        const height = Math.max(6, (volume / maxVolume) * maxHeight);
        const x = startX + index * step;
        const bullish = Number(bar.close || 0) >= Number(bar.open || 0);
        graphics.beginFill(bullish ? 0x68ffbe : 0xff829a, bullish ? 0.24 : 0.2);
        graphics.drawRect(x - step * 0.2, baseY - height, Math.max(3, step * 0.45), height);
        graphics.endFill();
    });
}

function drawIndicatorRibbon(graphics, bars, startX, topPad, chartWidth, chartHeight, windowSize, color, alpha) {
    graphics.clear();
    if (!bars.length) {
        return;
    }

    const values = movingAverage(bars.map((bar) => Number(bar.close || 0)), windowSize);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 0.0001);
    graphics.lineStyle(2, color, alpha);

    values.forEach((value, index) => {
        const x = startX + (index / Math.max(values.length - 1, 1)) * chartWidth;
        const y = topPad + chartHeight - (((value - min) / span) * chartHeight * 0.7 + chartHeight * 0.14);
        if (index === 0) {
            graphics.moveTo(x, y);
        } else {
            graphics.lineTo(x, y);
        }
    });
}

function drawCandles(graphics, bars, leftPad, topPad, chartHeight, min, span, step, candleWidth) {
    graphics.clear();
    bars.forEach((bar, index) => {
        const x = leftPad + index * step;
        const open = projectY(Number(bar.open || 0), min, span, topPad, chartHeight);
        const close = projectY(Number(bar.close || 0), min, span, topPad, chartHeight);
        const high = projectY(Number(bar.high || 0), min, span, topPad, chartHeight);
        const low = projectY(Number(bar.low || 0), min, span, topPad, chartHeight);
        const bullish = Number(bar.close || 0) >= Number(bar.open || 0);
        const bodyTop = Math.min(open, close);
        const bodyHeight = Math.max(Math.abs(close - open), 8);

        graphics.lineStyle(2, 0xe2f7ff, 0.84);
        graphics.moveTo(x, high);
        graphics.lineTo(x, low);
        graphics.beginFill(bullish ? 0x6affc0 : 0xff96a4, 0.92);
        graphics.drawRoundedRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight, 3);
        graphics.endFill();
    });
}

function drawPriceScale(graphics, label, bar, x, topPad, chartHeight) {
    graphics.clear();
    const markerY = topPad + chartHeight * 0.26;
    graphics.beginFill(0x43ffb6, 0.92);
    graphics.drawRoundedRect(x, markerY, 64, 24, 4);
    graphics.endFill();
    label.text = Number(bar.close || 0).toFixed(2);
    label.x = x + 7;
    label.y = markerY + 4;
}

function buildRunner() {
    const runner = new Container();
    runner.label = `runner-${RUNNER_SPRITE_SPEC.frameWidth}x${RUNNER_SPRITE_SPEC.frameHeight}`;
    const frameRoot = new Container();
    const frames = {};

    Object.entries(RUNNER_SPRITE_SPEC.animations).forEach(([name, config]) => {
        frames[name] = [];
        for (let index = 0; index < config.frames; index += 1) {
            const phase = config.frames > 1 ? index / Math.max(config.frames - 1, 1) : 0;
            const frame = createRunnerFrame(name, phase);
            frame.visible = false;
            frames[name].push(frame);
            frameRoot.addChild(frame);
        }
    });

    runner.addChild(frameRoot);
    runner.visible = false;
    runner.userData = { animation: 'run', frame: 0, frames };
    return runner;
}

function drawRunner(runner, x, y, signalType, visibleCount) {
    runner.visible = true;
    runner.x = x;
    runner.y = y;

    const tint = runnerTintForSignal(signalType);
    const animation = animationForSignal(signalType);
    const frameCount = RUNNER_SPRITE_SPEC.animations[animation]?.frames || 1;
    const frame = Math.max(0, visibleCount - 1) % frameCount;
    const frameSets = runner.userData?.frames || {};
    Object.values(frameSets).forEach((set) => {
        set.forEach((node) => {
            node.visible = false;
        });
    });

    const activeFrame = frameSets[animation]?.[frame];
    if (activeFrame) {
        activeFrame.visible = true;
        activeFrame.children.forEach((child) => {
            child.tint = tint;
        });
    }

    runner.rotation = signalType === 'sl' ? -0.16 : signalType === 'sell' ? -0.08 : 0.04;
    runner.scale.set(signalType === 'buy' ? 1.12 : signalType === 'tp' ? 1.08 : signalType === 'sl' ? 1.04 : 1);
    runner.userData = runner.userData || {};
    runner.userData.animation = animation;
    runner.userData.frame = frame;
}

function createRunnerFrame(animation, phase) {
    const frame = new Container();
    const loop = Math.sin(phase * Math.PI * 2);
    const trail = new Graphics();
    const aura = new Graphics();
    const body = new Graphics();

    trail.beginFill(0x2af6ff, 0.22);
    trail.drawRoundedRect(-34 - Math.abs(loop) * 6, -5, 24 + Math.abs(loop) * 6, 10, 5);
    trail.endFill();

    aura.beginFill(0x2af6ff, animation === 'victory' ? 0.18 : animation === 'dash' ? 0.15 : 0.12);
    aura.drawCircle(0, 0, animation === 'victory' ? 22 : 18);
    aura.endFill();

    body.lineStyle(3, 0x8ff6ff, 0.95);

    const headX = 7 + loop * 1.5;
    const headY = -16 + (animation === 'hurt' ? 2 : 0);
    body.drawCircle(headX, headY, 6);

    const torsoTopX = 6 + loop;
    const torsoTopY = -8;
    const torsoMidX = animation === 'attack' ? 2 : -2 + loop;
    const torsoMidY = 2 + (animation === 'hurt' ? 3 : 0);
    const hipX = 4 + loop * 0.8;
    const hipY = 14;
    body.moveTo(torsoTopX, torsoTopY);
    body.lineTo(torsoMidX, torsoMidY);
    body.lineTo(hipX, hipY);

    const leadLegX = animation === 'dash' ? 18 : 16 + loop * 4;
    const leadLegY = animation === 'hurt' ? 18 : 24 - loop * 3;
    const trailLegX = animation === 'hurt' ? -4 : -8 - loop * 4;
    const trailLegY = animation === 'dash' ? 28 : 26 + loop * 2;
    body.moveTo(hipX, hipY);
    body.lineTo(leadLegX, leadLegY);
    body.moveTo(hipX - 2, hipY - 1);
    body.lineTo(trailLegX, trailLegY);

    const frontArmX = animation === 'attack' ? 28 : 16 + loop * 6;
    const frontArmY = animation === 'attack' ? -2 : 8 - loop * 5;
    const backArmX = animation === 'hurt' ? -10 : -16 - loop * 4;
    const backArmY = animation === 'dash' ? -6 : -4 + loop * 3;
    body.moveTo(torsoMidX, torsoMidY);
    body.lineTo(frontArmX, frontArmY);
    body.moveTo(torsoMidX - 2, torsoMidY + 1);
    body.lineTo(backArmX, backArmY);

    if (animation === 'attack') {
        body.lineStyle(2, 0x8ff6ff, 0.55);
        body.moveTo(frontArmX, frontArmY);
        body.lineTo(frontArmX + 12, frontArmY - 6 + phase * 4);
    }

    frame.addChild(trail, aura, body);
    return frame;
}

function updateParticles(lane, x, y, signalType, latestEvent) {
    const container = lane.layers.particles;
    const burstKey = latestEvent ? `${latestEvent.bar_index}-${latestEvent.type}` : '';
    if (signalType && latestEvent && lane.lastBurstKey !== burstKey) {
        lane.lastBurstKey = burstKey;
        spawnBurst(container, x, y, signalType);
    }

    for (const particle of [...container.children]) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.alpha *= 0.92;
        particle.scale.x *= 0.98;
        particle.scale.y *= 0.98;
        if (particle.alpha < 0.04) {
            container.removeChild(particle);
            particle.destroy();
        }
    }
}

function spawnBurst(container, x, y, signalType) {
    const color = signalType === 'buy' ? 0xb8ff4a :
        signalType === 'tp' ? 0xfff07a :
            signalType === 'sell' ? 0xff8d4a :
                0xff5f49;

    for (let index = 0; index < 8; index += 1) {
        const particle = new Graphics();
        particle.beginFill(color, 0.9);
        particle.drawCircle(0, 0, 2 + (index % 3));
        particle.endFill();
        const angle = (Math.PI * 2 * index) / 8;
        particle.x = x;
        particle.y = y;
        particle.vx = Math.cos(angle) * (1.8 + (index % 2));
        particle.vy = Math.sin(angle) * (1.2 + (index % 3) * 0.25) - 0.4;
        container.addChild(particle);
    }
}

function clearParticles(container) {
    while (container.children.length) {
        const child = container.removeChildAt(0);
        child.destroy();
    }
}

function projectY(value, min, span, topPad, chartHeight) {
    return topPad + chartHeight - ((value - min) / span) * chartHeight;
}

function movingAverage(values, windowSize) {
    const result = [];
    for (let index = 0; index < values.length; index += 1) {
        const start = Math.max(0, index - windowSize + 1);
        const slice = values.slice(start, index + 1);
        const average = slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
        result.push(average);
    }
    return result;
}
