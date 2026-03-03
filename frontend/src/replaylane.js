import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

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
            const { priceBars, visibleCount } = lane.pending;
            lane.pending = null;
            renderReplayLane(lane, priceBars, visibleCount);
        }
    }).catch((error) => {
        console.error('[ReplayLane]', error);
    });

    return lane;
}

export function renderReplayLane(lane, priceBars = [], visibleCount = 0) {
    if (!lane?.app) {
        return;
    }

    if (!lane.ready || !lane.layers) {
        lane.pending = { priceBars, visibleCount };
        return;
    }

    const { renderer } = lane.app;
    const width = lane.host?.clientWidth || renderer.width || 960;
    const height = lane.host?.clientHeight || renderer.height || 420;
    if (renderer.width !== width || renderer.height !== height) {
        renderer.resize(width, height);
    }

    drawBackground(lane.layers.background, width, height);

    if (!priceBars.length) {
        clearChartLayers(lane.layers);
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

    drawVolume(lane.layers.volume, bars, leftPad, width - rightPad, height - bottomPad + 4, 64);
    drawIndicatorRibbon(lane.layers.ribbons[0], bars, leftPad, topPad, chartWidth, chartHeight, 12, 0x9df5ff, 0.82);
    drawIndicatorRibbon(lane.layers.ribbons[1], bars, leftPad, topPad, chartWidth, chartHeight, 26, 0xffcf67, 0.72);
    drawIndicatorRibbon(lane.layers.ribbons[2], bars, leftPad, topPad, chartWidth, chartHeight, 42, 0x7cfccb, 0.64);
    drawCandles(lane.layers.candles, bars, leftPad, topPad, chartHeight, min, span, step, candleWidth);
    drawPriceScale(lane.layers.priceTag, lane.layers.priceText, bars[bars.length - 1], width - rightPad + 2, topPad, chartHeight);
}

function buildScene(stage) {
    const root = new Container();
    stage.addChild(root);

    const background = new Graphics();
    const volume = new Graphics();
    const ribbonA = new Graphics();
    const ribbonB = new Graphics();
    const ribbonC = new Graphics();
    const candles = new Graphics();
    const priceTag = new Graphics();
    const priceText = new Text('', new TextStyle({
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 12,
        fill: 0x04111f,
        fontWeight: '700',
    }));

    root.addChild(background);
    root.addChild(volume);
    root.addChild(ribbonA);
    root.addChild(ribbonB);
    root.addChild(ribbonC);
    root.addChild(candles);
    root.addChild(priceTag);
    root.addChild(priceText);

    return {
        root,
        background,
        volume,
        ribbons: [ribbonA, ribbonB, ribbonC],
        candles,
        priceTag,
        priceText,
    };
}

function clearChartLayers(layers) {
    layers.volume.clear();
    layers.ribbons.forEach((ribbon) => ribbon.clear());
    layers.candles.clear();
    layers.priceTag.clear();
    layers.priceText.text = '';
}

function drawBackground(graphics, width, height) {
    graphics.clear();

    graphics.beginFill(0x0a1834, 0.08);
    graphics.drawRect(0, 0, width, height);
    graphics.endFill();

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
        const x = width * xRatio;
        const buildingWidth = width * wRatio;
        const buildingHeight = height * hRatio;
        const y = height * 0.58 - buildingHeight;
        graphics.beginFill(index % 2 === 0 ? 0x48e4ff : 0xff58ae, 0.07);
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
