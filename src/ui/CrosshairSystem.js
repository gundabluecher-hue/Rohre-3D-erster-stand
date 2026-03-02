// ============================================
// CrosshairSystem.js - screen crosshair runtime
// ============================================

import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export class CrosshairSystem {
    constructor(game) {
        this.game = game;
        this._tmpAimVec = new THREE.Vector3();
        this._tmpAimDir = new THREE.Vector3();
        this._tmpRollEuler = new THREE.Euler(0, 0, 0, 'YXZ');
        this._domStateByElement = new WeakMap();
    }

    _getDomState(crosshairElement) {
        let state = this._domStateByElement.get(crosshairElement);
        if (!state) {
            state = {
                display: null,
                left: null,
                top: null,
                transform: null,
                locked: null,
                overheat: null,
            };
            this._domStateByElement.set(crosshairElement, state);
        }
        return state;
    }

    _setCrosshairDisplay(crosshairElement, isVisible) {
        if (!crosshairElement) return;
        const state = this._getDomState(crosshairElement);
        const nextDisplay = isVisible ? 'block' : 'none';
        if (state.display !== nextDisplay) {
            crosshairElement.style.display = nextDisplay;
            state.display = nextDisplay;
        }
    }

    _setCrosshairStyleValue(crosshairElement, key, nextValue) {
        if (!crosshairElement) return;
        const state = this._getDomState(crosshairElement);
        if (state[key] !== nextValue) {
            crosshairElement.style[key] = nextValue;
            state[key] = nextValue;
        }
    }

    _updateCrosshairPosition(player, crosshairElement) {
        const game = this.game;
        if (!player || !player.alive || !crosshairElement) {
            this._setCrosshairDisplay(crosshairElement, false);
            return;
        }

        const camera = game.renderer.cameras[player.index];
        if (!camera) {
            this._setCrosshairDisplay(crosshairElement, false);
            return;
        }
        this._setCrosshairDisplay(crosshairElement, true);

        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const split = game.numHumans === 2;
        const viewportW = split ? screenW * 0.5 : screenW;
        const viewportX = split ? (player.index === 0 ? 0 : viewportW) : 0;

        player.getAimDirection(this._tmpAimDir);
        this._tmpAimVec.copy(player.position).addScaledVector(this._tmpAimDir, 80).project(camera);

        const ndcX = clamp(this._tmpAimVec.x, -1.05, 1.05);
        const ndcY = clamp(this._tmpAimVec.y, -1.05, 1.05);
        const x = viewportX + (ndcX * 0.5 + 0.5) * viewportW;
        const y = (-(ndcY * 0.5) + 0.5) * screenH;

        this._tmpRollEuler.setFromQuaternion(player.quaternion, 'YXZ');
        const rollDeg = THREE.MathUtils.radToDeg(this._tmpRollEuler.z);

        this._setCrosshairStyleValue(crosshairElement, 'left', `${x}px`);
        this._setCrosshairStyleValue(crosshairElement, 'top', `${y}px`);
        this._setCrosshairStyleValue(
            crosshairElement,
            'transform',
            `translate(-50%, -50%) rotate(${rollDeg.toFixed(2)}deg)`,
        );
    }

    _syncCrosshairLockState(playerIndex, crosshairElement) {
        if (!crosshairElement) return;
        const lockTarget = this.game.entityManager.getLockOnTarget(playerIndex);
        const state = this._getDomState(crosshairElement);
        const isLocked = !!lockTarget;
        if (state.locked !== isLocked) {
            crosshairElement.classList.toggle('locked', isLocked);
            state.locked = isLocked;
        }
    }

    _syncCrosshairOverheatState(player, crosshairElement) {
        if (!crosshairElement || !player) return;
        const overheat = Number(this.game?.huntState?.overheatByPlayer?.[player.index] || 0);
        const overheatRatio = clamp(overheat / 100, 0, 1).toFixed(2);
        const state = this._getDomState(crosshairElement);
        if (state.overheat !== overheatRatio) {
            crosshairElement.style.setProperty('--crosshair-overheat', overheatRatio);
            state.overheat = overheatRatio;
        }
    }

    updateCrosshairs() {
        const game = this.game;
        if (!game.entityManager) return;

        const p1 = game.entityManager.players[0];
        const p2 = game.entityManager.players[1];
        const planarMode = !!CONFIG.GAMEPLAY.PLANAR_MODE;
        const shouldShowScreenCrosshair = (player) => {
            if (!player) return false;
            if (planarMode) return true;
            const camMode = CONFIG.CAMERA.MODES[player.cameraMode] || 'THIRD_PERSON';
            return camMode !== 'FIRST_PERSON';
        };

        if (game.ui.crosshairP1) {
            if (shouldShowScreenCrosshair(p1)) {
                this._updateCrosshairPosition(p1, game.ui.crosshairP1);
            } else {
                this._setCrosshairDisplay(game.ui.crosshairP1, false);
            }
            this._syncCrosshairLockState(0, game.ui.crosshairP1);
            this._syncCrosshairOverheatState(p1, game.ui.crosshairP1);
        }

        if (game.ui.crosshairP2) {
            if (game.numHumans === 2) {
                if (shouldShowScreenCrosshair(p2)) {
                    this._updateCrosshairPosition(p2, game.ui.crosshairP2);
                } else {
                    this._setCrosshairDisplay(game.ui.crosshairP2, false);
                }
                this._syncCrosshairLockState(1, game.ui.crosshairP2);
                this._syncCrosshairOverheatState(p2, game.ui.crosshairP2);
            } else {
                this._setCrosshairDisplay(game.ui.crosshairP2, false);
            }
        }
    }
}
