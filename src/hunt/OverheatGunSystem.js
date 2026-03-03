import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { isHuntHealthActive } from './HealthSystem.js';

function getMgConfig() {
    return CONFIG?.HUNT?.MG || {};
}

const MG_TRAIL_SELF_SKIP_RECENT = 8;
const MG_TRAIL_SAMPLE_STEP = 0.7;
const MG_TRAIL_HIT_RADIUS = 0.45;
const MG_TRACER_UP_AXIS = new THREE.Vector3(0, 1, 0);
const MG_TRACER_UNIT_CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 8);
const MG_TRACER_UNIT_SPHERE = new THREE.SphereGeometry(1, 10, 10);
const MG_TRACER_DEFAULT_BEAM_RADIUS = 0.16;
const MG_TRACER_DEFAULT_BULLET_RADIUS = 0.42;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function clearObject(target) {
    for (const key of Object.keys(target || {})) {
        delete target[key];
    }
}

export class OverheatGunSystem {
    constructor(entityManager) {
        this.entityManager = entityManager;
        this._overheatByPlayer = {};
        this._lockoutByPlayer = {};
        this._overheatSnapshot = {};
        this._overheatSnapshotVersion = 0;
        this._overheatSnapshotDirty = true;
        Object.defineProperty(this._overheatSnapshot, '__version', {
            enumerable: false,
            configurable: false,
            get: () => this._overheatSnapshotVersion,
        });
        Object.defineProperty(this._overheatSnapshot, '__dirty', {
            enumerable: false,
            configurable: false,
            get: () => this._overheatSnapshotDirty,
        });
        this._tracers = [];
        this._tmpAim = new THREE.Vector3();
        this._tmpToTarget = new THREE.Vector3();
        this._tmpHit = new THREE.Vector3();
        this._tmpMuzzle = new THREE.Vector3();
        this._tmpTracerEnd = new THREE.Vector3();
        this._tmpTrailProbe = new THREE.Vector3();
        this._tmpTracerDir = new THREE.Vector3();
        this._tmpTracerMid = new THREE.Vector3();
    }

    reset() {
        clearObject(this._overheatByPlayer);
        clearObject(this._lockoutByPlayer);
        clearObject(this._overheatSnapshot);
        this._markOverheatSnapshotDirty();
        this._clearTracers();
    }

    update(dt) {
        const mg = getMgConfig();
        const coolPerSecond = Math.max(0, Number(mg.COOLING_PER_SECOND || 22));
        const players = this.entityManager?.players || [];
        for (const player of players) {
            const idx = player.index;
            const currentHeat = Math.max(0, Number(this._overheatByPlayer[idx] || 0));
            this._setOverheatValue(idx, clamp(currentHeat - coolPerSecond * dt, 0, 100));
            this._lockoutByPlayer[idx] = Math.max(0, Number(this._lockoutByPlayer[idx] || 0) - dt);
        }
        this._updateTracers(dt);
    }

    getOverheatValue(playerIndex) {
        return Math.max(0, Number(this._overheatByPlayer[playerIndex] || 0));
    }

    getOverheatSnapshot() {
        return this._overheatSnapshot;
    }

    getOverheatSnapshotVersion() {
        return this._overheatSnapshotVersion;
    }

    isOverheatSnapshotDirty() {
        return this._overheatSnapshotDirty;
    }

    markOverheatSnapshotClean() {
        this._overheatSnapshotDirty = false;
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
        player.getAimDirection(this._tmpAim).normalize();
        this._tmpMuzzle.copy(player.position).addScaledVector(this._tmpAim, 2.1);
        this._tmpTracerEnd.copy(this._tmpMuzzle).addScaledVector(this._tmpAim, Math.max(10, Number(mg.RANGE || 95)));
        if (hitResult.point) {
            this._tmpTracerEnd.set(hitResult.point.x, hitResult.point.y, hitResult.point.z);
        }
        this._spawnTracer(this._tmpMuzzle, this._tmpTracerEnd, !!(hitResult.target || hitResult.trail), mg);
        if (hitResult.target) {
            this._applyHit(player, hitResult.target, hitResult.distance, mg);
        } else if (hitResult.trail) {
            this._applyTrailHit(player, hitResult.trail, mg);
        }

        if (this.entityManager?.audio) {
            this.entityManager.audio.play('SHOOT');
        }

        return {
            ok: true,
            type: 'MG_BULLET',
            hit: !!hitResult.target,
            trailHit: !!hitResult.trail,
            overheat: this.getOverheatValue(idx),
        };
    }

