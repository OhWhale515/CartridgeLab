export const RUNNER_SPRITE_SPEC = {
    atlasPath: '/assets/runner/aqua-xinobi-sheet.png',
    manifestPath: '/assets/runner/aqua-xinobi.json',
    frameWidth: 128,
    frameHeight: 128,
    anchor: {
        x: 0.5,
        y: 0.86,
    },
    animations: {
        idle: { row: 0, frames: 4, fps: 8, loop: true },
        run: { row: 1, frames: 8, fps: 14, loop: true },
        dash: { row: 2, frames: 4, fps: 16, loop: false },
        attack: { row: 3, frames: 4, fps: 14, loop: false },
        hurt: { row: 4, frames: 3, fps: 10, loop: false },
        victory: { row: 5, frames: 4, fps: 10, loop: true },
    },
};

export function animationForSignal(signalType) {
    if (signalType === 'buy') {
        return 'dash';
    }
    if (signalType === 'sell') {
        return 'attack';
    }
    if (signalType === 'tp') {
        return 'victory';
    }
    if (signalType === 'sl') {
        return 'hurt';
    }
    return 'run';
}

export function runnerTintForSignal(signalType) {
    if (signalType === 'buy') {
        return 0xb8ff4a;
    }
    if (signalType === 'sell') {
        return 0xff8d4a;
    }
    if (signalType === 'tp') {
        return 0xfff07a;
    }
    if (signalType === 'sl') {
        return 0xff5f49;
    }
    return 0x8ff6ff;
}
