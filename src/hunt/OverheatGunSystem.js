import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { isHuntHealthActive } from './HealthSystem.js';

function getMgConfig() {
    return CONFIG?.HUNT?.MG || {};
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export class OverheatGunSystem {
    constructor(entityManager) {
        this.entityManager = entityManager;
        this._overheatByPlayer = {};
        this._lockoutByPlayer = {};
        this._tmpAim = new THREE.Vector3();
        this._tmpToTarget = new THREE.Vector3();
        this._tmpHit = new THREE.Vector3();
    }

    reset() {
        this._overheatByPlayer = {};
        this._lockoutByPlayer = {};
    }

    update(dt) {
        const mg = getMgConfig();
        const coolPerSecond = Math.max(0, Number(mg.COOLING_PER_SECOND || 22));
        const players = this.entityManager?.players || [];
        for (const player of players) {
            const idx = player.index;
            const currentHeat = Math.max(0, Number(this._overheatByPlayer[idx] || 0));
            this._overheatByPlayer[idx] = clamp(currentHeat - coolPerSecond * dt, 0, 100);
            this._lockoutByPlayer[idx] = Math.max(0, Number(this._lockoutByPlayer[idx] || 0) - dt);
        }
    }

    getOverheatValue(playerIndex) {
        return Math.max(0, Number(this._overheatByPlayer[playerIndex] || 0));
    }

    getOverheatSnapshot() {
        const snapshot = {};
        for (const [key, value] of Object.entries(this._overheatByPlayer)) {
            snapshot[key] = Math.max(0, Number(value || 0));
        }
        return snapshot;
    }

    tryFire(player) {
        if (!player || !player.alive) {
            return { ok: false, reason: 'Spieler inaktiv', type: 'MG_BULLET' };
        }
        if (!isHuntHealthActive()) {
            return { ok: false, reason: 'Hunt-Modus inaktiv', type: 'MG_BULLET' };
        }

        const mg = getMgConfig();
        const shotCooldown = Math.max(0.01, Number(mg.COOLDOWN || 0.08));
        if ((player.shootCooldown || 0) > 0) {
            return { ok: false, reason: `Schuss bereit in ${player.shootCooldown.toFixed(1)}s`, type: 'MG_BULLET' };
        }

        const idx = player.index;
        const lockout = Math.max(0, Number(this._lockoutByPlayer[idx] || 0));
        if (lockout > 0) {
            return { ok: false, reason: `MG ueberhitzt (${lockout.toFixed(1)}s)`, type: 'MG_BULLET' };
        }

        player.shootCooldown = shotCooldown;
        this._increaseOverheat(idx, mg);

        const hitResult = this._resolveHit(player, mg);
        if (hitResult.target) {
            this._applyHit(player, hitResult.target, hitResult.distance, mg);
        }

        if (this.entityManager?.audio) {
            this.entityManager.audio.play('SHOOT');
        }

        return {
            ok: true,
            type: 'MG_BULLET',
            hit: !!hitResult.target,
            overheat: this.getOverheatValue(idx),
        };
    }

    _increaseOverheat(playerIndex, mg) {
        const perShot = Math.max(0, Number(mg.OVERHEAT_PER_SHOT || 6.5));
        const threshold = Math.max(1, Number(mg.LOCKOUT_THRESHOLD || 100));
        const lockoutSeconds = Math.max(0.1, Number(mg.LOCKOUT_SECONDS || 1.2));
        const nextHeat = clamp(this.getOverheatValue(playerIndex) + perShot, 0, 100);
        this._overheatByPlayer[playerIndex] = nextHeat;
        if (nextHeat >= threshold) {
            this._lockoutByPlayer[playerIndex] = lockoutSeconds;
        }
    }

    _resolveHit(player, mg) {
        const players = this.entityManager?.players || [];
        const maxRange = Math.max(10, Number(mg.RANGE || 95));
        const minDot = clamp(Number(mg.AIM_DOT_MIN || 0.965), 0.7, 0.999);
        player.getAimDirection(this._tmpAim).normalize();

        let bestTarget = null;
        let bestDistance = Infinity;
        for (const target of players) {
            if (!target || !target.alive || target === player) continue;

            this._tmpToTarget.subVectors(target.position, player.position);
            const distance = this._tmpToTarget.length();
            if (distance <= 0.1 || distance > maxRange) continue;

            this._tmpToTarget.divideScalar(distance);
            const dot = this._tmpAim.dot(this._tmpToTarget);
            if (dot < minDot) continue;

            if (distance < bestDistance) {
                bestDistance = distance;
                bestTarget = target;
            }
        }

        return { target: bestTarget, distance: bestDistance };
    }

    _applyHit(attacker, target, distance, mg) {
        const maxRange = Math.max(10, Number(mg.RANGE || 95));
        const minFalloff = clamp(Number(mg.MIN_FALLOFF || 0.5), 0.2, 1);
        const baseDamage = Math.max(1, Number(mg.DAMAGE || 9));
        const distRatio = clamp(distance / maxRange, 0, 1);
        const damage = baseDamage * (1 - (1 - minFalloff) * distRatio);

        const damageResult = target.takeDamage(damage);
        if (this.entityManager?._emitHuntDamageEvent) {
            this.entityManager._emitHuntDamageEvent({
                target,
                sourcePlayer: attacker,
                cause: 'MG_BULLET',
                damageResult,
            });
        }
        this._emitTracerImpact(target);
        if (damageResult.isDead) {
            this.entityManager._killPlayer(target, 'PROJECTILE');
            this._pushKillFeed(attacker, target, 'ELIMINATED');
            return;
        }

        this._pushKillFeed(attacker, target, `-${Math.round(damage)} HP`);
    }

    _emitTracerImpact(target) {
        if (this.entityManager?.particles) {
            this.entityManager.particles.spawnHit(target.position, 0xffaa33);
        }
        if (this.entityManager?.audio) {
            this.entityManager.audio.play('HIT');
        }
    }

    _pushKillFeed(attacker, target, suffix) {
        const feed = this.entityManager?.onHuntFeedEvent;
        if (typeof feed !== 'function') return;
        const attackerLabel = attacker.isBot ? `Bot ${attacker.index + 1}` : `P${attacker.index + 1}`;
        const targetLabel = target.isBot ? `Bot ${target.index + 1}` : `P${target.index + 1}`;
        feed(`${attackerLabel} -> ${targetLabel}: ${suffix}`);
    }
}