    _increaseOverheat(playerIndex, mg) {
        const perShot = Math.max(0, Number(mg.OVERHEAT_PER_SHOT || 6.5));
        const threshold = Math.max(1, Number(mg.LOCKOUT_THRESHOLD || 100));
        const lockoutSeconds = Math.max(0.1, Number(mg.LOCKOUT_SECONDS || 1.2));
        const nextHeat = clamp(this.getOverheatValue(playerIndex) + perShot, 0, 100);
        this._setOverheatValue(playerIndex, nextHeat);
        if (nextHeat >= threshold) {
            this._lockoutByPlayer[playerIndex] = lockoutSeconds;
        }
    }

    _setOverheatValue(playerIndex, nextValue) {
        const key = String(playerIndex);
        const normalized = clamp(Math.max(0, Number(nextValue || 0)), 0, 100);
        const hasCurrent = Object.prototype.hasOwnProperty.call(this._overheatByPlayer, key);
        const current = hasCurrent ? Math.max(0, Number(this._overheatByPlayer[key] || 0)) : 0;
        if (hasCurrent && current === normalized) {
            return current;
        }
        this._overheatByPlayer[key] = normalized;
        this._overheatSnapshot[key] = normalized;
        this._markOverheatSnapshotDirty();
        return normalized;
    }

    _markOverheatSnapshotDirty() {
        this._overheatSnapshotVersion += 1;
        this._overheatSnapshotDirty = true;
    }

