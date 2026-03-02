import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { isRocketTierType } from './RocketPickupSystem.js';
import { RuleBasedBotPolicy } from '../entities/ai/RuleBasedBotPolicy.js';
import { BOT_POLICY_TYPES } from '../entities/ai/BotPolicyTypes.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function resolveHealthRatio(player) {
    if (!player) return 1;
    const hp = Math.max(0, Number(player.hp) || 0);
    const maxHp = Math.max(1, Number(player.maxHp) || 1);
    return clamp(hp / maxHp, 0, 1);
}

function getNearestEnemy(player, allPlayers, outVec) {
    let nearest = null;
    let nearestDistSq = Infinity;
    for (const other of allPlayers || []) {
        if (!other || other === player || !other.alive) continue;
        outVec.subVectors(other.position, player.position);
        const distSq = outVec.lengthSq();
        if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearest = other;
        }
    }
    return { enemy: nearest, distSq: nearestDistSq };
}

function findStrongestRocketIndex(inventory = []) {
    let strongestIndex = -1;
    let strongestRank = -1;
    for (let i = 0; i < inventory.length; i++) {
        const type = inventory[i];
        if (!isRocketTierType(type)) continue;
        const rank = type === 'ROCKET_STRONG' ? 3 : (type === 'ROCKET_MEDIUM' ? 2 : 1);
        if (rank > strongestRank) {
            strongestRank = rank;
            strongestIndex = i;
        }
    }
    return strongestIndex;
}

export class HuntBotPolicy {
    constructor(options = {}) {
        this.type = BOT_POLICY_TYPES.HUNT;
        this._fallbackPolicy = new RuleBasedBotPolicy(options);
        this._tmpToEnemy = new THREE.Vector3();
        this._tmpForward = new THREE.Vector3();
        this._tmpRight = new THREE.Vector3();
        this._tmpUp = new THREE.Vector3();
    }

    update(dt, player, arena, allPlayers, projectiles) {
        const input = this._fallbackPolicy.update(dt, player, arena, allPlayers, projectiles);
        if (!player || !player.alive) return input;

        const { enemy, distSq } = getNearestEnemy(player, allPlayers, this._tmpToEnemy);
        const healthRatio = resolveHealthRatio(player);
        const enemyHealthRatio = resolveHealthRatio(enemy);
        const aggression = clamp(0.55 + (healthRatio - enemyHealthRatio) * 0.8, 0.15, 1.0);
        const mgRange = Math.max(12, Number(CONFIG?.HUNT?.MG?.RANGE || 95));
        const mgRangeSq = mgRange * mgRange;
        input.shootMG = false;

        if (enemy && distSq <= mgRangeSq && healthRatio > 0.15 && aggression >= 0.45) {
            input.shootMG = true;
        }

        const rocketIndex = findStrongestRocketIndex(player.inventory);
        if (rocketIndex >= 0 && enemy) {
            const shouldUseRocket = healthRatio < 0.55 || enemyHealthRatio > 0.45 || distSq > 20 * 20;
            if (shouldUseRocket) {
                input.shootItem = true;
                input.shootItemIndex = rocketIndex;
            }
        }

        if (healthRatio <= 0.33 && enemy) {
            this._tmpToEnemy.subVectors(enemy.position, player.position).normalize();
            player.getDirection(this._tmpForward).normalize();
            this._tmpRight.crossVectors(WORLD_UP, this._tmpForward);
            if (this._tmpRight.lengthSq() <= 0.000001) {
                this._tmpRight.set(1, 0, 0);
            } else {
                this._tmpRight.normalize();
            }
            this._tmpUp.crossVectors(this._tmpForward, this._tmpRight).normalize();

            const yawTowardEnemy = this._tmpRight.dot(this._tmpToEnemy);
            if (Math.abs(yawTowardEnemy) > 0.03) {
                input.yawLeft = yawTowardEnemy > 0;
                input.yawRight = yawTowardEnemy < 0;
            }

            if (!CONFIG.GAMEPLAY.PLANAR_MODE) {
                const pitchTowardEnemy = this._tmpUp.dot(this._tmpToEnemy);
                if (Math.abs(pitchTowardEnemy) > 0.07) {
                    input.pitchUp = pitchTowardEnemy < 0;
                    input.pitchDown = pitchTowardEnemy > 0;
                }
            }

            input.boost = true;
            if (rocketIndex < 0) {
                input.shootItem = false;
                input.shootItemIndex = -1;
            }
        }

        return input;
    }

    setDifficulty(profileName) {
        if (typeof this._fallbackPolicy.setDifficulty === 'function') {
            this._fallbackPolicy.setDifficulty(profileName);
        }
    }

    onBounce(type, normal = null) {
        if (typeof this._fallbackPolicy.onBounce === 'function') {
            this._fallbackPolicy.onBounce(type, normal);
        }
    }

    setSensePhase(phase) {
        if (typeof this._fallbackPolicy.setSensePhase === 'function') {
            this._fallbackPolicy.setSensePhase(phase);
        }
    }
}
