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
    }

    _updateCrosshairPosition(player, crosshairElement) {
        const game = this.game;
        if (!player || !player.alive || !crosshairElement) {
            if (crosshairElement) crosshairElement.style.display = 'none';
            return;
        }

        const camera = game.renderer.cameras[player.index];
        if (!camera) {
            crosshairElement.style.display = 'none';
            return;
        }
        crosshairElement.style.display = 'block';

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

        crosshairElement.style.left = `${x}px`;
        crosshairElement.style.top = `${y}px`;
        crosshairElement.style.transform = `translate(-50%, -50%) rotate(${rollDeg.toFixed(2)}deg)`;
    }

    _syncCrosshairLockState(playerIndex, crosshairElement) {
        if (!crosshairElement) return;
        const lockTarget = this.game.entityManager.getLockOnTarget(playerIndex);
        if (lockTarget) {
            crosshairElement.classList.add('locked');
        } else {
            crosshairElement.classList.remove('locked');
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
                game.ui.crosshairP1.style.display = 'none';
            }
            this._syncCrosshairLockState(0, game.ui.crosshairP1);
        }

        if (game.ui.crosshairP2) {
            if (game.numHumans === 2) {
                if (shouldShowScreenCrosshair(p2)) {
                    this._updateCrosshairPosition(p2, game.ui.crosshairP2);
                } else {
                    game.ui.crosshairP2.style.display = 'none';
                }
                this._syncCrosshairLockState(1, game.ui.crosshairP2);
            } else {
                game.ui.crosshairP2.style.display = 'none';
            }
        }
    }
}
