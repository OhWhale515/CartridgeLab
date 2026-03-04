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

    const slotGlow = new THREE.Mesh(
        new THREE.BoxGeometry(1.92, 0.03, 0.78),
        new THREE.MeshStandardMaterial({
            color: 0x2af6ff,
            emissive: 0x2af6ff,
            emissiveIntensity: 0.08,
            transparent: true,
            opacity: 0.9,
        }),
    );
    slotGlow.position.set(0, 1.385, -0.25);
    group.add(slotGlow);

    const cartridge = new THREE.Group();
    const cartridgeBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.36, 0.24, 1.9),
        new THREE.MeshStandardMaterial({
            color: 0x0e1f3e,
            roughness: 0.35,
            metalness: 0.45,
            emissive: 0x081425,
            emissiveIntensity: 0.2,
        }),
    );
    cartridge.add(cartridgeBody);

    const cartridgeLabel = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, 0.03, 0.78),
        new THREE.MeshStandardMaterial({
            color: 0x1f5eff,
            roughness: 0.2,
            metalness: 0.25,
            emissive: 0xf0b42a,
            emissiveIntensity: 0.32,
        }),
    );
    cartridgeLabel.position.set(0, 0.135, 0.08);
    cartridge.add(cartridgeLabel);

    const cartridgeEdge = new THREE.Mesh(
        new THREE.BoxGeometry(1.42, 0.05, 1.96),
        new THREE.MeshStandardMaterial({
            color: 0x17274c,
            roughness: 0.3,
            metalness: 0.55,
            emissive: 0x09111f,
            emissiveIntensity: 0.18,
        }),
    );
    cartridgeEdge.position.set(0, -0.11, 0);
    cartridge.add(cartridgeEdge);

    cartridge.position.set(0, 2.12, 0.55);
    cartridge.rotation.x = -0.16;
    cartridge.castShadow = true;
    cartridge.userData = {
        inserted: 0,
        targetInserted: 0,
    };
    group.add(cartridge);

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

    const frontStrip = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.06, 0.12),
        new THREE.MeshStandardMaterial({
            color: 0x2af6ff,
            emissive: 0x2af6ff,
            emissiveIntensity: 0.35,
            roughness: 0.2,
            metalness: 0.5,
        }),
    );
    frontStrip.position.set(0, 0.58, 1.92);
    group.add(frontStrip);

    group.userData.powerLED = powerLED;
    group.userData.slotGlow = slotGlow;
    group.userData.cartridge = cartridge;
    group.userData.frontStrip = frontStrip;
    group.userData.baseShellY = group.position.y;
    scene.add(group);
    return group;
}
