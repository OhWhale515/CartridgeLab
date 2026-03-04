import * as THREE from 'three';

/* ────────────────────────────────────────────────────────────────────
   ChartWorld — 3D Equity Terrain
   PlaneGeometry vertex displacement driven by equity curve data.
   Green peaks for profit, red valleys for drawdown.
   Directional trade markers. Animated camera path.
   ──────────────────────────────────────────────────────────────────── */

const TERRAIN_WIDTH = 10;
const TERRAIN_DEPTH = 3.6;
const DEPTH_SEGMENTS = 6;
const TERRAIN_HEIGHT_MAX = 3.2;
const TERRAIN_Y_OFFSET = 0.12;

const GREEN_PEAK = new THREE.Color(0x00ff88);
const RED_VALLEY = new THREE.Color(0xff2255);
const GOLD_MID = new THREE.Color(0xffd56a);
const CYAN_GLOW = new THREE.Color(0x2af6ff);

export function initChartWorld(scene) {
    const group = new THREE.Group();
    group.position.set(0, TERRAIN_Y_OFFSET, 0);

    /* ── circular pedestal ── */
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(5.2, 5.2, 0.06, 64),
        new THREE.MeshStandardMaterial({
            color: 0x08111e,
            roughness: 0.8,
            metalness: 0.3,
        }),
    );
    base.receiveShadow = true;
    group.add(base);

    /* ── grid floor ── */
    const gridHelper = new THREE.GridHelper(10, 40, 0x0a1830, 0x0a1830);
    gridHelper.position.y = 0.04;
    gridHelper.material.opacity = 0.25;
    gridHelper.material.transparent = true;
    group.add(gridHelper);

    /* ── terrain placeholder (built on data arrival) ── */
    const terrainContainer = new THREE.Group();
    terrainContainer.name = 'terrainContainer';
    group.add(terrainContainer);

    /* ── trade markers ── */
    const tradeMarkers = new THREE.Group();
    tradeMarkers.name = 'tradeMarkers';
    group.add(tradeMarkers);

    /* ── cursor light that follows the latest data point ── */
    const cursorLight = new THREE.PointLight(0xffd56a, 2.4, 6);
    cursorLight.position.set(0, 2, 0);
    cursorLight.visible = false;
    group.add(cursorLight);

    /* ── spine glow line (ridge of the terrain) ── */
    const spineMaterial = new THREE.LineBasicMaterial({
        color: 0x2af6ff,
        transparent: true,
        opacity: 0.6,
    });
    const spineLine = new THREE.Line(new THREE.BufferGeometry(), spineMaterial);
    spineLine.name = 'spineLine';
    group.add(spineLine);

    /* ── ambient point light for the terrain ── */
    const ambientGlow = new THREE.PointLight(0x2af6ff, 0.8, 14);
    ambientGlow.position.set(0, 4, 0);
    group.add(ambientGlow);

    group.userData = {
        terrainContainer,
        tradeMarkers,
        cursorLight,
        spineLine,
        ambientGlow,
        terrainMesh: null,
        cameraPath: null,
    };

    scene.add(group);
    return group;
}

/* ────────────────────────────────────────────────────────────────────
   updateTerrain — build or refresh the 3D terrain from equity data
   equityCurve: [[timestamp, value], ...] sorted by time
   options: { trades: [], visibleCount: N, regimePeriods: [] }
   ──────────────────────────────────────────────────────────────────── */
