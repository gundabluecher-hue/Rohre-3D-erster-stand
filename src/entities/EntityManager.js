// ============================================
// EntityManager.js - manages players, collisions and item projectiles
// ============================================

import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { Player } from './Player.js';
import { BotPolicyRegistry } from './ai/BotPolicyRegistry.js';
import { BOT_POLICY_TYPES, DEFAULT_BOT_POLICY_TYPE } from './ai/BotPolicyTypes.js';
import { getVehicleIds, isValidVehicleId } from './vehicle-registry.js';
import { ProjectileSystem } from './systems/ProjectileSystem.js';
import { PlayerInputSystem } from './systems/PlayerInputSystem.js';
import { PlayerLifecycleSystem } from './systems/PlayerLifecycleSystem.js';
import { TrailSpatialIndex } from './systems/TrailSpatialIndex.js';
import { OverheatGunSystem } from '../hunt/OverheatGunSystem.js';
import { RespawnSystem } from '../hunt/RespawnSystem.js';
import { HuntScoring } from '../hunt/HuntScoring.js';
import { isHuntHealthActive } from '../hunt/HealthSystem.js';

function clampInt(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export class EntityManager {
    static deriveSelfTrailSkipRecentSegments(player) {
        const updateInterval = Math.max(0.01, Number(CONFIG.TRAIL?.UPDATE_INTERVAL) || 0.07);
        const speed = Math.max(1, Number(player?.speed) || Number(player?.baseSpeed) || Number(CONFIG.PLAYER?.SPEED) || 18);
        const hitboxRadius = Math.max(0.4, Number(player?.hitboxRadius) || Number(CONFIG.PLAYER?.HITBOX_RADIUS) || 0.8);
        const trailRadius = Math.max(0.05, (Number(player?.trail?.width) || Number(CONFIG.TRAIL?.WIDTH) || 0.6) * 0.5);

        let bodyLengthEstimate = hitboxRadius * 2.5;
        const box = player?.hitboxBox;
        if (box && box.min && box.max) {
            const lenX = Math.abs(Number(box.max.x) - Number(box.min.x)) || 0;
            const lenZ = Math.abs(Number(box.max.z) - Number(box.min.z)) || 0;
            bodyLengthEstimate = Math.max(bodyLengthEstimate, lenX, lenZ);
        }

        const graceDistance = Math.max(
            hitboxRadius * 3.5,
            bodyLengthEstimate + hitboxRadius * 0.5 + trailRadius
        );
        const estimatedSegmentSpacing = Math.max(0.2, speed * updateInterval);

        return clampInt(Math.ceil(graceDistance / estimatedSegmentSpacing) + 1, 5, 12);
    }

    constructor(renderer, arena, powerupManager, particles, audio, recorder) {
        this.renderer = renderer;
        this.arena = arena;
        this.powerupManager = powerupManager;
        this.particles = particles;
        this.audio = audio;
        this.recorder = recorder;
        this.players = [];
        this.humanPlayers = [];
        this.bots = [];
        this.botByPlayer = new Map();
        this._projectileSystem = new ProjectileSystem({
            renderer: this.renderer,
            getArena: () => this.arena,
            getPlayers: () => this.players,
            takeInventoryItem: (player, preferredIndex) => this._takeInventoryItem(player, preferredIndex),
            resolveLockOn: (player) => this._checkLockOn(player),
            getTrailSpatialIndex: () => this._trailSpatialIndex,
            onShoot: () => {
                if (this.audio) this.audio.play('SHOOT');
            },
            onProjectileHit: (position, color, owner) => {
                if (this.particles) this.particles.spawnHit(position, color);
                if (this.audio && !owner?.isBot) this.audio.play('HIT');
            },
            onTrailSegmentHit: (position, owner, projectile, trailHit) => {
                const isDestroyed = !!trailHit?.destroyed;
                const color = isDestroyed ? 0x66ddff : 0x3388ff;
                if (this.particles) this.particles.spawnHit(position, color);
                if (this.audio && !owner?.isBot) this.audio.play('HIT');
            },
            onProjectilePowerup: (target) => {
                if (this.particles) this.particles.spawnExplosion(target.position, 0xff0000);
                if (this.audio) this.audio.play('POWERUP');
            },
            onProjectileDamage: (target, owner, type, damageResult) => {
                this._emitHuntDamageEvent({
                    target,
                    sourcePlayer: owner || null,
                    cause: type || 'PROJECTILE',
                    damageResult,
                    projectileType: type || null,
                });
                if (damageResult?.isDead) {
                    this._killPlayer(target, 'PROJECTILE', { killer: owner || null });
                }
                if (damageResult?.isDead && this.onHuntFeedEvent && owner) {
                    const attackerLabel = owner.isBot ? `Bot ${owner.index + 1}` : `P${owner.index + 1}`;
                    const targetLabel = target.isBot ? `Bot ${target.index + 1}` : `P${target.index + 1}`;
                    this.onHuntFeedEvent(`${attackerLabel} -> ${targetLabel}: ELIMINATED`);
                }
                if (!damageResult?.isDead && this.onHuntFeedEvent && owner) {
                    const attackerLabel = owner.isBot ? `Bot ${owner.index + 1}` : `P${owner.index + 1}`;
                    const targetLabel = target.isBot ? `Bot ${target.index + 1}` : `P${target.index + 1}`;
                    this.onHuntFeedEvent(`${attackerLabel} -> ${targetLabel}: -${Math.round(damageResult?.applied || 0)} HP`);
                }
            },
        });
        this.projectiles = this._projectileSystem.projectiles;
        this.onPlayerDied = null;
        this.onRoundEnd = null;
        this.onPlayerFeedback = null;
        this._playerInputSystem = new PlayerInputSystem(this);
        this._playerLifecycleSystem = new PlayerLifecycleSystem(this);
        this._overheatGunSystem = new OverheatGunSystem(this);
        this._respawnSystem = new RespawnSystem(this);
        this._huntScoring = new HuntScoring();
        this.onHuntFeedEvent = null;
        this.onHuntDamageEvent = null;

        // Wiederverwendbare temp-Vektoren (vermeidet GC-Druck)
        this._tmpVec = new THREE.Vector3();
        this._tmpVec2 = new THREE.Vector3();
        this._tmpDir = new THREE.Vector3();
        this._tmpDir2 = new THREE.Vector3();
        this._tmpCamAnchor = new THREE.Vector3();
        this._tmpCollisionNormal = new THREE.Vector3();
        this._tmpPrevPlayerPosition = new THREE.Vector3();
        this._fallbackArenaCollision = { hit: true, kind: 'wall', isWall: true, normal: null };

        // Lock-On Cache (einmal pro Frame berechnen)
        this._lockOnCache = new Map();
        this.botDifficulty = CONFIG.BOT.ACTIVE_DIFFICULTY || CONFIG.BOT.DEFAULT_DIFFICULTY || 'NORMAL';
        this._trailSpatialIndex = new TrailSpatialIndex({
            getPlayers: () => this.players,
            gridSize: 10,
        });
        this._bindTrailSpatialIndexCompatibility();
        this.botPolicyRegistry = new BotPolicyRegistry();
        this.botPolicyType = DEFAULT_BOT_POLICY_TYPE;
    }

    _bindTrailSpatialIndexCompatibility() {
        const aliases = {
            gridSize: {
                get: () => this._trailSpatialIndex.gridSize,
                set: (value) => { this._trailSpatialIndex.gridSize = value; },
            },
            spatialGrid: {
                get: () => this._trailSpatialIndex.spatialGrid,
                set: (value) => {
                    this._trailSpatialIndex.spatialGrid = value instanceof Map ? value : new Map();
                },
            },
            _trailCollisionResult: {
                get: () => this._trailSpatialIndex._trailCollisionResult,
                set: (value) => {
                    this._trailSpatialIndex._trailCollisionResult = value || { hit: false, playerIndex: -1 };
                },
            },
            _trailCollisionDebugEnabled: {
                get: () => this._trailSpatialIndex._trailCollisionDebugEnabled,
                set: (value) => { this._trailSpatialIndex._trailCollisionDebugEnabled = !!value; },
            },
            _trailCollisionDebugLogCount: {
                get: () => this._trailSpatialIndex._trailCollisionDebugLogCount,
                set: (value) => { this._trailSpatialIndex._trailCollisionDebugLogCount = Number(value) || 0; },
            },
            _trailCollisionDebugMaxLogs: {
                get: () => this._trailSpatialIndex._trailCollisionDebugMaxLogs,
                set: (value) => {
                    const n = Number(value);
                    this._trailSpatialIndex._trailCollisionDebugMaxLogs = Number.isFinite(n) && n > 0 ? n : 1;
                },
            },
            _trailCollisionDebugSkipRecentSeen: {
                get: () => this._trailSpatialIndex._trailCollisionDebugSkipRecentSeen,
                set: (value) => {
                    const n = Number(value);
                    this._trailSpatialIndex._trailCollisionDebugSkipRecentSeen = Number.isFinite(n) && n >= 0 ? n : 0;
                },
            },
        };

        for (const [name, descriptor] of Object.entries(aliases)) {
            Object.defineProperty(this, name, {
                configurable: true,
                enumerable: true,
                get: descriptor.get,
                set: descriptor.set,
            });
        }
    }

    setup(numHumans, numBots, options = {}) {
        console.log(`[EntityManager] Setup: Humans=${numHumans}, Bots=${numBots}`);
        this.clear();

        const humanConfigs = Array.isArray(options.humanConfigs) ? options.humanConfigs : [];
        const modelScale = typeof options.modelScale === 'number' ? options.modelScale : (CONFIG.PLAYER.MODEL_SCALE || 1);
        this.botDifficulty = options.botDifficulty || CONFIG.BOT.ACTIVE_DIFFICULTY || this.botDifficulty;
        const requestedPolicyType = options.botPolicyType || this.botPolicyType;
        this.botPolicyType = isHuntHealthActive()
            ? BOT_POLICY_TYPES.HUNT
            : requestedPolicyType;
        const availableVehicleIds = getVehicleIds();
        const defaultVehicleId = String(CONFIG.PLAYER.DEFAULT_VEHICLE_ID || availableVehicleIds[0] || 'aircraft');
        const normalizeVehicleId = (value) => {
            const candidate = String(value || '').trim();
            if (isValidVehicleId(candidate)) {
                return candidate;
            }
            return defaultVehicleId;
        };
        const botVehicleSource = Array.isArray(options.botVehicleIds) && options.botVehicleIds.length > 0
            ? options.botVehicleIds
            : availableVehicleIds;
        const botVehicleIds = botVehicleSource.map((id) => normalizeVehicleId(id));

        this.humanPlayers = [];
        this.botByPlayer.clear();

        const humanColors = [CONFIG.COLORS.PLAYER_1, CONFIG.COLORS.PLAYER_2];
        for (let i = 0; i < numHumans; i++) {
            const playerVehicleId = normalizeVehicleId(humanConfigs[i]?.vehicleId);
            const player = new Player(this.renderer, i, humanColors[i], false, {
                vehicleId: playerVehicleId,
                entityManager: this
            });
            player.setControlOptions({
                invertPitch: !!humanConfigs[i]?.invertPitch,
                cockpitCamera: !!humanConfigs[i]?.cockpitCamera,
                modelScale,
            });
            this.players.push(player);
            this.humanPlayers.push(player);
        }

        for (let i = 0; i < numBots; i++) {
            const color = CONFIG.COLORS.BOT_COLORS[i % CONFIG.COLORS.BOT_COLORS.length];
            const botVehicleId = botVehicleIds.length > 0
                ? botVehicleIds[i % botVehicleIds.length]
                : defaultVehicleId;
            const player = new Player(this.renderer, numHumans + i, color, true, {
                vehicleId: botVehicleId,
                entityManager: this
            });
            player.setControlOptions({ modelScale, invertPitch: false });
            const ai = this.botPolicyRegistry.create(this.botPolicyType, {
                difficulty: this.botDifficulty,
                recorder: this.recorder,
            });
            if (typeof ai?.setSensePhase === 'function') {
                ai.setSensePhase(i % 4); // Time-Slicing: Bot-Scans auf 4 Frames verteilen
            }
            this.players.push(player);
            this.bots.push({ player, ai });
            this.botByPlayer.set(player, ai);
        }
    }

    setBotDifficulty(profileName) {
        this.botDifficulty = profileName || this.botDifficulty;
        for (let i = 0; i < this.bots.length; i++) {
            const bot = this.bots[i];
            if (bot?.ai?.setDifficulty) {
                bot.ai.setDifficulty(this.botDifficulty);
            }
        }
    }

    spawnAll() {
        this._roundEnded = false;
        this._respawnSystem.reset();
        const isPlanar = !!CONFIG.GAMEPLAY.PLANAR_MODE;
        const planarSpawnLevel = isPlanar ? this._getPlanarSpawnLevel() : null;

        for (const player of this.players) {
            const pos = this._findSpawnPosition(12, 12, planarSpawnLevel);
            const dir = this._findSafeSpawnDirection(pos, player.hitboxRadius);
            player.spawn(pos, dir);
            player.shootCooldown = 0;
            if (this.recorder) {
                this.recorder.markPlayerSpawn(player);
                this.recorder.logEvent('SPAWN', player.index, player.isBot ? 'bot=1' : 'bot=0');
            }
        }
    }

    _getPlanarSpawnLevel() {
        const bounds = this.arena?.bounds || null;
        const fallback = bounds
            ? (bounds.minY + bounds.maxY) * 0.5
            : (CONFIG.PLAYER.START_Y || 5);

        const hasPortals = Array.isArray(this.arena?.portals) && this.arena.portals.length > 0;
        if (!hasPortals) {
            return fallback;
        }

        if (!this.arena?.getPortalLevels) {
            return fallback;
        }

        const levels = this.arena.getPortalLevels();
        if (!Array.isArray(levels) || levels.length === 0) {
            return fallback;
        }

        let best = fallback;
        let bestDist = Infinity;
        for (let i = 0; i < levels.length; i++) {
            const value = levels[i];
            if (!Number.isFinite(value)) continue;
            const dist = Math.abs(value - fallback);
            if (dist < bestDist) {
                bestDist = dist;
                best = value;
            }
        }
        return best;
    }

    _findSpawnPosition(minDistance = 12, margin = 12, planarLevel = null) {
        const usePlanarLevel = Number.isFinite(planarLevel) && !!this.arena?.getRandomPositionOnLevel;
        const randomSpawn = () => usePlanarLevel
            ? this.arena.getRandomPositionOnLevel(planarLevel, margin)
            : this.arena.getRandomPosition(margin);

        for (let attempts = 0; attempts < 100; attempts++) {
            const pos = randomSpawn();
            let tooClose = false;

            for (const other of this.players) {
                if (!other.alive) continue;
                if (other.position.distanceToSquared(pos) < minDistance * minDistance) {
                    tooClose = true;
                    break;
                }
            }

            if (!tooClose) {
                return pos;
            }
        }

        return randomSpawn();
    }

    _findSafeSpawnDirection(position, radius = 0.8) {
        const sampleCount = 20;
        let bestDirection = new THREE.Vector3(0, 0, -1);
        let bestDistance = -1;

        for (let i = 0; i < sampleCount; i++) {
            const angle = (Math.PI * 2 * i) / sampleCount;
            this._tmpDir.set(Math.sin(angle), 0, -Math.cos(angle));
            const freeDistance = this._traceFreeDistance(position, this._tmpDir, 36, 2.2, radius);
            if (freeDistance > bestDistance) {
                bestDistance = freeDistance;
                bestDirection.copy(this._tmpDir);
            }
        }

        return bestDirection;
    }

    _traceFreeDistance(origin, direction, maxDistance, stepDistance, radius = 0.8) {
        const step = Math.max(0.5, stepDistance);
        let traveled = 0;
        while (traveled < maxDistance) {
            traveled += step;
            this._tmpVec.set(
                origin.x + direction.x * traveled,
                origin.y + direction.y * traveled,
                origin.z + direction.z * traveled
            );
            if (this.arena.checkCollision(this._tmpVec, radius)) {
                return traveled - step;
            }
        }
        return maxDistance;
    }

    update(dt, inputManager) {
        this._lockOnCache.clear();
        this._projectileSystem.update(dt);
        this._overheatGunSystem.update(dt);
        this._respawnSystem.update(dt);

        for (const player of this.players) {
            if (!player.alive) continue;
            this._playerLifecycleSystem.updateShootCooldown(player, dt);
            const input = this._playerInputSystem.resolvePlayerInput(player, dt, inputManager);
            this._playerLifecycleSystem.updatePlayer(player, dt, input);
        }

        if (this._roundEnded) return;

        let humansAlive = 0;
        let lastHumanAlive = null;
        for (const h of this.humanPlayers) {
            if (h.alive) {
                humansAlive++;
                lastHumanAlive = h;
            }
        }
        const huntRespawnEnabled = isHuntHealthActive() && !!CONFIG?.HUNT?.RESPAWN_ENABLED;
        const pendingHumanRespawns = huntRespawnEnabled
            ? this._respawnSystem.getPendingCountForPlayers(this.humanPlayers)
            : 0;

        let shouldEnd = false;
        let winner = null;

        if (this.humanPlayers.length === 1) {
            if (humansAlive === 0 && pendingHumanRespawns === 0) {
                shouldEnd = true;
                for (let i = 0; i < this.bots.length; i++) {
                    const botPlayer = this.bots[i].player;
                    if (botPlayer && botPlayer.alive) { winner = botPlayer; break; }
                }
            }
        } else if (this.humanPlayers.length >= 2) {
            if (humansAlive <= 1 && pendingHumanRespawns === 0) {
                shouldEnd = true;
                winner = lastHumanAlive;
            }
        }

        if (shouldEnd) {
            this._roundEnded = true;
            if (this.onRoundEnd) this.onRoundEnd(winner);
        }
    }

    _takeInventoryItem(player, preferredIndex = -1) {
        if (!player.inventory || player.inventory.length === 0) return { ok: false, reason: 'Kein Item verfuegbar', type: null };
        const index = Number.isInteger(preferredIndex) && preferredIndex >= 0
            ? Math.min(preferredIndex, player.inventory.length - 1)
            : Math.min(player.selectedItemIndex || 0, player.inventory.length - 1);
        const type = player.inventory.splice(index, 1)[0];
        if (player.inventory.length === 0 || player.selectedItemIndex >= player.inventory.length) player.selectedItemIndex = 0;
        return { ok: true, type };
    }

    _useInventoryItem(player, preferredIndex = -1) {
        const itemResult = this._takeInventoryItem(player, preferredIndex);
        if (!itemResult.ok) return { ok: false, reason: itemResult.reason };
        player.applyPowerup(itemResult.type);
        return { ok: true, type: itemResult.type };
    }

    _shootItemProjectile(player, preferredIndex = -1) {
        return this._projectileSystem.shootItemProjectile(player, preferredIndex);
    }

    _shootHuntGun(player) {
        return this._overheatGunSystem.tryFire(player);
    }

    getHuntOverheatSnapshot() {
        return this._overheatGunSystem.getOverheatSnapshot();
    }

    getHuntScoreboard() {
        return this._huntScoring.getScoreboard(this.players);
    }

    getHuntScoreboardSummary(maxEntries = 3) {
        return this._huntScoring.formatSummary(this.players, { maxEntries });
    }

    _checkLockOn(player) {
        if (this._lockOnCache.has(player.index)) return this._lockOnCache.get(player.index);
        player.getDirection(this._tmpDir).normalize();
        const maxAngle = (CONFIG.HOMING.LOCK_ON_ANGLE * Math.PI) / 180;
        const maxRangeSq = CONFIG.HOMING.MAX_LOCK_RANGE * CONFIG.HOMING.MAX_LOCK_RANGE;
        let bestTarget = null; let bestDistSq = Infinity;
        for (const other of this.players) {
            if (other === player || !other.alive) continue;
            this._tmpVec.subVectors(other.position, player.position);
            const distSq = this._tmpVec.lengthSq();
            if (distSq > maxRangeSq || distSq < 1) continue;
            const angle = this._tmpDir.angleTo(this._tmpVec.normalize());
            if (angle <= maxAngle && distSq < bestDistSq) { bestTarget = other; bestDistSq = distSq; }
        }
        this._lockOnCache.set(player.index, bestTarget);
        return bestTarget;
    }

    getLockOnTarget(playerIndex) {
        if (this._lockOnCache.has(playerIndex)) return this._lockOnCache.get(playerIndex);
        const player = this.players[playerIndex];
        if (!player || !player.alive) return null;
        return this._checkLockOn(player);
    }

    _notifyPlayerFeedback(player, message) { if (this.onPlayerFeedback) this.onPlayerFeedback(player, message); }

    _emitHuntDamageEvent(event) {
        if (isHuntHealthActive()) {
            this._huntScoring.registerDamage(event?.sourcePlayer, event?.target, event?.damageResult);
        }
        if (typeof this.onHuntDamageEvent !== 'function') return;
        this.onHuntDamageEvent(event || null);
    }

    _killPlayer(player, cause = 'UNKNOWN', options = {}) {
        if (!player || !player.alive) return;
        player.kill();
        if (isHuntHealthActive()) {
            this._huntScoring.registerElimination(player, {
                killer: options?.killer || null,
            });
        }
        this._respawnSystem.onPlayerDied(player);
        if (this.particles) this.particles.spawnExplosion(player.position, player.color);
        if (this.audio) this.audio.play('EXPLOSION');
        if (this.recorder) {
            const killerIndex = Number.isInteger(options?.killer?.index) ? options.killer.index : -1;
            this.recorder.markPlayerDeath(player, cause);
            this.recorder.logEvent('KILL', player.index, `cause=${cause} killer=${killerIndex}`);
        }
        if (this.onPlayerDied) this.onPlayerDied(player, cause);
    }

    _isBotPositionSafe(player, position) {
        if (this.arena.checkCollision(position, player.hitboxRadius)) return false;
        const hit = this.checkGlobalCollision(position, player.hitboxRadius, player.index, 20);
        return !hit;
    }

    _clampBotPosition(vec) {
        const b = this.arena.bounds;
        vec.x = Math.max(b.minX + 2, Math.min(b.maxX - 2, vec.x));
        vec.y = Math.max(b.minY + 2, Math.min(b.maxY - 2, vec.y));
        vec.z = Math.max(b.minZ + 2, Math.min(b.maxZ - 2, vec.z));
    }

    _findSafeBouncePosition(player, baseDirection, normal = null, options = {}) {
        const pos = player.position;
        const distances = Array.isArray(options.distances) && options.distances.length > 0
            ? options.distances
            : [1.5, 3.0, 5.0, 0.5];
        for (const dist of distances) {
            this._tmpVec2.copy(pos).addScaledVector(baseDirection, dist);
            if (this._isBotPositionSafe(player, this._tmpVec2)) {
                pos.copy(this._tmpVec2);
                return;
            }
        }
        if (normal) {
            const normalPush = Number.isFinite(options.normalPush) ? options.normalPush : 2.0;
            pos.addScaledVector(normal, normalPush);
            if (this._isBotPositionSafe(player, pos)) return;
        }
        const b = this.arena.bounds;
        pos.set((b.minX + b.maxX) * 0.5, (b.minY + b.maxY) * 0.5, (b.minZ + b.maxZ) * 0.5);
    }

    _bounceBot(player, normalOverride = null, source = 'WALL', options = {}) {
        const pos = player.position;
        let normal = normalOverride;
        if (!normal) {
            const b = this.arena.bounds;
            const dLeft = pos.x - b.minX; const dRight = b.maxX - pos.x;
            const dDown = pos.y - b.minY; const dUp = b.maxY - pos.y;
            const dBack = pos.z - b.minZ; const dFront = b.maxZ - pos.z;
            let minDist = dLeft; this._tmpVec2.set(1, 0, 0);
            if (dRight < minDist) { minDist = dRight; this._tmpVec2.set(-1, 0, 0); }
            if (dDown < minDist) { minDist = dDown; this._tmpVec2.set(0, 1, 0); }
            if (dUp < minDist) { minDist = dUp; this._tmpVec2.set(0, -1, 0); }
            if (dFront < minDist) { minDist = dFront; this._tmpVec2.set(0, 0, 1); }
            if (dBack < minDist) { minDist = dBack; this._tmpVec2.set(0, 0, -1); }
            normal = this._tmpVec2;
        }
        player.getDirection(this._tmpDir).normalize();
        const dot = this._tmpDir.dot(normal);
        this._tmpDir.x -= 2 * dot * normal.x; this._tmpDir.y -= 2 * dot * normal.y; this._tmpDir.z -= 2 * dot * normal.z;
        this._tmpDir.normalize();
        const normalBias = Number.isFinite(options.normalBias) ? options.normalBias : 0.25;
        this._tmpDir.addScaledVector(normal, normalBias);
        const randomScale = Number.isFinite(options.randomScale)
            ? options.randomScale
            : (source === 'TRAIL' ? 0.35 : 0.24);
        this._tmpDir.x += (Math.random() - 0.5) * randomScale;
        this._tmpDir.y += (Math.random() - 0.5) * randomScale;
        this._tmpDir.z += (Math.random() - 0.5) * randomScale;
        if (CONFIG.GAMEPLAY.PLANAR_MODE) this._tmpDir.y = 0;
        this._tmpDir.normalize();
        const preRotateShove = Number.isFinite(options.preRotateShove) ? options.preRotateShove : 1;
        this._tmpDir.addScaledVector(this._tmpDir, preRotateShove);
        this._tmpVec.copy(this._tmpDir).normalize();
        player.quaternion.setFromUnitVectors(this._tmpVec2.set(0, 0, -1), this._tmpVec);
        this._findSafeBouncePosition(player, this._tmpDir, normal, options);
        if (Number.isFinite(options.extraPush) && options.extraPush > 0) {
            this._tmpVec2.copy(player.position).addScaledVector(this._tmpDir, options.extraPush);
            if (this._isBotPositionSafe(player, this._tmpVec2)) {
                player.position.copy(this._tmpVec2);
            }
        }
        player.trail.forceGap(Number.isFinite(options.trailGap) ? options.trailGap : 0.3);
        if (Number.isFinite(options.spawnProtection) && options.spawnProtection > 0) {
            player.spawnProtectionTimer = Math.max(player.spawnProtectionTimer || 0, options.spawnProtection);
        }
        const botAI = this.botByPlayer.get(player);
        if (botAI?.onBounce) botAI.onBounce(source, normal);
        if (this.recorder) this.recorder.logEvent(source === 'TRAIL' ? 'BOUNCE_TRAIL' : 'BOUNCE_WALL', player.index);
    }

    _bouncePlayerOnFoam(player, normalOverride = null) {
        this._bounceBot(player, normalOverride, 'FOAM', {
            normalBias: 0.0,
            randomScale: 0.0,
            preRotateShove: 2.4,
            distances: [4.0, 7.0, 10.0, 2.0],
            normalPush: 4.8,
            extraPush: 3.2,
            trailGap: 0.45,
            spawnProtection: 0.16,
        });
        if (typeof player?.lockSteering === 'function') {
            player.lockSteering(0.28);
        } else if (player) {
            player.steeringLockTimer = Math.max(player.steeringLockTimer || 0, 0.28);
        }
    }

    updateCameras(dt) {
        for (const player of this.players) {
            if (!player.isBot && player.index < this.renderer.cameras.length) {
                const pos = player.position;
                const dir = player.alive ? player.getDirection(this._tmpDir2) : this._tmpDir2.set(0, 0, -1);
                const firstPersonAnchor = player.getFirstPersonCameraAnchor(this._tmpCamAnchor);
                this.renderer.updateCamera(player.index, pos, dir, dt, player.quaternion, player.cockpitCamera, player.isBoosting, this.arena, firstPersonAnchor);
            }
        }
    }

    getHumanPlayers() { return this.humanPlayers; }
    getTrailSpatialIndex() { return this._trailSpatialIndex; }

    registerTrailSegment(playerIndex, segmentIdx, data, reusableRef = null) {
        return this._trailSpatialIndex.registerTrailSegment(playerIndex, segmentIdx, data, reusableRef);
    }

    unregisterTrailSegment(key, entry) {
        this._trailSpatialIndex.unregisterTrailSegment(key, entry);
    }

    checkGlobalCollision(position, radius, excludePlayerIndex = -1, skipRecent = 0, playerRef = null) {
        return this._trailSpatialIndex.checkGlobalCollision(position, radius, excludePlayerIndex, skipRecent, playerRef);
    }

    clear() {
        for (const player of this.players) {
            if (player) player.dispose();
        }
        this.players.length = 0;
        this.humanPlayers.length = 0;
        this.bots.length = 0;
        this.botByPlayer.clear();
        this._projectileSystem.clear();
        this._overheatGunSystem.reset();
        this._respawnSystem.reset();
        this._huntScoring.reset();

        if (this.powerupManager) {
            this.powerupManager.clear();
        }

        this._trailSpatialIndex.clear();
        this._lockOnCache.clear();
        this.onHuntDamageEvent = null;
        this.onHuntFeedEvent = null;
    }

    dispose() {
        this.clear();
        this._projectileSystem.dispose();
    }
}



