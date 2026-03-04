import * as THREE from 'three';
import { CONFIG } from '../Config.js';

export class CameraRigSystem {
    constructor() {
        this.cameras = [];
        this.cameraTargets = [];
        this.cameraModes = [];
        this.cameraBoostBlend = [];
        this.cameraShakeTimers = [];
        this.cameraShakeDurations = [];
        this.cameraShakeIntensities = [];

        this._tmpVec = new THREE.Vector3();
        this._tmpVec2 = new THREE.Vector3();
        this._tmpLookAt = new THREE.Vector3();
        this._tmpCamDir = new THREE.Vector3();
        this._tmpCamProbe = new THREE.Vector3();
        this._tmpShakeOffset = new THREE.Vector3();
    }

    createCamera(aspect) {
        const cam = new THREE.PerspectiveCamera(
            CONFIG.CAMERA.FOV,
            aspect,
            CONFIG.CAMERA.NEAR,
            CONFIG.CAMERA.FAR
        );
        cam.position.set(0, 15, 20);
        this.cameras.push(cam);
        this.cameraTargets.push({
            position: new THREE.Vector3(),
            lookAt: new THREE.Vector3(),
        });
        this.cameraModes.push(0);
        this.cameraBoostBlend.push(0);
        this.cameraShakeTimers.push(0);
        this.cameraShakeDurations.push(0);
        this.cameraShakeIntensities.push(0);
        return cam;
    }

    cycleCamera(playerIndex) {
        if (playerIndex < this.cameraModes.length) {
            this.cameraModes[playerIndex] = (this.cameraModes[playerIndex] + 1) % CONFIG.CAMERA.MODES.length;
        }
    }

    getCameraMode(playerIndex) {
        return CONFIG.CAMERA.MODES[this.cameraModes[playerIndex] || 0];
    }