export function updateTerrain(chartWorld, equityCurve, options = {}) {
    if (!chartWorld?.userData) {
        return;
    }

    const { terrainContainer, tradeMarkers, cursorLight, spineLine } = chartWorld.userData;

    if (!Array.isArray(equityCurve) || equityCurve.length < 2) {
        clearTerrain(chartWorld);
        return;
    }

    const dataLen = equityCurve.length;
    const widthSegs = Math.min(dataLen - 1, 256);
    const depthSegs = DEPTH_SEGMENTS;

    /* ── normalise equity values ── */
    const values = equityCurve.map((p) => p[1]);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const span = Math.max(maxVal - minVal, 1);

    /* ── build or reuse geometry ── */
    disposeTerrain(terrainContainer);

    const geometry = new THREE.PlaneGeometry(
        TERRAIN_WIDTH, TERRAIN_DEPTH, widthSegs, depthSegs,
    );
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position;
    const vertexCount = posAttr.count;
    const colors = new Float32Array(vertexCount * 3);
    const cameraPathPoints = [];

    for (let i = 0; i < vertexCount; i++) {
        const ix = i % (widthSegs + 1);
        const iz = Math.floor(i / (widthSegs + 1));
        const t = ix / widthSegs;

        /* map to equity value */
        const dataIndex = Math.min(Math.floor(t * (dataLen - 1)), dataLen - 1);
        const eqVal = values[dataIndex];
        const normVal = (eqVal - minVal) / span; // 0..1

        /* height = equity, with subtle depth wave */
        const depthWave = Math.sin((iz / depthSegs) * Math.PI) * 0.95;
        const height = normVal * TERRAIN_HEIGHT_MAX * depthWave;

        posAttr.setY(i, height);

        /* ── per-vertex color: red → gold → green ── */
        const color = new THREE.Color();
        if (normVal < 0.5) {
            color.copy(RED_VALLEY).lerp(GOLD_MID, normVal * 2);
        } else {
            color.copy(GOLD_MID).lerp(GREEN_PEAK, (normVal - 0.5) * 2);
        }

        /* add subtle cyan glow on ridgeline */
        if (iz === Math.floor(depthSegs / 2)) {
            color.lerp(CYAN_GLOW, 0.15);
        }

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        /* collect spine points for camera path (center row only) */
        if (iz === Math.floor(depthSegs / 2)) {
            cameraPathPoints.push(new THREE.Vector3(
                posAttr.getX(i),
                height + 1.8,
                posAttr.getZ(i) + 3.5,
            ));
        }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    /* ── terrain material ── */
    const terrainMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        metalness: 0.35,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
    });

    const mesh = new THREE.Mesh(geometry, terrainMat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    terrainContainer.add(mesh);

    /* ── wireframe overlay ── */
    const wireMat = new THREE.MeshBasicMaterial({
        color: 0x2af6ff,
        wireframe: true,
        transparent: true,
        opacity: 0.06,
    });
    const wireMesh = new THREE.Mesh(geometry.clone(), wireMat);
    wireMesh.position.y = 0.01;
    terrainContainer.add(wireMesh);

    /* ── spine glow line (ridge) ── */
    const spineGeometry = new THREE.BufferGeometry().setFromPoints(
        cameraPathPoints.map((p) => new THREE.Vector3(p.x, p.y - 1.6, p.z - 3.5)),
    );
    spineLine.geometry.dispose();
    spineLine.geometry = spineGeometry;

    /* ── cursor light at latest point ── */
    const lastVal = values[values.length - 1];
    const lastNorm = (lastVal - minVal) / span;
    cursorLight.position.set(
        TERRAIN_WIDTH / 2,
        lastNorm * TERRAIN_HEIGHT_MAX + 0.5,
        0,
    );
    cursorLight.visible = true;
    cursorLight.color.copy(lastNorm > 0.5 ? GREEN_PEAK : RED_VALLEY);

    /* ── trade markers ── */
    renderTradeMarkers(tradeMarkers, equityCurve, values, minVal, span, options.trades || [], widthSegs);

    /* ── store references ── */
    chartWorld.userData.terrainMesh = mesh;
    chartWorld.userData.cameraPath = cameraPathPoints;
    chartWorld.userData.equityStats = { minVal, maxVal, span, dataLen };
}

/* ────────────────────────────────────────────────────────────────────
   Trade markers — directional cones at trade locations
   ──────────────────────────────────────────────────────────────────── */
function renderTradeMarkers(group, equityCurve, values, minVal, span, trades, widthSegs) {
    while (group.children.length) {
        const child = group.children.pop();
        child.geometry?.dispose?.();
        child.material?.dispose?.();
    }

    if (!trades.length) {
        return;
    }

    const dataLen = values.length;
    const step = Math.max(dataLen - 1, 1);

    trades.forEach((trade, index) => {
        const tradeIndex = Math.min(
            Math.max(0, Math.round(((index + 1) / trades.length) * step)),
            dataLen - 1,
        );

        const pnl = Number(trade?.pnl ?? 0);
        const isBuy = pnl >= 0;
        const normVal = (values[tradeIndex] - minVal) / span;
        const x = ((tradeIndex / step) - 0.5) * TERRAIN_WIDTH;
        const y = normVal * TERRAIN_HEIGHT_MAX * 0.95;

        /* ── directional cone ── */
        const coneGeo = new THREE.ConeGeometry(0.08, 0.28, 8);
        const coneMat = new THREE.MeshStandardMaterial({
            color: isBuy ? 0x00ff88 : 0xff2255,
            emissive: isBuy ? 0x00ff88 : 0xff2255,
            emissiveIntensity: 0.9,
            transparent: true,
            opacity: 0.85,
        });

        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(x, y + (isBuy ? 0.3 : -0.1), 0);

        if (!isBuy) {
            cone.rotation.z = Math.PI; // point down for sells
        }

        group.add(cone);

        /* ── vertical connecting line ── */
        const linePoints = [
            new THREE.Vector3(x, 0.04, 0),
            new THREE.Vector3(x, y, 0),
        ];
        const lineMat = new THREE.LineBasicMaterial({
            color: isBuy ? 0x00ff88 : 0xff2255,
            transparent: true,
            opacity: 0.25,
        });
        const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
        group.add(new THREE.Line(lineGeo, lineMat));
    });
}

/* ────────────────────────────────────────────────────────────────────
   getCameraPath — returns the array of camera positions for fly-through
   ──────────────────────────────────────────────────────────────────── */
export function getCameraPath(chartWorld) {
    return chartWorld?.userData?.cameraPath || [];
}

/* ────────────────────────────────────────────────────────────────────
   clearTerrain / disposeTerrain — cleanup
   ──────────────────────────────────────────────────────────────────── */
export function clearTerrain(chartWorld) {
    if (!chartWorld?.userData) {
        return;
    }

    disposeTerrain(chartWorld.userData.terrainContainer);

    const { cursorLight, spineLine, tradeMarkers } = chartWorld.userData;
    if (cursorLight) {
        cursorLight.visible = false;
    }

    if (spineLine?.geometry) {
        spineLine.geometry.dispose();
        spineLine.geometry = new THREE.BufferGeometry();
    }

    while (tradeMarkers?.children?.length) {
        const child = tradeMarkers.children.pop();
        child.geometry?.dispose?.();
        child.material?.dispose?.();
    }
}

function disposeTerrain(container) {
    if (!container) {
        return;
    }

    while (container.children.length) {
        const child = container.children.pop();
        child.geometry?.dispose?.();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
            } else {
                child.material.dispose();
            }
        }
    }
}
