import { Howler } from 'howler';

function getAudioContext() {
    return Howler.ctx || null;
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
        buy: 540,
        sell: 420,
        damage: 180,
        boot1: 260,
        boot2: 360,
        boot3: 480,
        boot4: 620,
    };

    const frequency = frequencies[type];
    if (!frequency) {
        return;
    }

    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type === 'damage' ? 'sawtooth' : type.startsWith('boot') ? 'triangle' : 'square';
    oscillator.frequency.value = frequency;
    gain.gain.value = type.startsWith('boot') ? 0.012 : 0.015;

    oscillator.connect(gain);
    gain.connect(Howler.masterGain || ctx.destination);

    const now = ctx.currentTime;
    if (type.startsWith('boot')) {
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.012, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    } else if (type === 'buy') {
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.018, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    } else if (type === 'sell') {
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.016, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    } else if (type === 'damage') {
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.02, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    }
    oscillator.start(now);
    oscillator.stop(now + (type.startsWith('boot') ? 0.18 : type === 'damage' ? 0.16 : 0.1));
}
