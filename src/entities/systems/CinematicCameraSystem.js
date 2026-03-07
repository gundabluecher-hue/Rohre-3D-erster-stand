import * as THREE from 'three';

export class CinematicCameraSystem {
    constructor({
        enabled = true,
        enterSpeed = 5.5,
        exitSpeed = 8.0,
        boostOffset = 0.85,
        baseLookAhead = 1.6,
        swayFrequency = 0.8,
        swayAmount = 0.5,
        liftAmount = 0.35,
    } = {}) {
        this.enabled = enabled !== false;
        this.enterSpeed = Math.max(0.001, Number(enterSpeed) || 5.5);
        this.exitSpeed = Math.max(0.001, Number(exitSpeed) || 8.0);
        this.boostOffset = Number.isFinite(Number(boostOffset)) ? Number(boostOffset) : 0.85;
        this.baseLookAhead = Number.isFinite(Number(baseLookAhead)) ? Number(baseLookAhead) : 1.6;
        this.swayFrequency = Math.max(0, Number(swayFrequency) || 0.8);
        this.swayAmount = Number.isFinite(Number(swayAmount)) ? Number(swayAmount) : 0.5;
        this.liftAmount = Number.isFinite(Number(liftAmount)) ? Number(liftAmount) : 0.35;

        this._blendByPlayer = [];
        this._timeByPlayer = [];

        this._tmpDir = new THREE.Vector3();
        this._tmpSide = new THREE.Vector3();
        this._up = new THREE.Vector3(0, 1, 0);
    }

    isEnabled() {
        return this.enabled;
    }

    setEnabled(enabled) {
        this.enabled = !!enabled;
    }

    getPlayerBlend(playerIndex) {
        return this._blendByPlayer[playerIndex] || 0;
    }

    apply({
        playerIndex,
        mode,
        target,
        playerDirection,
        playerPosition,
        dt,
        isBoosting = false,
    }) {
        if (!target || !playerDirection || !playerPosition) return;
        if (!Number.isInteger(playerIndex) || playerIndex < 0) return;

        const cinematicPreferred = this.enabled && mode === 'THIRD_PERSON';
        const targetBlend = cinematicPreferred ? 1 : 0;
        const previousBlend = this._blendByPlayer[playerIndex] || 0;
        const blendSpeed = targetBlend > previousBlend ? this.enterSpeed : this.exitSpeed;
        const alpha = 1 - Math.exp(-blendSpeed * Math.max(0, Number(dt) || 0));
        const blend = THREE.MathUtils.clamp(THREE.MathUtils.lerp(previousBlend, targetBlend, alpha), 0, 1);
        this._blendByPlayer[playerIndex] = blend;

        if (mode !== 'THIRD_PERSON') {
            return;
        }

        if (blend <= 0.0001) {
            return;
        }

        const elapsed = (this._timeByPlayer[playerIndex] || 0) + Math.max(0, Number(dt) || 0);
        this._timeByPlayer[playerIndex] = elapsed;

        this._tmpDir.copy(playerDirection);
        if (this._tmpDir.lengthSq() <= 0.000001) {
            this._tmpDir.set(0, 0, -1);
        } else {
            this._tmpDir.normalize();
        }

        this._tmpSide.crossVectors(this._up, this._tmpDir);
        if (this._tmpSide.lengthSq() <= 0.000001) {
            this._tmpSide.set(1, 0, 0);
        } else {
            this._tmpSide.normalize();
        }

        const boostBlend = isBoosting ? 1 : 0;
        const sway = Math.sin((elapsed * this.swayFrequency) + playerIndex * 0.7) * this.swayAmount * blend;
        const lift = this.liftAmount * blend;
        const lookAhead = (this.baseLookAhead + this.boostOffset * boostBlend) * blend;

        target.position.addScaledVector(this._tmpSide, sway);
        target.position.y += lift;
        target.lookAt.copy(playerPosition).addScaledVector(this._tmpDir, lookAhead);
    }

    reset() {
        this._blendByPlayer.length = 0;
        this._timeByPlayer.length = 0;
    }
}
