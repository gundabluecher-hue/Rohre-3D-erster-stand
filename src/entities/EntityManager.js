// ============================================
// EntityManager.js - manages players, collisions and item projectiles
// ============================================

import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { Player } from './Player.js';
import { BotPolicyRegistry } from './ai/BotPolicyRegistry.js';
import { BOT_POLICY_TYPES, DEFAULT_BOT_POLICY_TYPE, normalizeBotPolicyType } from './ai/BotPolicyTypes.js';
import { createBotRuntimeContext } from './ai/BotRuntimeContextFactory.js';
import { getVehicleIds, isValidVehicleId } from './vehicle-registry.js';
import { ProjectileSystem } from './systems/ProjectileSystem.js';
import { PlayerInputSystem } from './systems/PlayerInputSystem.js';
import { PlayerLifecycleSystem } from './systems/PlayerLifecycleSystem.js';
import { TrailSpatialIndex } from './systems/TrailSpatialIndex.js';
import { SpawnPlacementSystem } from './systems/SpawnPlacementSystem.js';
import { CollisionResponseSystem } from './systems/CollisionResponseSystem.js';
import { HuntCombatSystem } from './systems/HuntCombatSystem.js';
import { OverheatGunSystem } from '../hunt/OverheatGunSystem.js';
import { RespawnSystem } from '../hunt/RespawnSystem.js';
import { HuntScoring } from '../hunt/HuntScoring.js';
import { isHuntHealthActive } from '../hunt/HealthSystem.js';

function clampInt(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeActiveMode(mode) {
    return String(mode || '').trim().toLowerCase();
}

function resolvePolicyFallbackByMode(activeMode) {
    return normalizeActiveMode(activeMode) === 'hunt'
        ? BOT_POLICY_TYPES.HUNT
        : DEFAULT_BOT_POLICY_TYPE;
}

function resolveConfiguredBotPolicyType({ requestedPolicyType, runtimeConfig, activeGameMode } = {}) {
    const runtimePolicyType = runtimeConfig?.bot?.policyType || null;
    const fallbackPolicyType = resolvePolicyFallbackByMode(activeGameMode);
    return normalizeBotPolicyType(requestedPolicyType || runtimePolicyType || fallbackPolicyType);
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
        this._spawnPlacementSystem = new SpawnPlacementSystem(this, {
            isBotPositionSafe: (player, position) => this._collisionResponseSystem.isBotPositionSafe(player, position),
        });
        this._collisionResponseSystem = new CollisionResponseSystem(this, this._spawnPlacementSystem);
        this._huntCombatSystem = new HuntCombatSystem(this);
        this.botPolicyRegistry = new BotPolicyRegistry();
        this.botPolicyType = DEFAULT_BOT_POLICY_TYPE;
        this.activeGameMode = CONFIG?.HUNT?.ACTIVE_MODE || 'classic';
        this.huntEnabled = isHuntHealthActive();
        this.runtimeConfig = null;
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

        this.runtimeConfig = options.runtimeConfig || null;
        this.activeGameMode = options.activeGameMode
            || this.runtimeConfig?.session?.activeGameMode
            || this.activeGameMode
            || 'classic';
        const activeModeLower = String(this.activeGameMode || '').toLowerCase();
        this.huntEnabled = activeModeLower === 'hunt';

        const humanConfigs = Array.isArray(options.humanConfigs) ? options.humanConfigs : [];
        const modelScale = typeof options.modelScale === 'number' ? options.modelScale : (CONFIG.PLAYER.MODEL_SCALE || 1);
        this.botDifficulty = options.botDifficulty || CONFIG.BOT.ACTIVE_DIFFICULTY || this.botDifficulty;
        this.botPolicyType = resolveConfiguredBotPolicyType({
            requestedPolicyType: options.botPolicyType,
            runtimeConfig: this.runtimeConfig,
            activeGameMode: this.activeGameMode,
        });
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
                runtimeConfig: this.runtimeConfig,
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

    createBotRuntimeContext(player, dt) {
        return createBotRuntimeContext(this, player, dt);
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
        return this._spawnPlacementSystem.findSpawnPosition(minDistance, margin, planarLevel);
    }

    _findSafeSpawnDirection(position, radius = 0.8) {
        return this._spawnPlacementSystem.findSafeSpawnDirection(position, radius);
    }

    _traceFreeDistance(origin, direction, maxDistance, stepDistance, radius = 0.8) {
        return this._spawnPlacementSystem.traceFreeDistance(origin, direction, maxDistance, stepDistance, radius);
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
        return this._huntCombatSystem.takeInventoryItem(player, preferredIndex);
    }

    _useInventoryItem(player, preferredIndex = -1) {
        return this._huntCombatSystem.useInventoryItem(player, preferredIndex);
    }

    _shootItemProjectile(player, preferredIndex = -1) {
        return this._huntCombatSystem.shootItemProjectile(player, preferredIndex);
    }

    _shootHuntGun(player) {
        return this._huntCombatSystem.shootHuntGun(player);
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
        return this._huntCombatSystem.checkLockOn(player);
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
        return this._collisionResponseSystem.isBotPositionSafe(player, position);
    }

    _clampBotPosition(vec) {
        this._collisionResponseSystem.clampBotPosition(vec);
    }

    _findSafeBouncePosition(player, baseDirection, normal = null, options = {}) {
        this._spawnPlacementSystem.findSafeBouncePosition(player, baseDirection, normal, options);
    }

    _bounceBot(player, normalOverride = null, source = 'WALL', options = {}) {
        this._collisionResponseSystem.bounceBot(player, normalOverride, source, options);
    }

    _bouncePlayerOnFoam(player, normalOverride = null) {
        this._collisionResponseSystem.bouncePlayerOnFoam(player, normalOverride);
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



