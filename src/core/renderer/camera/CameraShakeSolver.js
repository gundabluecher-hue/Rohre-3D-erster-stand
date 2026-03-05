import * as THREE from 'three';

export class CameraShakeSolver {
    constructor(timers, durations, intensities) {
        this.timers = timers;
        this.durations = durations;
        this.intensities = intensities;
    }

    trigger(playerIndex, cameraCount, intensity = 0.2, duration = 0.2) {
        if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= cameraCount) return;
        const safeIntensity = THREE.MathUtils.clamp(Number(intensity) || 0, 0, 1.5);
        const safeDuration = Math.max(0.05, Number(duration) || 0.2);
        this.intensities[playerIndex] = Math.max(
            this.intensities[playerIndex] || 0,
            safeIntensity
        );
        this.durations[playerIndex] = Math.max(
            this.durations[playerIndex] || 0,
            safeDuration
        );
        this.timers[playerIndex] = Math.max(
            this.timers[playerIndex] || 0,
            safeDuration
        );
    }

    resolveOffset(playerIndex, dt, out) {
        out.set(0, 0, 0);
        if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= this.timers.length) {
            return out;
        }

        const timer = this.timers[playerIndex] || 0;
        if (timer <= 0) {
            this.intensities[playerIndex] = 0;
            this.durations[playerIndex] = 0;
            return out;
        }

        const duration = Math.max(0.05, this.durations[playerIndex] || timer);
        const nextTimer = Math.max(0, timer - Math.max(0, dt));
        this.timers[playerIndex] = nextTimer;

        const normalized = THREE.MathUtils.clamp(nextTimer / duration, 0, 1);
        const amplitude = Math.max(0, this.intensities[playerIndex] || 0) * normalized;
        if (amplitude <= 0.0001) {
            this.intensities[playerIndex] = 0;
            return out;
        }

        const now = (typeof performance !== 'undefined' && performance.now)
            ? performance.now() * 0.001
            : Date.now() * 0.001;
        const phase = now * 44 + playerIndex * 11.7;
        out.set(
            Math.sin(phase * 1.9) * amplitude * 0.58,
            Math.cos(phase * 2.3 + 1.2) * amplitude * 0.36,
            Math.sin(phase * 2.7 + 2.4) * amplitude * 0.42
        );
        return out;
    }
}