    _resolveHit(player, mg) {
        const players = this.entityManager?.players || [];
        const maxRange = Math.max(10, Number(mg.RANGE || 95));
        player.getAimDirection(this._tmpAim).normalize();
        this._tmpMuzzle.copy(player.position).addScaledVector(this._tmpAim, 2.1);

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

    _resolveTrailHit(player, mg, maxRange) {
        const trailSpatialIndex = this.entityManager?.getTrailSpatialIndex?.() || this.entityManager?._trailSpatialIndex;
        if (!trailSpatialIndex?.checkProjectileTrailCollision) return null;

        const selfSkipRecent = Math.max(0, Math.floor(Number(mg.TRAIL_SELF_SKIP_RECENT) || MG_TRAIL_SELF_SKIP_RECENT));
        const sampleStep = Math.max(0.2, Number(mg.TRAIL_SAMPLE_STEP) || MG_TRAIL_SAMPLE_STEP);
        const probeRadius = Math.max(0.12, Number(mg.TRAIL_HIT_RADIUS) || MG_TRAIL_HIT_RADIUS);

        player.getAimDirection(this._tmpAim).normalize();
        this._tmpMuzzle.copy(player.position).addScaledVector(this._tmpAim, 2.1);
        for (let distance = 0; distance <= maxRange; distance += sampleStep) {
            this._tmpTrailProbe.copy(this._tmpMuzzle).addScaledVector(this._tmpAim, distance);
            const hit = trailSpatialIndex.checkProjectileTrailCollision(this._tmpTrailProbe, probeRadius, {
                excludePlayerIndex: player.index,
                skipRecent: selfSkipRecent,
            });
            if (!hit?.entry) continue;

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

        return null;
    }

    _applyTrailHit(attacker, trailHit, mg) {
        const trailSpatialIndex = this.entityManager?.getTrailSpatialIndex?.() || this.entityManager?._trailSpatialIndex;
        if (!trailSpatialIndex?.damageTrailSegment || !trailHit?.entry) return;

        const entry = trailHit.entry;
        const fallbackDamage = Math.max(1, Number(entry.maxHp) || Number(entry.hp) || 1);
        const configuredDamage = Number(mg.TRAIL_DAMAGE);
        const damage = Number.isFinite(configuredDamage) && configuredDamage > 0 ? configuredDamage : fallbackDamage;
        const damageResult = trailSpatialIndex.damageTrailSegment(entry, damage);
        if (!damageResult?.hit) return;

        if (this.entityManager?.particles && trailHit.point) {
            this._tmpHit.set(trailHit.point.x, trailHit.point.y, trailHit.point.z);
            const color = damageResult.destroyed ? 0x66ddff : 0x3388ff;
            this.entityManager.particles.spawnHit(this._tmpHit, color);
        }
        if (this.entityManager?.audio && !attacker?.isBot) {
            this.entityManager.audio.play('HIT');
        }
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
            this.entityManager._killPlayer(target, 'PROJECTILE', { killer: attacker });
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

    _spawnTracer(start, end, hit = false, mg = null) {
        const renderer = this.entityManager?.renderer;
        if (!renderer?.addToScene) return;

        this._tmpTracerDir.subVectors(end, start);
        const length = this._tmpTracerDir.length();
        if (!Number.isFinite(length) || length <= 0.001) return;
        this._tmpTracerDir.divideScalar(length);

        const beamRadius = Math.max(0.02, Number(mg?.TRACER_BEAM_RADIUS) || MG_TRACER_DEFAULT_BEAM_RADIUS);
        const bulletRadius = Math.max(0.04, Number(mg?.TRACER_BULLET_RADIUS) || MG_TRACER_DEFAULT_BULLET_RADIUS);
        const tracerColor = hit ? 0xffe38a : 0x8ad5ff;

        const beamMaterial = new THREE.MeshBasicMaterial({
            color: tracerColor,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
        });
        const bulletMaterial = new THREE.MeshBasicMaterial({
            color: tracerColor,
            transparent: true,
            opacity: 0.96,
            depthWrite: false,
        });

        const tracerRoot = new THREE.Group();
        tracerRoot.renderOrder = 210;
        tracerRoot.quaternion.setFromUnitVectors(MG_TRACER_UP_AXIS, this._tmpTracerDir);
        this._tmpTracerMid.addVectors(start, end).multiplyScalar(0.5);
        tracerRoot.position.copy(this._tmpTracerMid);

        const beam = new THREE.Mesh(MG_TRACER_UNIT_CYLINDER, beamMaterial);
        beam.scale.set(beamRadius, length, beamRadius);
        tracerRoot.add(beam);

        const bullet = new THREE.Mesh(MG_TRACER_UNIT_SPHERE, bulletMaterial);
        bullet.position.y = length * 0.5;
        bullet.scale.setScalar(bulletRadius);
        tracerRoot.add(bullet);

        renderer.addToScene(tracerRoot);

        const maxTtl = hit ? 0.11 : 0.08;
        this._tracers.push({
            mesh: tracerRoot,
            ttl: maxTtl,
            maxTtl,
            materials: [beamMaterial, bulletMaterial],
        });
    }

    _updateTracers(dt) {
        if (!Array.isArray(this._tracers) || this._tracers.length === 0) return;
        const renderer = this.entityManager?.renderer;
        for (let i = this._tracers.length - 1; i >= 0; i--) {
            const tracer = this._tracers[i];
            if (!tracer?.mesh) {
                this._tracers.splice(i, 1);
                continue;
            }
            tracer.ttl -= Math.max(0, dt);
            const fade = clamp(tracer.ttl / Math.max(0.001, tracer.maxTtl), 0, 1);
            if (Array.isArray(tracer.materials)) {
                const opacity = fade * 0.92;
                for (const material of tracer.materials) {
                    if (material) material.opacity = opacity;
                }
            } else if (tracer.mesh.material) {
                tracer.mesh.material.opacity = fade * 0.92;
            }
            if (tracer.ttl > 0) continue;

            if (renderer?.removeFromScene) {
                renderer.removeFromScene(tracer.mesh);
            } else if (tracer.mesh.parent) {
                tracer.mesh.parent.remove(tracer.mesh);
            }
            if (Array.isArray(tracer.materials)) {
                for (const material of tracer.materials) {
                    material?.dispose?.();
                }
            } else {
                tracer.mesh.material?.dispose?.();
            }
            this._tracers.splice(i, 1);
        }
    }

    _clearTracers() {
        if (!Array.isArray(this._tracers) || this._tracers.length === 0) return;
        const renderer = this.entityManager?.renderer;
        for (const tracer of this._tracers) {
            const mesh = tracer?.mesh;
            if (!mesh) continue;
            if (renderer?.removeFromScene) {
                renderer.removeFromScene(mesh);
            } else if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
            if (Array.isArray(tracer.materials)) {
                for (const material of tracer.materials) {
                    material?.dispose?.();
                }
            } else {
                mesh.material?.dispose?.();
            }
        }
        this._tracers.length = 0;
    }
}