    triggerCameraShake(playerIndex, intensity = 0.2, duration = 0.2) {
        if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= this.cameras.length) return;
        const safeIntensity = THREE.MathUtils.clamp(Number(intensity) || 0, 0, 1.5);
        const safeDuration = Math.max(0.05, Number(duration) || 0.2);
        this.cameraShakeIntensities[playerIndex] = Math.max(
            this.cameraShakeIntensities[playerIndex] || 0,
            safeIntensity
        );
        this.cameraShakeDurations[playerIndex] = Math.max(
            this.cameraShakeDurations[playerIndex] || 0,
            safeDuration
        );
        this.cameraShakeTimers[playerIndex] = Math.max(
            this.cameraShakeTimers[playerIndex] || 0,
            safeDuration
        );
    }

    _resolveCameraShakeOffset(playerIndex, dt, out) {
        out.set(0, 0, 0);
        if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex >= this.cameraShakeTimers.length) {
            return out;
        }

        const timer = this.cameraShakeTimers[playerIndex] || 0;
        if (timer <= 0) {
            this.cameraShakeIntensities[playerIndex] = 0;
            this.cameraShakeDurations[playerIndex] = 0;
            return out;
        }

        const duration = Math.max(0.05, this.cameraShakeDurations[playerIndex] || timer);
        const nextTimer = Math.max(0, timer - Math.max(0, dt));
        this.cameraShakeTimers[playerIndex] = nextTimer;

        const normalized = THREE.MathUtils.clamp(nextTimer / duration, 0, 1);
        const amplitude = Math.max(0, this.cameraShakeIntensities[playerIndex] || 0) * normalized;
        if (amplitude <= 0.0001) {
            this.cameraShakeIntensities[playerIndex] = 0;
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

    updateCamera(
        playerIndex,
        playerPosition,
        playerDirection,
        dt,
        playerQuaternion = null,
        cockpitCamera = false,
        isBoosting = false,
        arena = null,
        firstPersonAnchor = null
    ) {
        if (playerIndex >= this.cameras.length) return;

        const cam = this.cameras[playerIndex];
        const target = this.cameraTargets[playerIndex];
        const mode = this.getCameraMode(playerIndex);
        const smooth = CONFIG.CAMERA.SMOOTHING;
        const isCockpitFirstPerson = cockpitCamera && mode === 'FIRST_PERSON';
        const lockToNose = (mode === 'FIRST_PERSON' && !!CONFIG.CAMERA.FIRST_PERSON_LOCK_TO_NOSE && !!firstPersonAnchor) || isCockpitFirstPerson;
        const noseClearance = CONFIG.CAMERA.FIRST_PERSON_NOSE_CLEARANCE || 0;
        const firstPersonHardLock = lockToNose && mode === 'FIRST_PERSON';
        const boostTarget = mode === 'FIRST_PERSON' && isBoosting ? 1 : 0;
        const boostBlendSpeed = Math.max(0.001, CONFIG.CAMERA.FIRST_PERSON_BOOST_BLEND_SPEED || 8.5);
        const boostAlpha = 1 - Math.exp(-boostBlendSpeed * Math.max(0, dt));
        const previousBoostBlend = this.cameraBoostBlend[playerIndex] || 0;
        const boostBlend = THREE.MathUtils.clamp(
            THREE.MathUtils.lerp(previousBoostBlend, boostTarget, boostAlpha),
            0,
            1
        );
        this.cameraBoostBlend[playerIndex] = boostBlend;
        const firstPersonOffset = THREE.MathUtils.lerp(
            CONFIG.CAMERA.FIRST_PERSON_OFFSET,
            CONFIG.CAMERA.FIRST_PERSON_BOOST_OFFSET || CONFIG.CAMERA.FIRST_PERSON_OFFSET,
            boostBlend
        );
        const shakeOffset = this._resolveCameraShakeOffset(playerIndex, dt, this._tmpShakeOffset);
        const hasShake = shakeOffset.x !== 0 || shakeOffset.y !== 0 || shakeOffset.z !== 0;

        if (cockpitCamera && playerQuaternion) {
            if (mode === 'THIRD_PERSON') {
                this._tmpVec.set(0, CONFIG.CAMERA.FOLLOW_HEIGHT, CONFIG.CAMERA.FOLLOW_DISTANCE);
                this._tmpVec.applyQuaternion(playerQuaternion);
                target.position.copy(playerPosition).add(this._tmpVec);
            } else if (mode === 'FIRST_PERSON') {
                if (lockToNose) {
                    target.position.copy(firstPersonAnchor);
                    if (noseClearance !== 0) {
                        target.position.addScaledVector(playerDirection, noseClearance);
                    }
                } else {
                    this._tmpVec.set(0, 0, -firstPersonOffset);
                    this._tmpVec.applyQuaternion(playerQuaternion);
                    target.position.copy(playerPosition).add(this._tmpVec);
                    this._resolveCameraCollision(playerPosition, target.position, arena);
                }
            } else if (mode === 'TOP_DOWN') {
                this._tmpVec.set(0, 40, 5);
                this._tmpVec.applyQuaternion(playerQuaternion);
                target.position.copy(playerPosition).add(this._tmpVec);
            }
            if (hasShake) {
                target.position.add(shakeOffset);
            }

            const smoothFactor = firstPersonHardLock ? 1 : (1 - Math.pow(1 - smooth, dt * 60));
            cam.position.lerp(target.position, smoothFactor);
            if (firstPersonHardLock) {
                cam.quaternion.copy(playerQuaternion);
            } else {
                cam.quaternion.slerp(playerQuaternion, smoothFactor);
            }
            return;
        }

        if (mode === 'THIRD_PERSON') {
            this._tmpVec.copy(playerDirection).multiplyScalar(-CONFIG.CAMERA.FOLLOW_DISTANCE);
            this._tmpVec.y += CONFIG.CAMERA.FOLLOW_HEIGHT;
            target.position.copy(playerPosition).add(this._tmpVec);

            this._tmpVec2.copy(playerDirection).multiplyScalar(CONFIG.CAMERA.LOOK_AHEAD);
            target.lookAt.copy(playerPosition).add(this._tmpVec2);
        } else if (mode === 'FIRST_PERSON') {
            if (lockToNose) {
                target.position.copy(firstPersonAnchor);
                if (noseClearance !== 0) {
                    target.position.addScaledVector(playerDirection, noseClearance);
                }
                this._tmpVec2.copy(playerDirection).multiplyScalar(20);
                target.lookAt.copy(target.position).add(this._tmpVec2);
            } else {
                this._tmpVec.copy(playerDirection).multiplyScalar(firstPersonOffset);
                target.position.copy(playerPosition).add(this._tmpVec);
                this._resolveCameraCollision(playerPosition, target.position, arena);

                this._tmpVec2.copy(playerDirection).multiplyScalar(20);
                target.lookAt.copy(playerPosition).add(this._tmpVec2);
            }
        } else if (mode === 'TOP_DOWN') {
            target.position.set(playerPosition.x, playerPosition.y + 40, playerPosition.z + 5);
            target.lookAt.copy(playerPosition);
        }
        if (hasShake) {
            target.position.add(shakeOffset);
            target.lookAt.addScaledVector(shakeOffset, 0.35);
        }

        if (firstPersonHardLock) {
            cam.position.copy(target.position);
            cam.lookAt(target.lookAt);
            return;
        }

        const smoothFactor = 1 - Math.pow(1 - smooth, dt * 60);
        cam.position.lerp(target.position, smoothFactor);

        cam.getWorldDirection(this._tmpLookAt);
        this._tmpLookAt.multiplyScalar(10).add(cam.position);
        this._tmpLookAt.lerp(target.lookAt, smoothFactor);
        cam.lookAt(this._tmpLookAt);
    }

    _resolveCameraCollision(origin, desiredPosition, arena) {
        if (!arena || typeof arena.checkCollision !== 'function') return;

        const radius = Math.max(0.05, CONFIG.CAMERA.COLLISION_RADIUS || 0.45);
        if (!arena.checkCollision(desiredPosition, radius)) return;

        this._tmpCamDir.copy(desiredPosition).sub(origin);
        if (this._tmpCamDir.lengthSq() < 0.000001) return;

        let min = 0;
        let max = 1;
        let safe = 0;
        const steps = Math.max(4, Math.floor(CONFIG.CAMERA.COLLISION_STEPS || 8));
        for (let i = 0; i < steps; i++) {
            const t = (min + max) * 0.5;
            this._tmpCamProbe.copy(origin).addScaledVector(this._tmpCamDir, t);
            if (arena.checkCollision(this._tmpCamProbe, radius)) {
                max = t;
            } else {
                safe = t;
                min = t;
            }
        }

        const backoff = Math.max(0, CONFIG.CAMERA.COLLISION_BACKOFF || 0.04);
        const finalT = Math.max(0, safe - backoff);
        desiredPosition.copy(origin).addScaledVector(this._tmpCamDir, finalT);
    }

    resetCameras() {
        this.cameras.length = 0;
        this.cameraTargets.length = 0;
        this.cameraModes.length = 0;
        this.cameraBoostBlend.length = 0;
        this.cameraShakeTimers.length = 0;
        this.cameraShakeDurations.length = 0;
        this.cameraShakeIntensities.length = 0;
    }
}
