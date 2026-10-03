import { GameContext } from './state/GameContext.js?v=thin-lines-15';

/**
 * Web Audio API sound effects for Adventure 2600 clone.
 * All sounds are synthesized (no external files needed).
 */

let audioCtx = null;

function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

/**
 * Play a square-wave chirp sound.
 * Used for "pick up dot" pickup feedback.
 * Short, bright ascending chirp.
 */
export function playPickupDotSound() {
    try {
        const ctx = ensureAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.16);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
        console.warn('[Sound] Could not play pickup sound:', e);
    }
}

/**
 * Play a low-frequency noise burst.
 * Used for "dragon roar" encounter sound.
 * White noise through a low-pass filter with a quick attack.
 */
export function playDragonRoarSound() {
    try {
        const ctx = ensureAudioContext();
        const bufferSize = ctx.sampleRate * 0.4; // 400ms roar
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Generate white noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.3;
        }

        // Low-pass filter for the "roar" character
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
        filter.Q.value = 1.0;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        filter.connect(gain);
        gain.connect(ctx.destination);

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.connect(filter);
        noise.start(ctx.currentTime);
        noise.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.warn('[Sound] Could not play dragon roar:', e);
    }
}

/**
 * Play a high-pitched tone.
 * Used for "low battery" warning beep.
 * Alternating frequency to create a pulsing warning sound.
 */
export function playLowBatterySound() {
    try {
        const ctx = ensureAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.2);
        osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.warn('[Sound] Could not play low battery sound:', e);
    }
}

/**
 * Trigger the dragon roar sound when a dragon is encountered.
 */
export function triggerDragonRoarSound() {
    playDragonRoarSound();
}

/**
 * Trigger the low battery warning when lives are low.
 */
export function triggerLowBatterySound() {
    playLowBatterySound();
}

/**
 * Trigger the pickup sound when a dot is collected.
 */
export function triggerPickupSound() {
    playPickupDotSound();
}

// All functions are exported above as `export function`. No re-export needed.

export const sound = {
    triggerPickupSound,
    triggerDragonRoarSound,
    triggerLowBatterySound,
};