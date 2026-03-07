import * as THREE from 'three';
import { CONFIG } from '../Config.js';
import { CameraCollisionSolver } from './camera/CameraCollisionSolver.js';
import { CameraModeStrategySet } from './camera/CameraModeStrategySet.js';
import { CameraShakeSolver } from './camera/CameraShakeSolver.js';
import { CinematicCameraSystem } from '../../entities/systems/CinematicCameraSystem.js';

export class CameraRigSystem {
    constructor({ cinematicEnabled = true } = {}) {
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
        this._tmpShakeOffset = new THREE.Vector3();

        this.collisionSolver = new CameraCollisionSolver();
        this.modeStrategies = new CameraModeStrategySet(this.collisionSolver);
        this.shakeSolver = new CameraShakeSolver(
            this.cameraShakeTimers,
            this.cameraShakeDurations,
            this.cameraShakeIntensities
        );
        this.cinematicCameraSystem = new CinematicCameraSystem({
            enabled: cinematicEnabled,
        });
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
        this.shakeSolver.trigger(playerIndex, this.cameras.length, intensity, duration);
    }

    setCinematicEnabled(enabled) {
        this.cinematicCameraSystem.setEnabled(enabled);
    }

    getCinematicEnabled() {
        return this.cinematicCameraSystem.isEnabled();
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
        const shakeOffset = this.shakeSolver.resolveOffset(playerIndex, dt, this._tmpShakeOffset);
        const hasShake = shakeOffset.x !== 0 || shakeOffset.y !== 0 || shakeOffset.z !== 0;

        if (cockpitCamera && playerQuaternion) {
            if (mode === 'THIRD_PERSON') {
                this.modeStrategies.applyCockpitThirdPerson(target, playerPosition, playerQuaternion, this._tmpVec);
            } else if (mode === 'FIRST_PERSON') {
                this.modeStrategies.applyCockpitFirstPerson({
                    playerIndex,
                    mode,
                    target,
                    playerPosition,
                    playerDirection,
                    playerQuaternion,
                    lockToNose,
                    firstPersonAnchor,
                    noseClearance,
                    firstPersonOffset,
                    arena,
                    tmpVec: this._tmpVec,
                });
            } else if (mode === 'TOP_DOWN') {
                this.modeStrategies.applyCockpitTopDown(target, playerPosition, playerQuaternion, this._tmpVec);
            }

            this.cinematicCameraSystem.apply({
                playerIndex,
                mode,
                target,
                playerDirection,
                playerPosition,
                dt,
                isBoosting,
                cockpitCamera,
            });

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
            this.modeStrategies.applyThirdPerson(target, playerPosition, playerDirection, this._tmpVec, this._tmpVec2);
        } else if (mode === 'FIRST_PERSON') {
            this.modeStrategies.applyFirstPerson({
                playerIndex,
                mode,
                target,
                playerPosition,
                playerDirection,
                lockToNose,
                firstPersonAnchor,
                noseClearance,
                firstPersonOffset,
                arena,
                tmpVec: this._tmpVec,
                tmpVec2: this._tmpVec2,
            });
        } else if (mode === 'TOP_DOWN') {
            this.modeStrategies.applyTopDown(target, playerPosition);
        }

        this.cinematicCameraSystem.apply({
            playerIndex,
            mode,
            target,
            playerDirection,
            playerPosition,
            dt,
            isBoosting,
            cockpitCamera,
        });

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

    resetCameras() {
        this.cameras.length = 0;
        this.cameraTargets.length = 0;
        this.cameraModes.length = 0;
        this.cameraBoostBlend.length = 0;
        this.cameraShakeTimers.length = 0;
        this.cameraShakeDurations.length = 0;
        this.cameraShakeIntensities.length = 0;
        this.collisionSolver.reset();
        this.cinematicCameraSystem.reset();
    }
}
