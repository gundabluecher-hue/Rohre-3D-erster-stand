// ============================================
// PlayerLifecycleSystem.js - player tick and lifecycle updates
// ============================================

import { CONFIG } from '../../core/Config.js';
import { isHuntHealthActive, resolveCollisionDamage } from '../../hunt/HealthSystem.js';

export class PlayerLifecycleSystem {
    constructor(entityManager) {
        this.entityManager = entityManager;
    }

    updateShootCooldown(player, dt) {
        player.shootCooldown = Math.max(0, (player.shootCooldown || 0) - dt);
    }

    _probeArenaCollision(entityManager, point, probeRadius = 0.4) {
        if (typeof entityManager.arena.getCollisionInfo === 'function') {
            const info = entityManager.arena.getCollisionInfo(point, probeRadius);
            return info?.hit ? info : null;
        }
        if (entityManager.arena.checkCollision(point, probeRadius)) {
            return entityManager._fallbackArenaCollision;
        }
        return null;
    }

    updatePlayer(player, dt, input) {
        const entityManager = this.entityManager;
        const huntModeActive = isHuntHealthActive();

        if (input.nextItem) player.cycleItem();
        if (input.dropItem) player.dropItem();

        if (input.useItem >= 0) {
            const result = entityManager._useInventoryItem(player, input.useItem);
            if (result.ok) {
                if (entityManager.recorder) entityManager.recorder.logEvent('ITEM_USE', player.index, `mode=use type=${result.type}`);
            } else if (!player.isBot) {
                entityManager._notifyPlayerFeedback(player, result.reason);
            }
        }

        if (input.shootItem) {
            let result = null;
            if (huntModeActive && Number.isInteger(input.shootItemIndex) && input.shootItemIndex >= 0) {
                result = entityManager._shootItemProjectile(player, input.shootItemIndex);
            } else if (huntModeActive) {
                result = entityManager._shootHuntGun(player);
            } else {
                result = entityManager._shootItemProjectile(player, input.shootItemIndex);
            }
            if (!result.ok && !player.isBot) {
                entityManager._notifyPlayerFeedback(player, result.reason);
            } else if (result.ok && entityManager.recorder) {
                entityManager.recorder.logEvent('ITEM_USE', player.index, `mode=shoot type=${result.type}`);
            }
        }

        const prevPos = entityManager._tmpPrevPlayerPosition.copy(player.position);
        player.update(dt, input);

        // Spezial-Gates Check
        const gateResult = entityManager.arena.checkSpecialGates(player.position, prevPos, player.hitboxRadius, player.index);
        if (gateResult) {
            if (gateResult.type === 'boost') {
                player.activateBoostPortal(gateResult.params, gateResult.forward);
                if (entityManager.audio && !player.isBot) entityManager.audio.play('POWERUP');
            } else if (gateResult.type === 'slingshot') {
                player.activateSlingshot(gateResult.params, gateResult.forward, gateResult.up);
                if (entityManager.audio && !player.isBot) entityManager.audio.play('POWERUP');
            }
        }

        const spawnProtected = (player.spawnProtectionTimer || 0) > 0;
        if (!player.isGhost && !spawnProtected) {
            const hRadius = player.hitboxRadius;

            // Praezise Arena-Kollision (Nase, Fluegel, Heck + Zentrum)
            let arenaCollision = this._probeArenaCollision(entityManager, player.position, 0.4);
            let bouncedOnFoam = false;

            if (!arenaCollision) {
                // Punkt 1: Nase
                player.getAimDirection(entityManager._tmpDir).multiplyScalar(4).add(player.position);
                arenaCollision = this._probeArenaCollision(entityManager, entityManager._tmpDir, 0.4);
            }

            if (!arenaCollision) {
                // Punkt 2: Heck
                player.getDirection(entityManager._tmpVec).multiplyScalar(-1.5).add(player.position);
                arenaCollision = this._probeArenaCollision(entityManager, entityManager._tmpVec, 0.4);
            }

            if (!arenaCollision) {
                // Seitliche Fluegel-Punkte
                entityManager._tmpVec.set(0, 1, 0).applyQuaternion(player.group.quaternion); // Up
                entityManager._tmpDir.crossVectors(entityManager._tmpVec, player.getDirection(entityManager._tmpVec2)).normalize(); // Right

                // Rechts
                entityManager._tmpVec2.copy(entityManager._tmpDir).multiplyScalar(2).add(player.position);
                arenaCollision = this._probeArenaCollision(entityManager, entityManager._tmpVec2, 0.4);

                if (!arenaCollision) {
                    // Links
                    entityManager._tmpVec2.copy(entityManager._tmpDir).multiplyScalar(-2).add(player.position);
                    arenaCollision = this._probeArenaCollision(entityManager, entityManager._tmpVec2, 0.4);
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
                            return;
                        }
                    } else if (player.hasShield) {
                        player.hasShield = false;
                        player.getDirection(entityManager._tmpDir).multiplyScalar(2.2);
                        player.position.sub(entityManager._tmpDir);
                    } else {
                        entityManager._killPlayer(player, 'WALL');
                        return;
                    }
                }
            }

            // Global Trail Collision (Nutzt OBB fuer Praezision)
            if (!bouncedOnFoam) {
                const selfTrailSkipRecent = entityManager.constructor.deriveSelfTrailSkipRecentSegments(player);
                const collision = entityManager.checkGlobalCollision(player.position, hRadius * 2.0, player.index, selfTrailSkipRecent, player);
                if (collision && collision.hit) {
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
                            return;
                        }
                    } else if (player.hasShield) {
                        player.hasShield = false;
                    } else {
                        if (entityManager.audio) entityManager.audio.play('HIT');
                        if (entityManager.particles) entityManager.particles.spawnHit(player.position, player.color);
                        entityManager._killPlayer(player, trailCause);
                        return;
                    }
                }
            }
        }

        if (!player.alive) return;

        // Portal-Check
        const portalResult = entityManager.arena.checkPortal(player.position, player.hitboxRadius, player.index);
        if (portalResult) {
            // Spieler auf Zielposition setzen, ABER mit leichtem Offset in Flugrichtung
            player.getAimDirection(entityManager._tmpDir).normalize();
            player.position.copy(portalResult.target).addScaledVector(entityManager._tmpDir, 1.8);

            // Der Portal-Cooldown verhindert sofortigen Re-Teleport.
            if (CONFIG.GAMEPLAY.PLANAR_MODE) player.currentPlanarY = portalResult.target.y;
            player.trail.forceGap(0.5);

            if (entityManager.audio && !player.isBot) entityManager.audio.play('POWERUP'); // Optional: Soundeffekt
        }

        const pickedUp = entityManager.powerupManager.checkPickup(player.position, player.hitboxRadius);
        if (pickedUp) {
            player.addToInventory(pickedUp);
            if (entityManager.audio) entityManager.audio.play('POWERUP');
            if (entityManager.particles) entityManager.particles.spawnHit(player.position, 0x00ff00);
        }
    }
}
