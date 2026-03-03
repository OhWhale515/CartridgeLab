import * as THREE from 'three';

export function buildConsole(scene) {
    const group = new THREE.Group();

    const shell = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 1.2, 3.8),
        new THREE.MeshStandardMaterial({
            color: 0x1a1830,
            roughness: 0.45,
            metalness: 0.35,
            emissive: 0x090612,
        }),
    );
    shell.position.y = 0.6;
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);

    const topDeck = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 0.25, 2.4),
        new THREE.MeshStandardMaterial({
            color: 0x242042,
            roughness: 0.4,
            metalness: 0.2,
        }),
    );
    topDeck.position.set(0, 1.18, -0.1);
    topDeck.castShadow = true;
    group.add(topDeck);

    const slot = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.12, 0.65),
        new THREE.MeshStandardMaterial({
            color: 0x050505,
            roughness: 0.8,
            metalness: 0.1,
        }),
    );
    slot.position.set(0, 1.32, -0.25);
    group.add(slot);

    const trim = new THREE.Mesh(
        new THREE.TorusGeometry(2.4, 0.08, 16, 48),
        new THREE.MeshStandardMaterial({
            color: 0x00d8d8,
            emissive: 0x00b7b7,
            emissiveIntensity: 0.45,
            roughness: 0.25,
            metalness: 0.6,
        }),
    );
    trim.rotation.x = Math.PI / 2;
    trim.position.set(0, 0.75, 0);
    group.add(trim);

    const powerLED = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 16),
        new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 0.7,
        }),
    );
    powerLED.position.set(2.1, 0.55, 1.75);
    group.add(powerLED);

    group.userData.powerLED = powerLED;
    scene.add(group);
    return group;
}
