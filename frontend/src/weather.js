import * as THREE from 'three';

/* ────────────────────────────────────────────────────────────────────
   Weather System — Regime-Driven Atmospheric Effects
   Rain particles during bear markets, fog during volatility,
   golden light during bull runs, lightning during max drawdown.
   Inspired by Yoshio Sakamoto's environmental storytelling.
   ──────────────────────────────────────────────────────────────────── */

const RAIN_COUNT = 2400;
const RAIN_AREA = 14;
const RAIN_HEIGHT = 8;

const REGIME_COLORS = {
    bull: { ambient: 0xffd56a, fog: 0x0a0e18, fogDensity: 0.008 },
    bear: { ambient: 0x5522aa, fog: 0x060812, fogDensity: 0.032 },
    volatile: { ambient: 0xff4466, fog: 0x0a0412, fogDensity: 0.055 },
    calm: { ambient: 0x2af6ff, fog: 0x04070f, fogDensity: 0.012 },
    neutral: { ambient: 0x2af6ff, fog: 0x04070f, fogDensity: 0.015 },
};

let weatherState = {
    regime: 'neutral',
    rainActive: false,
    fogTarget: 0.015,
    lightColorTarget: new THREE.Color(0x2af6ff),
    lightningTimer: 0,
    lightningCooldown: 0,
};

let rainParticles = null;
let rainPositions = null;
let rainVelocities = null;
let weatherLight = null;
let lightningLight = null;
let fogRef = null;

export function initWeather(scene) {
    /* ── rain particle system ── */
    const rainGeo = new THREE.BufferGeometry();
    rainPositions = new Float32Array(RAIN_COUNT * 3);
    rainVelocities = new Float32Array(RAIN_COUNT);

    for (let i = 0; i < RAIN_COUNT; i++) {
        rainPositions[i * 3] = (Math.random() - 0.5) * RAIN_AREA;
        rainPositions[i * 3 + 1] = Math.random() * RAIN_HEIGHT;
        rainPositions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA;
        rainVelocities[i] = 0.06 + Math.random() * 0.08;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
        color: 0x7788cc,
        size: 0.04,
        transparent: true,
        opacity: 0.0, // hidden until bear regime
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    rainParticles = new THREE.Points(rainGeo, rainMat);
    rainParticles.name = 'weatherRain';
    scene.add(rainParticles);

    /* ── weather ambient light ── */
    weatherLight = new THREE.PointLight(0x2af6ff, 0.6, 20);
    weatherLight.position.set(0, 6, 0);
    weatherLight.name = 'weatherLight';
    scene.add(weatherLight);

    /* ── lightning flash light ── */
    lightningLight = new THREE.PointLight(0xffffff, 0, 30);
    lightningLight.position.set(0, 8, 2);
    lightningLight.name = 'lightningLight';
    scene.add(lightningLight);

    /* ── fog ── */
    fogRef = new THREE.FogExp2(0x04070f, 0.015);
    scene.fog = fogRef;

    return {
        rainParticles,
        weatherLight,
        lightningLight,
    };
}

/* ────────────────────────────────────────────────────────────────────
   setWeatherRegime — transition the atmosphere to match the market
   ──────────────────────────────────────────────────────────────────── */
export function setWeatherRegime(regime) {
    const config = REGIME_COLORS[regime] || REGIME_COLORS.neutral;
    weatherState.regime = regime;
    weatherState.rainActive = regime === 'bear' || regime === 'volatile';
    weatherState.fogTarget = config.fogDensity;
    weatherState.lightColorTarget = new THREE.Color(config.ambient);

    if (fogRef) {
        fogRef.color.set(config.fog);
    }
}

/* ────────────────────────────────────────────────────────────────────
   updateWeather — call each frame to animate particles + transitions
   ──────────────────────────────────────────────────────────────────── */
export function updateWeather(elapsed, delta) {
    if (!rainParticles || !fogRef) {
        return;
    }

    /* ── fog density lerp ── */
    fogRef.density += (weatherState.fogTarget - fogRef.density) * 0.03;

    /* ── weather light color lerp ── */
    if (weatherLight) {
        weatherLight.color.lerp(weatherState.lightColorTarget, 0.04);
    }

    /* ── rain animation ── */
    const rainOpacityTarget = weatherState.rainActive ? 0.55 : 0.0;
    rainParticles.material.opacity += (rainOpacityTarget - rainParticles.material.opacity) * 0.05;

    if (weatherState.rainActive || rainParticles.material.opacity > 0.01) {
        const positions = rainParticles.geometry.attributes.position.array;
        for (let i = 0; i < RAIN_COUNT; i++) {
            positions[i * 3 + 1] -= rainVelocities[i];

            if (positions[i * 3 + 1] < -0.5) {
                positions[i * 3 + 1] = RAIN_HEIGHT;
                positions[i * 3] = (Math.random() - 0.5) * RAIN_AREA;
                positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA;
            }
        }
        rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    /* ── lightning during volatile regime ── */
    if (lightningLight) {
        if (weatherState.regime === 'volatile' || weatherState.regime === 'bear') {
            weatherState.lightningTimer += delta;

            if (weatherState.lightningTimer > weatherState.lightningCooldown) {
                /* flash! */
                lightningLight.intensity = 3.0 + Math.random() * 4.0;
                lightningLight.position.set(
                    (Math.random() - 0.5) * 10,
                    6 + Math.random() * 3,
                    (Math.random() - 0.5) * 6,
                );

                weatherState.lightningTimer = 0;
                weatherState.lightningCooldown = 2.0 + Math.random() * 5.0;
            }
        }

        /* decay lightning intensity */
        lightningLight.intensity *= 0.88;
        if (lightningLight.intensity < 0.01) {
            lightningLight.intensity = 0;
        }
    }
}

/* ────────────────────────────────────────────────────────────────────
   detectRegimeFromEquity — simple regime classification
   Uses rate-of-change and volatility of the equity curve.
   ──────────────────────────────────────────────────────────────────── */
export function detectRegimeFromEquity(equityCurve, currentIndex) {
    if (!equityCurve || equityCurve.length < 10 || currentIndex < 10) {
        return 'neutral';
    }

    const lookback = Math.min(20, currentIndex);
    const recent = equityCurve.slice(currentIndex - lookback, currentIndex + 1);
    const values = recent.map((p) => p[1]);

    /* rate of change */
    const first = values[0];
    const last = values[values.length - 1];
    const roc = (last - first) / Math.max(Math.abs(first), 1);

    /* volatility (std dev of returns) */
    const returns = [];
    for (let i = 1; i < values.length; i++) {
        returns.push((values[i] - values[i - 1]) / Math.max(Math.abs(values[i - 1]), 1));
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    const volatility = Math.sqrt(variance);

    if (volatility > 0.03) {
        return 'volatile';
    }
    if (roc > 0.02) {
        return 'bull';
    }
    if (roc < -0.02) {
        return 'bear';
    }
    return 'calm';
}
