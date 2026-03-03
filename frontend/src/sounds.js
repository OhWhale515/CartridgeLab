let audioContext;

function getAudioContext() {
    if (!audioContext) {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
            return null;
        }

        audioContext = new AudioContextCtor();
    }

    return audioContext;
}

export function playSound(type) {
    const ctx = getAudioContext();
    if (!ctx) {
        return;
    }

    const frequencies = {
        insert: 440,
        running: 220,
        reveal: 660,
        boot1: 260,
        boot2: 360,
        boot3: 480,
        boot4: 620,
    };

    const frequency = frequencies[type];
    if (!frequency) {
        return;
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type.startsWith('boot') ? 'triangle' : 'square';
    oscillator.frequency.value = frequency;
    gain.gain.value = type.startsWith('boot') ? 0.012 : 0.015;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type.startsWith('boot')) {
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.012, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    }
    oscillator.start(now);
    oscillator.stop(now + (type.startsWith('boot') ? 0.18 : 0.08));
}
