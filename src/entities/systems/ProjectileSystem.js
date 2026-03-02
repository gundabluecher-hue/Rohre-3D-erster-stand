// ============================================
// ProjectileSystem.js - projectile lifecycle and hit handling
// ============================================

import * as THREE from 'three';
import { CONFIG } from '../../core/Config.js';
import { isHuntHealthActive } from '../../hunt/HealthSystem.js';
import { isRocketTierType, resolveRocketTierDamage } from '../../hunt/RocketPickupSystem.js';
import { applyTrailDamageFromProjectile } from '../../hunt/DestructibleTrail.js';

function getNowMilliseconds() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

function getHuntRocketConfig() {
    return CONFIG?.HUNT?.ROCKET || {};
}

function resolveRocketVisualScale(type, rocketConfig) {
    const normalized = String(type || '').toUpperCase();
    if (normalized === 'ROCKET_STRONG') return Math.max(1, Number(rocketConfig?.VISUAL_SCALE_STRONG || 2.2));
    if (normalized === 'ROCKET_MEDIUM') return Math.max(1, Number(rocketConfig?.VISUAL_SCALE_MEDIUM || 1.95));
    if (normalized === 'ROCKET_WEAK') return Math.max(1, Number(rocketConfig?.VISUAL_SCALE_WEAK || 1.7));
    return 1;
}

export class ProjectileSystem {
    constructor(options = {}) {
        this.renderer = options.renderer || null;
        this.getArena = typeof options.getArena === 'function'
            ? options.getArena
            : (() => options.arena || null);
        this.getPlayers = typeof options.getPlayers === 'function'
            ? options.getPlayers
            : (() => options.players || []);
        this.takeInventoryItem = typeof options.takeInventoryItem === 'function'
            ? options.takeInventoryItem
            : (() => ({ ok: false, reason: 'Kein Item verfuegbar', type: null }));
        this.resolveLockOn = typeof options.resolveLockOn === 'function'
            ? options.resolveLockOn
            : (() => null);
        this.getTrailSpatialIndex = typeof options.getTrailSpatialIndex === 'function'
            ? options.getTrailSpatialIndex
            : (() => options.trailSpatialIndex || null);
        this.onShoot = typeof options.onShoot === 'function' ? options.onShoot : (() => { });
        this.onProjectileHit = typeof options.onProjectileHit === 'function' ? options.onProjectileHit : (() => { });
        this.onProjectilePowerup = typeof options.onProjectilePowerup === 'function' ? options.onProjectilePowerup : (() => { });
        this.onProjectileDamage = typeof options.onProjectileDamage === 'function' ? options.onProjectileDamage : (() => { });
        this.onTrailSegmentHit = typeof options.onTrailSegmentHit === 'function' ? options.onTrailSegmentHit : (() => { });

        this.projectiles = [];
        this._projectileAssets = new Map();
        this._projectilePools = new Map();
        this._projectileStatePool = [];

        this._tmpVec = new THREE.Vector3();
        this._tmpVec2 = new THREE.Vector3();
        this._tmpDir = new THREE.Vector3();
    }

