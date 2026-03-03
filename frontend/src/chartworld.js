import * as THREE from 'three';

export function initChartWorld(scene) {
    const group = new THREE.Group();
    group.position.set(0, 0.08, 0);

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(4.6, 4.6, 0.08, 64),
        new THREE.MeshStandardMaterial({
            color: 0x10131f,
            roughness: 0.75,
            metalness: 0.25,
        }),
    );
    base.receiveShadow = true;
    group.add(base);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffee });
    const line = new THREE.Line(new THREE.BufferGeometry(), lineMaterial);
    line.position.y = 0.08;
    group.add(line);

    const cursor = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 18, 18),
        new THREE.MeshStandardMaterial({
            color: 0xffd56a,
            emissive: 0xffd56a,
            emissiveIntensity: 0.9,
        }),
    );
    cursor.position.set(0, 0.2, 0);
    cursor.visible = false;
    group.add(cursor);

    const tradeMarkers = new THREE.Group();
    group.add(tradeMarkers);

    const glow = new THREE.PointLight(0x00ffee, 1.2, 12);
    glow.position.set(0, 2.5, 0);
    group.add(glow);

    group.userData.line = line;
    group.userData.cursor = cursor;
    group.userData.tradeMarkers = tradeMarkers;
    scene.add(group);
    return group;
}

export function updateTerrain(chartWorld, equityCurve, options = {}) {
    const line = chartWorld?.userData?.line;
    const cursor = chartWorld?.userData?.cursor;
    const tradeMarkers = chartWorld?.userData?.tradeMarkers;
    if (!line) {
        return;
    }

    if (!Array.isArray(equityCurve) || equityCurve.length === 0) {
        line.geometry.setFromPoints([]);
        if (cursor) {
            cursor.visible = false;
        }
        return;
    }

    const points = buildPoints(equityCurve);
    const visibleCount = Math.max(
        1,
        Math.min(options.visibleCount ?? points.length, points.length),
    );
    const visiblePoints = points.slice(0, visibleCount);

    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(visiblePoints);

    if (cursor) {
        const lastPoint = visiblePoints[visiblePoints.length - 1];
        cursor.visible = Boolean(lastPoint);
        if (lastPoint) {
            cursor.position.copy(lastPoint);
        }
    }

    if (tradeMarkers) {
        renderTradeMarkers(tradeMarkers, points, options.trades || [], visibleCount);
    }
}

function buildPoints(equityCurve) {
    const values = equityCurve.map((point) => point[1]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 1);
    const half = Math.max(equityCurve.length - 1, 1) / 2;

    return equityCurve.map((point, index) => {
        const x = ((index - half) / Math.max(half, 1)) * 3.8;
        const y = ((point[1] - min) / span) * 2.4 + 0.15;
        const z = Math.sin(index * 0.08) * 0.25;
        return new THREE.Vector3(x, y, z);
    });
}

function renderTradeMarkers(group, points, trades, visibleCount) {
    while (group.children.length) {
        const child = group.children.pop();
        child.geometry?.dispose?.();
        child.material?.dispose?.();
    }

    if (!trades.length || !points.length) {
        return;
    }

    const step = Math.max(points.length - 1, 1);
    trades.forEach((trade, index) => {
        const markerIndex = Math.min(
            visibleCount - 1,
            Math.max(0, Math.round(((index + 1) / trades.length) * step)),
        );
        if (markerIndex >= visibleCount) {
            return;
        }

        const pnl = Number(trade?.pnl ?? 0);
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 12, 12),
            new THREE.MeshStandardMaterial({
                color: pnl >= 0 ? 0x00ff88 : 0xff2255,
                emissive: pnl >= 0 ? 0x00ff88 : 0xff2255,
                emissiveIntensity: 0.7,
            }),
        );
        marker.position.copy(points[markerIndex]);
        marker.position.y += 0.06;
        group.add(marker);
    });
}
