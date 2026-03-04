import { resolveCollisionDamage } from '../../../hunt/HealthSystem.js';

export class PlayerCollisionPhase {
    constructor(entityManager) {
        this.entityManager = entityManager;
    }

    run(player, prevPos, huntModeActive) {
        const entityManager = this.entityManager;
        const spawnProtected = (player.spawnProtectionTimer || 0) > 0;
        if (player.isGhost || spawnProtected) {
            return false;
        }

        const hRadius = player.hitboxRadius;
        let arenaCollision = this._probeArenaCollision(player.position, 0.4);
        let bouncedOnFoam = false;

        if (!arenaCollision) {
            player.getAimDirection(entityManager._tmpDir).multiplyScalar(4).add(player.position);
            arenaCollision = this._probeArenaCollision(entityManager._tmpDir, 0.4);
        }

        if (!arenaCollision) {
            player.getDirection(entityManager._tmpVec).multiplyScalar(-1.5).add(player.position);
            arenaCollision = this._probeArenaCollision(entityManager._tmpVec, 0.4);
        }

        if (!arenaCollision) {
            entityManager._tmpVec.set(0, 1, 0).applyQuaternion(player.quaternion);
            entityManager._tmpDir.crossVectors(entityManager._tmpVec, player.getDirection(entityManager._tmpVec2)).normalize();

            entityManager._tmpVec2.copy(entityManager._tmpDir).multiplyScalar(2).add(player.position);
            arenaCollision = this._probeArenaCollision(entityManager._tmpVec2, 0.4);

            if (!arenaCollision) {
                entityManager._tmpVec2.copy(entityManager._tmpDir).multiplyScalar(-2).add(player.position);
                arenaCollision = this._probeArenaCollision(entityManager._tmpVec2, 0.4);
            }
        }

        if (arenaCollision?.hit) {
            const hitKind = String(arenaCollision.kind || 'wall').toLowerCase();
            if (hitKind === 'foam') {
                if (entityManager.audio) entityManager.audio.play('HIT');
                if (entityManager.particles) entityManager.particles.spawnHit(player.position, 0x34d399);
                entityManager._bouncePlayerOnFoam(player, arenaCollision.normal || null);
                bouncedOnFoam = true;
            } else {
                if (entityManager.audio) entityManager.audio.play('HIT');
                if (entityManager.particles) entityManager.particles.spawnHit(player.position, player.color);
                if (huntModeActive) {
                    const wallDamage = resolveCollisionDamage('WALL');
                    const damageResult = player.takeDamage(wallDamage);
                    entityManager._emitHuntDamageEvent({
                        target: player,
                        sourcePlayer: null,
                        cause: 'WALL',
                        hitNormal: arenaCollision.normal || null,
                        damageResult,
                    });
                    if (damageResult.isDead) {
                        entityManager._killPlayer(player, 'WALL');
                        return true;
                    }
                } else if (player.hasShield) {
                    player.hasShield = false;
                    player.getDirection(entityManager._tmpDir).multiplyScalar(2.2);
                    player.position.sub(entityManager._tmpDir);
                } else {
                    entityManager._killPlayer(player, 'WALL');
                    return true;
                }
            }
        }

        if (!bouncedOnFoam) {
            const selfTrailSkipRecent = entityManager.constructor.deriveSelfTrailSkipRecentSegments(player);
            const collision = this._resolveTrailCollision(player, prevPos, hRadius * 2.0, selfTrailSkipRecent);
            if (collision?.hit) {
                const trailCause = collision.playerIndex === player.index ? 'TRAIL_SELF' : 'TRAIL_OTHER';
                if (huntModeActive) {
                    if (entityManager.audio) entityManager.audio.play('HIT');
                    if (entityManager.particles) entityManager.particles.spawnHit(player.position, player.color);
                    const damageResult = player.takeDamage(resolveCollisionDamage('TRAIL'));
                    const sourcePlayer = collision.playerIndex >= 0 && collision.playerIndex !== player.index
                        ? entityManager.players[collision.playerIndex]
                        : null;
                    entityManager._emitHuntDamageEvent({
                        target: player,
                        sourcePlayer,
                        cause: trailCause,
                        damageResult,
                    });
                    if (damageResult.isDead) {
                        entityManager._killPlayer(player, trailCause, { killer: sourcePlayer || null });
                        return true;
                    }
                } else if (player.hasShield) {
                    player.hasShield = false;
                } else {
                    if (entityManager.audio) entityManager.audio.play('HIT');
                    if (entityManager.particles) entityManager.particles.spawnHit(player.position, player.color);
                    entityManager._killPlayer(player, trailCause);
                    return true;
                }
            }
        }

        return false;
    }

    _probeArenaCollision(point, probeRadius = 0.4) {
        const entityManager = this.entityManager;
        if (typeof entityManager.arena.getCollisionInfo === 'function') {
            const info = entityManager.arena.getCollisionInfo(point, probeRadius);
            return info?.hit ? info : null;
        }
        if (entityManager.arena.checkCollision(point, probeRadius)) {
            return entityManager._fallbackArenaCollision;
        }
        return null;
    }

    _resolveTrailCollision(player, prevPos, radius, selfTrailSkipRecent) {
        const entityManager = this.entityManager;
        const directHit = entityManager.checkGlobalCollision(
            player.position,
            radius,
            player.index,
            selfTrailSkipRecent,
            player
        );
        if (directHit?.hit) {
            return directHit;
        }

        entityManager._tmpVec.subVectors(player.position, prevPos);
        const traveledDistance = entityManager._tmpVec.length();
        const minSweepDistance = Math.max(0.45, radius * 0.35);
        if (!Number.isFinite(traveledDistance) || traveledDistance <= minSweepDistance) {
            return null;
        }

        const stepDistance = Math.max(0.5, radius * 0.75);
        const steps = Math.min(12, Math.max(2, Math.ceil(traveledDistance / stepDistance)));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            entityManager._tmpVec2.lerpVectors(prevPos, player.position, t);
            const sweptHit = entityManager.checkGlobalCollision(
                entityManager._tmpVec2,
                radius,
                player.index,
                selfTrailSkipRecent,
                null
            );
            if (sweptHit?.hit) {
                return sweptHit;
            }
        }

        return null;
    }
}
