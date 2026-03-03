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

    const glow = new THREE.PointLight(0x00ffee, 1.2, 12);
    glow.position.set(0, 2.5, 0);
    group.add(glow);

    group.userData.line = line;
    scene.add(group);
    return group;
}

export function updateTerrain(chartWorld, equityCurve) {
    const line = chartWorld?.userData?.line;
    if (!line) {
        return;
    }

    if (!Array.isArray(equityCurve) || equityCurve.length === 0) {
        line.geometry.setFromPoints([]);
        return;
    }

    const values = equityCurve.map((point) => point[1]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 1);
    const half = Math.max(equityCurve.length - 1, 1) / 2;
    const points = equityCurve.map((point, index) => {
        const x = ((index - half) / Math.max(half, 1)) * 3.8;
        const y = ((point[1] - min) / span) * 2.4 + 0.15;
        const z = Math.sin(index * 0.08) * 0.25;
        return new THREE.Vector3(x, y, z);
    });

    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(points);
}
