import { Howler } from 'howler';

/* ────────────────────────────────────────────────────────────────────
   Sound System — Enhanced with Equity Curve Sonification
   Original: simple oscillator SFX
   New: data-driven generative audio using pentatonic mapping.
   Each equity curve value maps to a note in C major pentatonic.
   Inspired by Miyamoto's tegotae — every interaction should FEEL right.
   ──────────────────────────────────────────────────────────────────── */

/* ── C Major Pentatonic across 2 octaves ── */
const PENTATONIC = [
    261.63, 293.66, 329.63, 392.00, 440.00,  // C4 D4 E4 G4 A4
    523.25, 587.33, 659.25, 783.99, 880.00,  // C5 D5 E5 G5 A5
];

function getAudioContext() {
    return Howler.ctx || null;
}

/* ────────────────────────────────────────────────────────────────────
   playSound — original SFX system (enhanced envelopes)
   ──────────────────────────────────────────────────────────────────── */
export function playSound(type) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const frequencies = {
        insert: 440, running: 220, reveal: 660,
        buy: 540, sell: 420, damage: 180,
        boot1: 260, boot2: 360, boot3: 480, boot4: 620,
        achievement: 880, boss_alert: 160,
        autopsy: 110, retry: 520,
    };

    const frequency = frequencies[type];
    if (!frequency) return;

    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => { });
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    const waveMap = {
        damage: 'sawtooth', autopsy: 'sawtooth', boss_alert: 'sawtooth',
        achievement: 'sine', reveal: 'sine',
    };
    oscillator.type = waveMap[type] || (type.startsWith('boot') ? 'triangle' : 'square');
    oscillator.frequency.value = frequency;

    oscillator.connect(gain);
    gain.connect(Howler.masterGain || ctx.destination);

    const now = ctx.currentTime;

    if (type === 'achievement') {
        /* triumphant arpeggio */
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.02, now + 0.03);
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.setValueAtTime(554, now + 0.1);
        oscillator.frequency.setValueAtTime(659, now + 0.2);
        oscillator.frequency.setValueAtTime(880, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        oscillator.start(now);
        oscillator.stop(now + 0.65);
    } else if (type === 'autopsy') {
        /* ominous descending tone */
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.025, now + 0.05);
        oscillator.frequency.setValueAtTime(220, now);
        oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
        oscillator.start(now);
        oscillator.stop(now + 1.05);
    } else if (type === 'boss_alert') {
        /* warning klaxon */
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.02, now + 0.01);
        oscillator.frequency.setValueAtTime(160, now);
        oscillator.frequency.setValueAtTime(200, now + 0.15);
        oscillator.frequency.setValueAtTime(160, now + 0.3);
        oscillator.frequency.setValueAtTime(200, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        oscillator.start(now);
        oscillator.stop(now + 0.65);
    } else if (type.startsWith('boot')) {
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.012, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        oscillator.start(now);
        oscillator.stop(now + 0.18);
    } else if (type === 'buy') {
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.018, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        oscillator.start(now);
        oscillator.stop(now + 0.12);
    } else if (type === 'sell') {
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.016, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        oscillator.start(now);
        oscillator.stop(now + 0.14);
    } else {
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.015, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    }
}

/* ────────────────────────────────────────────────────────────────────
   Sonification Engine — Data-Driven Generative Audio
   Maps equity curve values to pentatonic scale notes.
   ──────────────────────────────────────────────────────────────────── */

let sonificationInterval = null;
let sonificationRunning = false;

export function sonifyEquityCurve(equityCurve, options = {}) {
    stopSonification();
    if (!equityCurve || equityCurve.length < 2) return;

    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });

    const speed = options.speed || 60;       // ms per note
    const volume = options.volume || 0.012;
    const values = equityCurve.map((p) => p[1]);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const span = Math.max(maxVal - minVal, 1);

    let index = 0;
    let prevNormVal = 0;
    let winStreak = 0;
    sonificationRunning = true;

    sonificationInterval = setInterval(() => {
        if (!sonificationRunning || index >= values.length) {
            stopSonification();
            return;
        }

        const normVal = (values[index] - minVal) / span;
        const noteIndex = Math.floor(normVal * (PENTATONIC.length - 1));
        const frequency = PENTATONIC[Math.max(0, Math.min(noteIndex, PENTATONIC.length - 1))];

        /* detect movement direction */
        const rising = normVal > prevNormVal;
        const drawdown = normVal < 0.3;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        /* waveform shifts during drawdowns */
        osc.type = drawdown ? 'sawtooth' : (rising ? 'sine' : 'triangle');
        osc.frequency.value = frequency;

        osc.connect(gain);
        gain.connect(Howler.masterGain || ctx.destination);

        const now = ctx.currentTime;
        const noteLen = speed / 1000 * 0.8;
        const noteVol = volume * (0.5 + normVal * 0.5);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(noteVol, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + noteLen);

        osc.start(now);
        osc.stop(now + noteLen + 0.01);

        /* win streak chords */
        if (rising) {
            winStreak++;
        } else {
            winStreak = 0;
        }

        if (winStreak >= 5 && noteIndex + 2 < PENTATONIC.length) {
            /* play a chord (3 stacked pentatonic notes) */
            for (let ci = 1; ci <= 2; ci++) {
                const chordOsc = ctx.createOscillator();
                const chordGain = ctx.createGain();
                chordOsc.type = 'sine';
                chordOsc.frequency.value = PENTATONIC[noteIndex + ci];
                chordOsc.connect(chordGain);
                chordGain.connect(Howler.masterGain || ctx.destination);
                chordGain.gain.setValueAtTime(0, now);
                chordGain.gain.linearRampToValueAtTime(noteVol * 0.4, now + 0.01);
                chordGain.gain.exponentialRampToValueAtTime(0.0001, now + noteLen * 0.7);
                chordOsc.start(now);
                chordOsc.stop(now + noteLen * 0.7 + 0.01);
            }
        }

        prevNormVal = normVal;
        index++;
    }, speed);
}

export function stopSonification() {
    sonificationRunning = false;
    if (sonificationInterval) {
        clearInterval(sonificationInterval);
        sonificationInterval = null;
    }
}

export function isSonifying() {
    return sonificationRunning;
}