    shootItemProjectile(player, preferredIndex = -1) {
        if ((player.shootCooldown || 0) > 0) {
            return { ok: false, reason: `Schuss bereit in ${player.shootCooldown.toFixed(1)}s` };
        }

        const itemResult = this.takeInventoryItem(player, preferredIndex);
        if (!itemResult.ok) {
            return { ok: false, reason: itemResult.reason, type: null };
        }

        const type = itemResult.type;
        const power = CONFIG.POWERUP.TYPES[type];
        if (!power) {
            return { ok: false, reason: 'Item ungueltig' };
        }
        const huntRocket = isHuntHealthActive() && isRocketTierType(type);
        const huntRocketConfig = getHuntRocketConfig();
        const visualScale = huntRocket ? resolveRocketVisualScale(type, huntRocketConfig) : 1;
        const collisionRadiusMultiplier = huntRocket
            ? Math.max(1, Number(huntRocketConfig.COLLISION_RADIUS_MULTIPLIER || 1.65))
            : 1;
        const baseTurnRate = Math.max(0.1, Number(CONFIG?.HOMING?.TURN_RATE || 3));
        const homingTurnRate = huntRocket
            ? Math.max(baseTurnRate, Number(huntRocketConfig.HOMING_TURN_RATE || 6.2))
            : baseTurnRate;
        const baseLockOnAngle = Math.max(5, Number(CONFIG?.HOMING?.LOCK_ON_ANGLE || 15));
        const homingLockOnAngle = huntRocket
            ? Math.max(baseLockOnAngle, Number(huntRocketConfig.HOMING_LOCK_ON_ANGLE || 32))
            : baseLockOnAngle;
        const baseHomingRange = Math.max(10, Number(CONFIG?.HOMING?.MAX_LOCK_RANGE || 100));
        const homingRange = huntRocket
            ? Math.max(baseHomingRange, Number(huntRocketConfig.HOMING_RANGE || 130))
            : baseHomingRange;
        const homingReacquireInterval = huntRocket
            ? Math.max(0.04, Number(huntRocketConfig.HOMING_REACQUIRE_INTERVAL || 0.12))
            : 0.2;

        player.getAimDirection(this._tmpDir).normalize();
        this._tmpVec.copy(player.position).addScaledVector(this._tmpDir, 2.2);

        const speed = CONFIG.PROJECTILE.SPEED;
        const radius = CONFIG.PROJECTILE.RADIUS;
        const rocketGroup = this._acquireProjectileMesh(type, power.color);
        rocketGroup.scale.setScalar(visualScale);
        rocketGroup.position.copy(this._tmpVec);
        this._tmpVec2.copy(this._tmpVec).add(this._tmpDir);
        rocketGroup.lookAt(this._tmpVec2);

        const projectile = this._acquireProjectileState();
        projectile.mesh = rocketGroup;
        projectile.flame = rocketGroup.userData.flame || null;
        projectile.poolKey = type;
        projectile.owner = player;
        projectile.type = type;
        projectile.huntRocket = huntRocket;
        projectile.visualScale = visualScale;
        projectile.position.copy(this._tmpVec);
        projectile.velocity.copy(this._tmpDir).multiplyScalar(speed);
        projectile.radius = radius * collisionRadiusMultiplier;
        projectile.ttl = CONFIG.PROJECTILE.LIFE_TIME;
        projectile.traveled = 0;
        projectile.homingTurnRate = homingTurnRate;
        projectile.homingLockOnAngle = homingLockOnAngle;
        projectile.homingRange = homingRange;
        projectile.homingReacquireInterval = homingReacquireInterval;
        projectile.homingReacquireTimer = 0;
        projectile.target = this.resolveLockOn(player);
        if (huntRocket && (!projectile.target || !projectile.target.alive)) {
            projectile.target = this._acquireHomingTarget(projectile, this.getPlayers());
        }
        projectile.foamBounces = 0;
        projectile.foamBounceCooldown = 0;
        this.projectiles.push(projectile);

        player.shootCooldown = CONFIG.PROJECTILE.COOLDOWN;
        this.onShoot(player, type, projectile);
        return { ok: true, type };
    }

    _acquireProjectileState() {
        const pooled = this._projectileStatePool.pop();
        if (pooled) {
            return pooled;
        }

        return {
            mesh: null,
            flame: null,
            poolKey: '',
            owner: null,
            type: null,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            radius: 0,
            ttl: 0,
            traveled: 0,
            target: null,
            huntRocket: false,
            visualScale: 1,
            homingTurnRate: 0,
            homingLockOnAngle: 0,
            homingRange: 0,
            homingReacquireInterval: 0,
            homingReacquireTimer: 0,
            foamBounces: 0,
            foamBounceCooldown: 0,
        };
    }

    _releaseProjectileState(projectile) {
        if (!projectile) return;
        projectile.mesh = null;
        projectile.flame = null;
        projectile.poolKey = '';
        projectile.owner = null;
        projectile.type = null;
        projectile.position.set(0, 0, 0);
        projectile.velocity.set(0, 0, 0);
        projectile.radius = 0;
        projectile.ttl = 0;
        projectile.traveled = 0;
        projectile.target = null;
        projectile.huntRocket = false;
        projectile.visualScale = 1;
        projectile.homingTurnRate = 0;
        projectile.homingLockOnAngle = 0;
        projectile.homingRange = 0;
        projectile.homingReacquireInterval = 0;
        projectile.homingReacquireTimer = 0;
        projectile.foamBounces = 0;
        projectile.foamBounceCooldown = 0;
        this._projectileStatePool.push(projectile);
    }

