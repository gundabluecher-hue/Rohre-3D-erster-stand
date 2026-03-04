import * as THREE from 'three';
import { CONFIG } from '../../core/Config.js';

const MG_TRAIL_SELF_SKIP_RECENT = 8;
const MG_TRAIL_SAMPLE_STEP = 0.7;
const MG_TRAIL_HIT_RADIUS = 0.45;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export class MGHitResolver {
    constructor(runtimeContext) {
        this.runtime = runtimeContext || null;
        this._tmpAim = new THREE.Vector3();
        this._tmpToTarget = new THREE.Vector3();
        this._tmpHit = new THREE.Vector3();
        this._tmpMuzzle = new THREE.Vector3();
        this._tmpTrailProbe = new THREE.Vector3();
    }

    resolveHit(player, mg, outMuzzle = null, outAim = null) {
        const players = this.runtime?.players || [];
        const maxRange = Math.max(10, Number(mg.RANGE || 95));
        this.resolveAimDirection(player, this._tmpAim);
        this._tmpMuzzle.copy(player.position).addScaledVector(this._tmpAim, 2.1);
        if (outMuzzle) outMuzzle.copy(this._tmpMuzzle);
        if (outAim) outAim.copy(this._tmpAim);

        let bestTarget = null;
        let bestDistance = Infinity;
        let bestPoint = null;
        for (const target of players) {
            if (!target || !target.alive || target === player) continue;

            const hitboxRadius = Math.max(
                0.2,
                Number(target.hitboxRadius) || Number(CONFIG?.PLAYER?.HITBOX_RADIUS) || 0.8
            );
            const hitboxRadiusSq = hitboxRadius * hitboxRadius;

            this._tmpToTarget.subVectors(target.position, this._tmpMuzzle);
            const forwardDistance = this._tmpAim.dot(this._tmpToTarget);
            if (forwardDistance < -hitboxRadius || forwardDistance > maxRange + hitboxRadius) continue;

            const toTargetLenSq = this._tmpToTarget.lengthSq();
            const closestDistanceSq = Math.max(0, toTargetLenSq - forwardDistance * forwardDistance);
            if (closestDistanceSq > hitboxRadiusSq) continue;

            const intersectionOffset = Math.sqrt(Math.max(0, hitboxRadiusSq - closestDistanceSq));
            const entryDistance = Math.max(0, forwardDistance - intersectionOffset);
            if (entryDistance > maxRange) continue;

            if (entryDistance < bestDistance) {
                bestDistance = entryDistance;
                bestTarget = target;
                this._tmpHit.copy(this._tmpMuzzle).addScaledVector(this._tmpAim, entryDistance);
                bestPoint = {
                    x: this._tmpHit.x,
                    y: this._tmpHit.y,
                    z: this._tmpHit.z,
                };
            }
        }

        const trailHit = this._resolveTrailHit(player, mg, Math.min(maxRange, bestDistance));
        if (trailHit && trailHit.distance <= bestDistance) {
            return {
                target: null,
                distance: trailHit.distance,
                trail: trailHit,
                point: trailHit.point,
            };
        }

        if (bestTarget) {
            return {
                target: bestTarget,
                distance: bestDistance,
                trail: null,
                point: bestPoint || {
                    x: bestTarget.position.x,
                    y: bestTarget.position.y,
                    z: bestTarget.position.z,
                },
            };
        }

        if (trailHit) {
            return {
                target: null,
                distance: trailHit.distance,
                trail: trailHit,
                point: trailHit.point,
            };
        }

        return { target: null, distance: Infinity, trail: null, point: null };
    }

    resolveAimDirection(player, out) {
        return player.getAimDirection(out).normalize();
    }

    _resolveTrailHit(player, mg, maxRange) {
        const trailSpatialIndex = this.runtime?.getTrailSpatialIndex?.() || this.runtime?.trails?.spatialIndex;
        if (!trailSpatialIndex?.checkProjectileTrailCollision) return null;

        const selfSkipRecent = Math.max(0, Math.floor(Number(mg.TRAIL_SELF_SKIP_RECENT) || MG_TRAIL_SELF_SKIP_RECENT));
        const skipSelfCompletely = Math.max(
            selfSkipRecent + 1,
            Math.floor(Number(player?.trail?.maxSegments) || 0)
        );
        const sampleStep = Math.max(0.2, Number(mg.TRAIL_SAMPLE_STEP) || MG_TRAIL_SAMPLE_STEP);
        const probeRadius = Math.max(0.12, Number(mg.TRAIL_HIT_RADIUS) || MG_TRAIL_HIT_RADIUS);
        let fallbackSelfHit = null;

        this.resolveAimDirection(player, this._tmpAim);
        this._tmpMuzzle.copy(player.position).addScaledVector(this._tmpAim, 2.1);
        for (let distance = 0; distance <= maxRange; distance += sampleStep) {
            this._tmpTrailProbe.copy(this._tmpMuzzle).addScaledVector(this._tmpAim, distance);
            const enemyHit = trailSpatialIndex.checkProjectileTrailCollision(this._tmpTrailProbe, probeRadius, {
                excludePlayerIndex: player.index,
                skipRecent: skipSelfCompletely,
            });
            if (enemyHit?.entry) {
                return this._createTrailHit(enemyHit);
            }

            const hit = trailSpatialIndex.checkProjectileTrailCollision(this._tmpTrailProbe, probeRadius, {
                excludePlayerIndex: player.index,
                skipRecent: selfSkipRecent,
            });
            if (!hit?.entry) continue;

            if (Number(hit.entry.playerIndex) === player.index) {
                if (!fallbackSelfHit) {
                    fallbackSelfHit = this._createTrailHit(hit);
                }
                continue;
            }

            return this._createTrailHit(hit);
        }

        if (fallbackSelfHit) {
            const denseStep = Math.max(0.12, sampleStep * 0.5);
            if (denseStep < sampleStep) {
                for (let distance = 0; distance <= maxRange; distance += denseStep) {
                    this._tmpTrailProbe.copy(this._tmpMuzzle).addScaledVector(this._tmpAim, distance);
                    const enemyHit = trailSpatialIndex.checkProjectileTrailCollision(this._tmpTrailProbe, probeRadius, {
                        excludePlayerIndex: player.index,
                        skipRecent: skipSelfCompletely,
                    });
                    if (enemyHit?.entry) {
                        return this._createTrailHit(enemyHit);
                    }
                }
            }
        }

        return fallbackSelfHit;
    }

    _createTrailHit(hit) {
        if (!hit?.entry) return null;
        if (hit.closestPoint) {
            this._tmpHit.set(hit.closestPoint.closestX, hit.closestPoint.closestY, hit.closestPoint.closestZ);
        } else {
            this._tmpHit.copy(this._tmpTrailProbe);
        }
        return {
            entry: hit.entry,
            distance: this._tmpMuzzle.distanceTo(this._tmpHit),
            point: {
                x: this._tmpHit.x,
                y: this._tmpHit.y,
                z: this._tmpHit.z,
            },
        };
    }

    applyTrailHit(attacker, trailHit, mg) {
        const trailSpatialIndex = this.runtime?.getTrailSpatialIndex?.() || this.runtime?.trails?.spatialIndex;
        if (!trailSpatialIndex?.damageTrailSegment || !trailHit?.entry) return;

        const entry = trailHit.entry;
        const fallbackDamage = Math.max(1, Number(entry.maxHp) || Number(entry.hp) || 1);
        const configuredDamage = Number(mg.TRAIL_DAMAGE);
        const damage = Number.isFinite(configuredDamage) && configuredDamage > 0 ? configuredDamage : fallbackDamage;
        const damageResult = trailSpatialIndex.damageTrailSegment(entry, damage);
        if (!damageResult?.hit) return;
        const destroyOnHit = mg?.DESTROY_TRAIL_ON_HIT !== false;
        let destroyed = !!damageResult.destroyed;
        if (destroyOnHit && !destroyed && typeof trailSpatialIndex.destroySegment === 'function') {
            destroyed = !!trailSpatialIndex.destroySegment(entry);
        }

        // Sync destroyed flag explicitly for test assertions.
        if (destroyed && entry) {
            entry.destroyed = true;
        }

        if (this.runtime?.services?.particles && trailHit.point) {
            this._tmpHit.set(trailHit.point.x, trailHit.point.y, trailHit.point.z);
            const color = destroyed ? 0x66ddff : 0x3388ff;
            this.runtime.services.particles.spawnHit(this._tmpHit, color);
        }
        if (this.runtime?.services?.audio && !attacker?.isBot) {
            this.runtime.services.audio.play('HIT');
        }
    }

    applyHit(attacker, target, distance, mg) {
        const maxRange = Math.max(10, Number(mg.RANGE || 95));
        const minFalloff = clamp(Number(mg.MIN_FALLOFF || 0.5), 0.2, 1);
        const baseDamage = Math.max(1, Number(mg.DAMAGE || 9));
        const distRatio = clamp(distance / maxRange, 0, 1);
        const damage = baseDamage * (1 - (1 - minFalloff) * distRatio);

        const damageResult = target.takeDamage(damage);
        this.runtime?.events?.emitHuntDamageEvent({
            target,
            sourcePlayer: attacker,
            cause: 'MG_BULLET',
            damageResult,
        });
        this._emitTracerImpact(target);
        if (damageResult.isDead) {
            this.runtime?.lifecycle?.killPlayer?.(target, 'PROJECTILE', { killer: attacker });
            this._pushKillFeed(attacker, target, 'ELIMINATED');
            return;
        }

        this._pushKillFeed(attacker, target, `-${Math.round(damage)} HP`);
    }

    _emitTracerImpact(target) {
        if (this.runtime?.services?.particles) {
            this.runtime.services.particles.spawnHit(target.position, 0xffaa33);
        }
        if (this.runtime?.services?.audio) {
            this.runtime.services.audio.play('HIT');
        }
    }

    _pushKillFeed(attacker, target, suffix) {
        const attackerLabel = attacker.isBot ? `Bot ${attacker.index + 1}` : `P${attacker.index + 1}`;
        const targetLabel = target.isBot ? `Bot ${target.index + 1}` : `P${target.index + 1}`;
        this.runtime?.events?.emitHuntFeed(`${attackerLabel} -> ${targetLabel}: ${suffix}`);
    }
}
