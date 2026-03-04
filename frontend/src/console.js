import * as THREE from 'three';

export function buildConsole(scene) {
    const group = new THREE.Group();

    // 1. Main Base
    const baseShell = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 1.0, 4.2),
        new THREE.MeshStandardMaterial({
            color: 0x121024,
            roughness: 0.5,
            metalness: 0.3,
            emissive: 0x05040a,
        })
    );
    baseShell.position.y = 0.5;
    baseShell.castShadow = true;
    baseShell.receiveShadow = true;
    group.add(baseShell);

    // 2. Raised Back Deck (SNES style)
    const backDeck = new THREE.Mesh(
        new THREE.BoxGeometry(4.8, 0.4, 2.6),
        new THREE.MeshStandardMaterial({
            color: 0x1c1936,
            roughness: 0.4,
            metalness: 0.2,
        })
    );
    backDeck.position.set(0, 1.2, -0.6);
    backDeck.castShadow = true;
    group.add(backDeck);

    // 3. Sloped Front Edge (Visual detail)
    const frontBevel = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 0.2, 0.4),
        new THREE.MeshStandardMaterial({
            color: 0x0f0d1c,
            roughness: 0.6,
            metalness: 0.1,
        })
    );
    frontBevel.position.set(0, 0.9, 1.9);
    group.add(frontBevel);

    // 4. Cartridge Slot Cavity
    const slotCavity = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.5, 0.65),
        new THREE.MeshStandardMaterial({
            color: 0x020202,
            roughness: 0.9,
            metalness: 0.1,
        })
    );
    slotCavity.position.set(0, 1.25, -0.6);
    group.add(slotCavity);

    // Slot glowing rails
    const slotGlow = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.05, 0.75),
        new THREE.MeshStandardMaterial({
            color: 0x2af6ff,
            emissive: 0x2af6ff,
            emissiveIntensity: 0.08,
            transparent: true,
            opacity: 0.9,
        })
    );
    slotGlow.position.set(0, 1.41, -0.6);
    group.add(slotGlow);

    // 5. Cooling Vents (Top Left & Right of back deck)
    const createVents = (xOffset) => {
        const ventGroup = new THREE.Group();
        for (let i = 0; i < 6; i++) {
            const vent = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 0.05, 0.1),
                new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 })
            );
            vent.position.set(0, 0, i * 0.2 - 0.5);
            ventGroup.add(vent);
        }
        ventGroup.position.set(xOffset, 1.41, -0.6);
        return ventGroup;
    };
    group.add(createVents(-1.6));
    group.add(createVents(1.6));

    // 6. Buttons: Power and Reset
    const powerButton = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.25, 0.15, 32),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.4 })
    );
    powerButton.position.set(-1.8, 1.05, 1.2);
    group.add(powerButton);

    const resetButton = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.18, 0.15, 32),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.4 })
    );
    resetButton.position.set(-1.2, 1.05, 1.2);
    group.add(resetButton);

    // 7. Controller Ports (Front face)
    const createPort = (xOffset) => {
        const port = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.3, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 })
        );
        port.position.set(xOffset, 0.5, 2.11);
        return port;
    };
    group.add(createPort(-1.5));
    group.add(createPort(1.5));

    // 8. Power LED indicator
    const powerLED = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 16),
        new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 0.7,
        })
    );
    powerLED.position.set(-2.3, 1.05, 1.25);
    group.add(powerLED);

    // Front Trim Glowing Strip
    const frontStrip = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.04, 0.05),
        new THREE.MeshStandardMaterial({
            color: 0x2af6ff,
            emissive: 0x2af6ff,
            emissiveIntensity: 0.35,
            roughness: 0.2,
            metalness: 0.5,
        })
    );
    frontStrip.position.set(0, 0.3, 2.11);
    group.add(frontStrip);

    // 9. Base Trim Ring
    const trim = new THREE.Mesh(
        new THREE.TorusGeometry(2.8, 0.05, 16, 48),
        new THREE.MeshStandardMaterial({
            color: 0x00d8d8,
            emissive: 0x00b7b7,
            emissiveIntensity: 0.45,
            roughness: 0.25,
            metalness: 0.6,
        })
    );
    trim.rotation.x = Math.PI / 2;
    trim.position.set(0, 0.15, 0);
    trim.scale.set(1, 0.7, 1);
    group.add(trim);

    // --- CARTRIDGE ---
    const cartridge = new THREE.Group();
    
    // Main cartridge casing
    const cartridgeBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.3, 2.2),
        new THREE.MeshStandardMaterial({
            color: 0x0e1f3e,
            roughness: 0.35,
            metalness: 0.45,
            emissive: 0x081425,
            emissiveIntensity: 0.2,
        })
    );
    cartridge.add(cartridgeBody);

    // Cartridge label
    const cartridgeLabel = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.02, 1.2),
        new THREE.MeshStandardMaterial({
            color: 0x1f5eff,
            roughness: 0.2,
            metalness: 0.25,
            emissive: 0xf0b42a, // Default gold for .py
            emissiveIntensity: 0.32,
        })
    );
    cartridgeLabel.position.set(0, 0.16, 0.1);
    cartridge.add(cartridgeLabel);

    // Cartridge edge grip
    const cartridgeEdge = new THREE.Mesh(
        new THREE.BoxGeometry(1.66, 0.08, 2.26),
        new THREE.MeshStandardMaterial({
            color: 0x17274c,
            roughness: 0.3,
            metalness: 0.55,
            emissive: 0x09111f,
            emissiveIntensity: 0.18,
        })
    );
    cartridgeEdge.position.set(0, -0.1, 0);
    cartridge.add(cartridgeEdge);

    // Start position (floating above slot)
    cartridge.position.set(0, 3.8, -0.6); // Start higher up
    cartridge.rotation.x = -0.15;
    cartridge.castShadow = true;
    
    // Default hiding or positioning logic is handled by main.js GSAP now, but we keep the initial look
    cartridge.userData = {
        labelMaterial: cartridgeLabel.material,
        bodyMaterial: cartridgeBody.material
    };

    group.add(cartridge);

    // Store references
    group.userData.powerLED = powerLED;
    group.userData.slotGlow = slotGlow;
    group.userData.cartridge = cartridge;
    group.userData.frontStrip = frontStrip;
    group.userData.baseShellY = group.position.y;
    
    // Define the dynamic theme setter on the group itself
    group.userData.setCartridgeTheme = (filename) => {
        const ext = String(filename).split('.').pop().toLowerCase();
        let glowColor = 0xf0b42a; // Gold (.py)
        let bodyColor = 0x0e1f3e; 
        
        switch(ext) {
            case 'py':
                glowColor = 0xf0b42a; // Gold
                bodyColor = 0x0e1f3e; // Deep Blue
                break;
            case 'pine':
                glowColor = 0x22c55e; // Green
                bodyColor = 0x0f2a1a; // Dark Green
                break;
            case 'mq4':
            case 'mq5':
                glowColor = 0x3b82f6; // Bright Blue
                bodyColor = 0x172554; // Navy
                break;
            default:
                glowColor = 0xa855f7; // Purple for unknowns
                bodyColor = 0x2e1065;
                break;
        }

        cartridge.userData.labelMaterial.emissive.setHex(glowColor);
        cartridge.userData.bodyMaterial.color.setHex(bodyColor);
    };

    scene.add(group);
    return group;
}