    _acquireProjectileMesh(type, color) {
        const pool = this._getProjectilePool(type);
        let rocketGroup = pool.pop();

        if (!rocketGroup) {
            const assets = this._getProjectileAssets(type, color);
            rocketGroup = new THREE.Group();

            const body = new THREE.Mesh(assets.bodyGeo, assets.bodyMat);
            rocketGroup.add(body);

            const tip = new THREE.Mesh(assets.tipGeo, assets.tipMat);
            tip.position.z = -0.8;
            rocketGroup.add(tip);

            for (let i = 0; i < 4; i++) {
                const fin = new THREE.Mesh(assets.finGeo, assets.finMat);
                fin.position.z = 0.5;
                const angle = (Math.PI / 2) * i;
                if (i % 2 === 0) {
                    fin.position.x = Math.cos(angle) * 0.2;
                } else {
                    fin.position.y = Math.sin(angle) * 0.2;
                    fin.rotation.z = Math.PI / 2;
                }
                rocketGroup.add(fin);
            }

            const flame = new THREE.Mesh(assets.flameGeo, assets.flameMat);
            flame.position.z = 0.85;
            rocketGroup.add(flame);
            rocketGroup.userData.flame = flame;
        }

        rocketGroup.visible = true;
        if (rocketGroup.userData.flame) {
            rocketGroup.userData.flame.scale.set(1, 1, 1);
        }

        if (this.renderer) {
            this.renderer.addToScene(rocketGroup);
        }

        return rocketGroup;
    }

    _getProjectilePool(type) {
        if (!this._projectilePools.has(type)) {
            this._projectilePools.set(type, []);
        }
        return this._projectilePools.get(type);
    }

    _getProjectileAssets(type, color) {
        if (this._projectileAssets.has(type)) {
            return this._projectileAssets.get(type);
        }

        const bodyGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8);
        bodyGeo.rotateX(Math.PI / 2);
        const tipGeo = new THREE.ConeGeometry(0.15, 0.4, 8);
        tipGeo.rotateX(Math.PI / 2);
        const finGeo = new THREE.BoxGeometry(0.02, 0.25, 0.3);
        const flameGeo = new THREE.ConeGeometry(0.1, 0.5, 6);
        flameGeo.rotateX(-Math.PI / 2);

        const bodyMat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.4,
            roughness: 0.3,
            metalness: 0.6,
        });
        const tipMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            emissive: color,
            emissiveIntensity: 0.2,
            roughness: 0.2,
            metalness: 0.8,
        });
        const finMat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.3,
            roughness: 0.4,
            metalness: 0.5,
        });
        const flameMat = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.8,
        });

        const assets = { bodyGeo, tipGeo, finGeo, flameGeo, bodyMat, tipMat, finMat, flameMat };
        this._projectileAssets.set(type, assets);
        return assets;
    }

    _bounceProjectileOnFoam(projectile, collisionInfo) {
        if (!projectile || !collisionInfo?.normal) return false;

        const maxFoamBounces = 3;
        if ((projectile.foamBounces || 0) >= maxFoamBounces) return false;
        if ((projectile.foamBounceCooldown || 0) > 0) return false;

        this._tmpVec.copy(projectile.velocity);
        const speed = this._tmpVec.length();
        if (speed <= 0.0001) return false;

        this._tmpVec2.copy(collisionInfo.normal).normalize();
        if (this._tmpVec.dot(this._tmpVec2) >= 0) {
            this._tmpVec2.multiplyScalar(-1);
        }

        this._tmpVec.normalize().reflect(this._tmpVec2);
        this._tmpVec.addScaledVector(this._tmpVec2, 0.08).normalize();
        projectile.velocity.copy(this._tmpVec.multiplyScalar(speed * 1.02));

        projectile.position.addScaledVector(this._tmpVec2, Math.max(0.2, projectile.radius * 1.25));
        projectile.mesh.position.copy(projectile.position);
        this._tmpVec.addVectors(projectile.position, projectile.velocity);
        projectile.mesh.lookAt(this._tmpVec);

        projectile.foamBounces = (projectile.foamBounces || 0) + 1;
        projectile.foamBounceCooldown = 0.045;
        projectile.ttl = Math.max(0, projectile.ttl - 0.02);

        this.onProjectileHit(projectile.position, 0x34d399, projectile.owner, projectile);
        return true;
    }

    _acquireHomingTarget(projectile, players) {
        if (!projectile || !Array.isArray(players) || players.length === 0) return null;

        const owner = projectile.owner;
        const maxRange = Math.max(10, Number(projectile.homingRange || CONFIG?.HOMING?.MAX_LOCK_RANGE || 100));
        const maxRangeSq = maxRange * maxRange;
        const lockOnAngle = Math.max(5, Number(projectile.homingLockOnAngle || CONFIG?.HOMING?.LOCK_ON_ANGLE || 15));
        const minDot = Math.cos(THREE.MathUtils.degToRad(lockOnAngle));

        this._tmpVec2.copy(projectile.velocity);
        const speed = this._tmpVec2.length();
        if (speed <= 0.0001) return null;
        this._tmpVec2.divideScalar(speed);

        let bestTarget = null;
        let bestDistSq = Infinity;
        let bestFallbackTarget = null;
        let bestFallbackDistSq = Infinity;
        for (const target of players) {
            if (!target || !target.alive || target === owner) continue;

            this._tmpVec.subVectors(target.position, projectile.position);
            const distSq = this._tmpVec.lengthSq();
            if (distSq <= 1 || distSq > maxRangeSq) continue;
            if (distSq < bestFallbackDistSq) {
                bestFallbackDistSq = distSq;
                bestFallbackTarget = target;
            }

            const distance = Math.sqrt(distSq);
            this._tmpDir.copy(this._tmpVec).multiplyScalar(1 / distance);
            if (this._tmpVec2.dot(this._tmpDir) < minDot) continue;

            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestTarget = target;
            }
        }
        if (bestTarget) return bestTarget;
        return projectile.huntRocket ? bestFallbackTarget : null;
    }

    update(dt) {
        const arena = this.getArena();
        const players = this.getPlayers();
        const trailSpatialIndex = this.getTrailSpatialIndex();
        const time = getNowMilliseconds() * 0.001;

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.foamBounceCooldown = Math.max(0, (projectile.foamBounceCooldown || 0) - dt);

            const vx = projectile.velocity.x * dt;
            const vy = projectile.velocity.y * dt;
            const vz = projectile.velocity.z * dt;
            projectile.position.x += vx;
            projectile.position.y += vy;
            projectile.position.z += vz;
            projectile.traveled += Math.sqrt(vx * vx + vy * vy + vz * vz);
            projectile.ttl -= dt;

            projectile.mesh.position.copy(projectile.position);
            this._tmpVec.addVectors(projectile.position, projectile.velocity);
            projectile.mesh.lookAt(this._tmpVec);

            const portalResult = arena?.checkPortal
                ? arena.checkPortal(projectile.position, projectile.radius, 1000 + i)
                : null;
            if (portalResult) {
                projectile.position.copy(portalResult.target);
                this._tmpVec.copy(projectile.velocity).normalize().multiplyScalar(1.5);
                projectile.position.add(this._tmpVec);
                projectile.mesh.position.copy(projectile.position);
            }

            if (projectile.huntRocket) {
                projectile.homingReacquireTimer = Math.max(0, (projectile.homingReacquireTimer || 0) - dt);
                if (!projectile.target || !projectile.target.alive || projectile.homingReacquireTimer <= 0) {
                    projectile.target = this._acquireHomingTarget(projectile, players);
                    projectile.homingReacquireTimer = Math.max(0.04, Number(projectile.homingReacquireInterval || 0.12));
                }
            }

            if (projectile.target && projectile.target.alive) {
                this._tmpVec.subVectors(projectile.target.position, projectile.position).normalize();
                this._tmpVec2.copy(projectile.velocity);
                const speed = this._tmpVec2.length();
                const turnRate = Math.max(0.1, Number(projectile.homingTurnRate || CONFIG.HOMING.TURN_RATE));
                this._tmpVec2.normalize().lerp(this._tmpVec, Math.min(turnRate * dt, 1.0)).normalize();
                projectile.velocity.copy(this._tmpVec2.multiplyScalar(speed));
                this._tmpVec.addVectors(projectile.position, projectile.velocity);
                projectile.mesh.lookAt(this._tmpVec);
            }

            if (projectile.flame) {
                const flicker = 0.7 + Math.sin(time * 30 + i * 7) * 0.3;
                projectile.flame.scale.set(1, 1, flicker);
            }

            let arenaCollision = null;
            if (typeof arena?.getCollisionInfo === 'function') {
                arenaCollision = arena.getCollisionInfo(projectile.position, projectile.radius);
            } else if (typeof arena?.checkCollision === 'function' && arena.checkCollision(projectile.position, projectile.radius)) {
                arenaCollision = { hit: true, kind: 'wall', normal: null };
            }

            const projectileExpired = projectile.ttl <= 0 || projectile.traveled >= CONFIG.PROJECTILE.MAX_DISTANCE;
            const projectileHitArena = !!arenaCollision?.hit;
            const arenaKind = String(arenaCollision?.kind || 'wall').toLowerCase();
            const bouncedOnFoam = projectileHitArena && arenaKind === 'foam'
                ? this._bounceProjectileOnFoam(projectile, arenaCollision)
                : false;

            if (projectileExpired || (projectileHitArena && !bouncedOnFoam)) {
                this.onProjectileHit(projectile.position, 0xffff00, projectile.owner, projectile);
                this._removeProjectileAt(i);
                continue;
            }

            if (bouncedOnFoam) {
                continue;
            }

            const trailHit = applyTrailDamageFromProjectile(trailSpatialIndex, projectile);
            if (trailHit) {
                if (trailHit.closestPoint) {
                    this._tmpVec.set(
                        trailHit.closestPoint.closestX,
                        trailHit.closestPoint.closestY,
                        trailHit.closestPoint.closestZ
                    );
                } else {
                    this._tmpVec.copy(projectile.position);
                }
                this.onTrailSegmentHit(this._tmpVec, projectile.owner, projectile, trailHit);
                this._removeProjectileAt(i);
                continue;
            }

            let hit = false;
            for (const target of players) {
                if (!target.alive || target === projectile.owner) continue;

                if (target.isPointInOBB && target.isPointInOBB(projectile.position)) {
                    hit = true;
                } else {
                    const hitRadius = target.hitboxRadius + projectile.radius;
                    if (target.position.distanceToSquared(projectile.position) <= hitRadius * hitRadius) {
                        hit = true;
                    }
                }

                if (hit) {
                    const huntRocketHit = isHuntHealthActive() && isRocketTierType(projectile.type);
                    if (huntRocketHit) {
                        const damage = resolveRocketTierDamage(projectile.type);
                        const damageResult = target.takeDamage(damage);
                        this.onProjectilePowerup(target, projectile);
                        this.onProjectileDamage(target, projectile.owner, projectile.type, damageResult);
                    } else if (target.hasShield) {
                        target.hasShield = false;
                    } else {
                        target.applyPowerup(projectile.type);
                        this.onProjectilePowerup(target, projectile);
                    }
                    break;
                }
            }

            if (hit) {
                this._removeProjectileAt(i);
            }
        }
    }

    _removeProjectileAt(index) {
        const projectile = this.projectiles[index];
        if (!projectile) return;

        this._releaseProjectileMesh(projectile);
        this.projectiles.splice(index, 1);
        this._releaseProjectileState(projectile);
    }

    _releaseProjectileMesh(projectile) {
        if (!projectile?.mesh) return;

        if (this.renderer) {
            this.renderer.removeFromScene(projectile.mesh);
        }
        projectile.mesh.visible = false;
        projectile.mesh.scale.setScalar(1);

        const pool = this._getProjectilePool(projectile.poolKey || projectile.type);
        pool.push(projectile.mesh);
    }

    clear() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            this._releaseProjectileMesh(projectile);
            this._releaseProjectileState(projectile);
        }
        this.projectiles.length = 0;
    }

    dispose() {
        this.clear();

        for (const assets of this._projectileAssets.values()) {
            if (assets.bodyGeo) assets.bodyGeo.dispose();
            if (assets.tipGeo) assets.tipGeo.dispose();
            if (assets.finGeo) assets.finGeo.dispose();
            if (assets.flameGeo) assets.flameGeo.dispose();
            if (assets.bodyMat) assets.bodyMat.dispose();
            if (assets.tipMat) assets.tipMat.dispose();
            if (assets.finMat) assets.finMat.dispose();
            if (assets.flameMat) assets.flameMat.dispose();
        }

        this._projectileAssets.clear();
        this._projectilePools.clear();
        this._projectileStatePool.length = 0;
    }
}
