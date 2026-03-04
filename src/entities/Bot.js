// ============================================
// Bot.js - AI opponent logic
// ============================================

import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { runPerception } from './ai/BotSensingOps.js';
import { runDecision } from './ai/BotDecisionOps.js';
import { runAction } from './ai/BotActionOps.js';
import { estimateEnemyPressure, estimatePointRisk, selectTarget } from './ai/BotTargetingOps.js';
import { enterRecovery, updateRecovery, updateStuckState } from './ai/BotRecoveryOps.js';
import { composeProbeDirection, scanProbeRay, scoreProbe } from './ai/BotProbeOps.js';
import { estimateExitSafety, evaluatePortalIntent } from './ai/BotPortalOps.js';
import { senseProjectiles, senseHeight, senseBotSpacing, evaluatePursuit } from './ai/BotThreatOps.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

const MAP_BEHAVIOR = {
    standard: { caution: 0.0, portalBias: 0.0, aggressionBias: 0.0 },
    empty: { caution: -0.12, portalBias: -0.08, aggressionBias: 0.16 },
    maze: { caution: 0.22, portalBias: 0.06, aggressionBias: -0.1 },
    complex: { caution: 0.16, portalBias: 0.08, aggressionBias: -0.04 },
    pyramid: { caution: 0.08, portalBias: 0.12, aggressionBias: 0.03 },
};

const BOT_COLLISION_CACHE_POS_SCALE = 32;
const BOT_COLLISION_CACHE_RADIUS_SCALE = 64;

// Phase 3: Kontextsensitive Item-Regeln (emergencyScale + combatSelf)
const ITEM_RULES = {
    SPEED_UP: { self: 0.8, offense: 0.2, defensiveScale: 0.5, emergencyScale: 0.1, combatSelf: 0.2 },
    SLOW_DOWN: { self: -0.8, offense: 0.9, defensiveScale: 0.1, emergencyScale: 0.0, combatSelf: -0.3 },
    THICK: { self: 0.9, offense: 0.1, defensiveScale: 0.8, emergencyScale: 0.2, combatSelf: 0.4 },
    THIN: { self: -0.6, offense: 0.7, defensiveScale: 0.2, emergencyScale: 0.0, combatSelf: -0.2 },
    SHIELD: { self: 0.5, offense: 0.0, defensiveScale: 1.2, emergencyScale: 2.5, combatSelf: 0.8 },
    SLOW_TIME: { self: 0.7, offense: 0.35, defensiveScale: 0.6, emergencyScale: 0.4, combatSelf: 0.3 },
    GHOST: { self: 0.95, offense: 0.1, defensiveScale: 1.0, emergencyScale: 2.0, combatSelf: 0.5 },
    INVERT: { self: -0.7, offense: 0.85, defensiveScale: 0.15, emergencyScale: 0.0, combatSelf: -0.4 },
};

function createProbe(name, yaw, pitch, weight = 0) {
    return {
        name,
        yaw,
        pitch,
        weight,
        dir: new THREE.Vector3(),
        risk: 999,
        wallDist: 0,
        trailDist: 0,
        clearance: 0,
        immediateDanger: false,
    };
}

export class BotAI {
    constructor(options = {}) {
        this.recorder = options.recorder || null;

        this.currentInput = {
            pitchUp: false,
            pitchDown: false,
            yawLeft: false,
            yawRight: false,
            rollLeft: false,
            rollRight: false,
            boost: false,
            cameraSwitch: false,
            dropItem: false,
            shootItem: false,
            shootMG: false,
            shootItemIndex: -1,
            nextItem: false,
            useItem: -1,
        };

        this.reactionTimer = 0;
        this._profileName = 'NORMAL';
        this.profile = null;

        this._decision = {
            yaw: 0,
            pitch: 0,
            boost: false,
            useItem: -1,
            shootItem: false,
            shootItemIndex: -1,
        };

        this.state = {
            turnCommitTimer: 0,
            committedYaw: 0,
            committedPitch: 0,

            recoveryActive: false,
            recoveryTimer: 0,
            recoveryCooldown: 0,
            recoveryYaw: 0,
            recoveryPitch: 0,
            recoverySwitchUsed: false,

            targetPlayer: null,
            targetRefreshTimer: 0,
            itemUseCooldown: 0,
            itemShootCooldown: 0,

            portalIntentActive: false,
            portalIntentTimer: 0,
            portalIntentScore: 0,
            portalEntryDistanceSq: Infinity,
        };

        this.sense = {
            lookAhead: 0,
            forwardRisk: 1,
            bestProbe: null,
            targetDistanceSq: Infinity,
            targetInFront: false,
            immediateDanger: false,
            pressure: 0,
            localOpenness: 0,
            mapCaution: 0,
            mapPortalBias: 0,
            mapAggressionBias: 0,
            projectileThreat: false,
            projectileEvadeYaw: 0,
            projectileEvadePitch: 0,
            heightBias: 0,
            botRepulsionYaw: 0,
            botRepulsionPitch: 0,
            pursuitActive: false,
            pursuitYaw: 0,
            pursuitPitch: 0,
            pursuitAimDot: 0,
        };

        this._checkStuckTimer = 0;
        this._stuckScore = 0;
        this._recentBouncePressure = 0;
        this._bounceStreak = 0;
        this._bounceStreakTimer = 0;
        this._recoveryChainCount = 0;
        this._recoveryChainTimer = 0;
        this._lastRecoveryReason = '';
        this._lastRecoveryYaw = 0;
        this._hasPositionSample = false;
        this._lastPos = new THREE.Vector3();
        this._lastCollisionNormal = new THREE.Vector3();
        this._hasCollisionNormal = false;

        this._portalEntry = new THREE.Vector3();
        this._portalExit = new THREE.Vector3();
        this._portalTarget = null;

        this._tmpForward = new THREE.Vector3();
        this._tmpRight = new THREE.Vector3();
        this._tmpUp = new THREE.Vector3();
        this._tmpVec = new THREE.Vector3();
        this._tmpVec2 = new THREE.Vector3();
        this._tmpVec3 = new THREE.Vector3();

        // Phase 1: Erweiterte Probes (12 statt 7)
        this._probes = [
            createProbe('forward', 0, 0, 0),
            createProbe('left', -1.0, 0, 0.02),
            createProbe('right', 1.0, 0, 0.02),
            createProbe('leftWide', -1.8, 0, 0.07),
            createProbe('rightWide', 1.8, 0, 0.07),
            createProbe('up', 0, 0.9, 0.08),
            createProbe('down', 0, -0.9, 0.08),
            // Neue diagonale Probes
            createProbe('upLeft', -0.7, 0.7, 0.10),
            createProbe('upRight', 0.7, 0.7, 0.10),
            createProbe('downLeft', -0.7, -0.7, 0.10),
            createProbe('downRight', 0.7, -0.7, 0.10),
            // Backward-Probe fÃ¼r RÃ¼ckwÃ¤rtserkennung
            createProbe('backward', 3.14, 0, 0.25),
        ];

        this._collisionCache = new Map();
        this._lastSensePos = new THREE.Vector3();
        this._probeRayCenter = { wallDist: 0, trailDist: 0, immediateDanger: false };
        this._probeRayLeft = { wallDist: 0, trailDist: 0, immediateDanger: false };
        this._probeRayRight = { wallDist: 0, trailDist: 0, immediateDanger: false };

        // Time-Slicing: Sensor-Scans auf verschiedene Frames verteilen
        this._sensePhase = 0;         // Frame-Slot dieses Bots (0..3), von EntityManager gesetzt
        this._sensePhaseCounter = 0;  // Hochzaehlender Frame-Zaehler

        this._setDifficulty(options.difficulty || CONFIG.BOT.ACTIVE_DIFFICULTY || CONFIG.BOT.DEFAULT_DIFFICULTY || 'NORMAL');
        this._checkStuckTimer = this.profile.stuckCheckInterval;
    }

    _setDifficulty(profileName) {
        const profiles = CONFIG.BOT.DIFFICULTY_PROFILES || {};
        const upper = typeof profileName === 'string' ? profileName.toUpperCase() : 'NORMAL';
        this._profileName = profiles[upper] ? upper : 'NORMAL';

        const fallback = {
            reactionTime: CONFIG.BOT.REACTION_TIME || 0.15,
            lookAhead: CONFIG.BOT.LOOK_AHEAD || 12,
            aggression: CONFIG.BOT.AGGRESSION || 0.5,
            errorRate: 0,
            probeSpread: 0.7,
            probeStep: 2,
            turnCommitTime: 0.25,
            stuckCheckInterval: 0.4,
            stuckTriggerTime: 1.6,
            minProgressDistance: 0.9,
            minForwardProgress: 0.45,
            recoveryDuration: 1.0,
            recoveryCooldown: 1.5,
            itemUseCooldown: 1.0,
            itemShootCooldown: 0.6,
            targetRefreshInterval: 0.2,
            portalInterest: 0.5,
            portalSeekDistance: 70,
            portalEntryDotMin: 0.3,
            portalIntentThreshold: 0.2,
            portalIntentDuration: 1.0,
            boostChance: 0.004,
        };

        this.profile = { ...fallback, ...(profiles[this._profileName] || {}) };
    }

    setDifficulty(profileName) {
        this._setDifficulty(profileName);
        this.reactionTimer = 0;
        this.state.turnCommitTimer = 0;
        this.state.recoveryActive = false;
    }

    onBounce(type, normal = null) {
        const pressure = type === 'TRAIL' ? 1.3 : 0.9;
        this._recentBouncePressure = Math.min(4, this._recentBouncePressure + pressure);
        if (type === 'TRAIL' || type === 'WALL') {
            this._bounceStreak = Math.min(8, this._bounceStreak + 1);
            this._bounceStreakTimer = 1.25;
        }
        if (normal) {
            this._lastCollisionNormal.copy(normal).normalize();
            this._hasCollisionNormal = true;
        }
    }

    _resetInput(input) {
        input.pitchUp = false;
        input.pitchDown = false;
        input.yawLeft = false;
        input.yawRight = false;
        input.rollLeft = false;
        input.rollRight = false;
        input.boost = false;
        input.cameraSwitch = false;
        input.dropItem = false;
        input.shootItem = false;
        input.shootMG = false;
        input.shootItemIndex = -1;
        input.nextItem = false;
        input.useItem = -1;
    }

    _resetDecision() {
        this._decision.yaw = 0;
        this._decision.pitch = 0;
        this._decision.boost = false;
        this._decision.useItem = -1;
        this._decision.shootItem = false;
        this._decision.shootItemIndex = -1;
    }

    _buildBasis(forward) {
        this._tmpRight.crossVectors(WORLD_UP, forward);
        if (this._tmpRight.lengthSq() < 0.000001) {
            this._tmpRight.set(1, 0, 0);
        } else {
            this._tmpRight.normalize();
        }
        this._tmpUp.crossVectors(forward, this._tmpRight).normalize();
    }

    _updateTimers(dt) {
        this.reactionTimer -= dt;
        this._checkStuckTimer -= dt;
        this._recentBouncePressure = Math.max(0, this._recentBouncePressure - dt * 1.35);
        this._bounceStreakTimer = Math.max(0, this._bounceStreakTimer - dt);
        if (this._bounceStreakTimer === 0) {
            this._bounceStreak = 0;
        }
        this._recoveryChainTimer = Math.max(0, this._recoveryChainTimer - dt);
        if (this._recoveryChainTimer === 0) {
            this._recoveryChainCount = 0;
            this._lastRecoveryReason = '';
        }

        this.state.turnCommitTimer = Math.max(0, this.state.turnCommitTimer - dt);
        this.state.recoveryCooldown = Math.max(0, this.state.recoveryCooldown - dt);
        this.state.targetRefreshTimer = Math.max(0, this.state.targetRefreshTimer - dt);
        this.state.itemUseCooldown = Math.max(0, this.state.itemUseCooldown - dt);
        this.state.itemShootCooldown = Math.max(0, this.state.itemShootCooldown - dt);
        this.state.portalIntentTimer = Math.max(0, this.state.portalIntentTimer - dt);

        if (this.state.portalIntentTimer === 0) {
            this.state.portalIntentActive = false;
            this.state.portalIntentScore = 0;
            this._portalTarget = null;
        }
    }

    _selectTarget(player, allPlayers) {
        selectTarget(this, player, allPlayers);
    }

    _estimateEnemyPressure(position, owner, allPlayers) {
        return estimateEnemyPressure(this, position, owner, allPlayers);
    }

    _estimatePointRisk(point, player, arena, allPlayers) {
        return estimatePointRisk(this, point, player, arena, allPlayers);
    }

    _updateStuckState(player, arena, allPlayers) {
        updateStuckState(this, player, arena, allPlayers);
    }

    _enterRecovery(player, arena, allPlayers, reason) {
        enterRecovery(this, player, arena, allPlayers, reason);
    }

    _updateRecovery(dt, player, arena, allPlayers) {
        return updateRecovery(this, dt, player, arena, allPlayers);
    }

    _computeDynamicLookAhead(player) {
        const base = this.profile.lookAhead;
        const speedRatio = player.baseSpeed > 0 ? player.speed / player.baseSpeed : 1;
        let lookAhead = base * (1 + (speedRatio - 1) * 0.75);
        if (player.isBoosting) lookAhead *= 1.2;
        return Math.max(8, lookAhead);
    }

    _mapBehavior(arena) {
        const mapKey = arena.currentMapKey || 'standard';
        return MAP_BEHAVIOR[mapKey] || MAP_BEHAVIOR.standard;
    }

    _composeProbeDirection(forward, right, up, probe) {
        composeProbeDirection(this, forward, right, up, probe);
    }

    _buildCollisionMemoKey(position, radius, excludePlayerIndex, skipRecent) {
        const qx = Math.round(position.x * BOT_COLLISION_CACHE_POS_SCALE);
        const qy = Math.round(position.y * BOT_COLLISION_CACHE_POS_SCALE);
        const qz = Math.round(position.z * BOT_COLLISION_CACHE_POS_SCALE);
        const qr = Math.round(radius * BOT_COLLISION_CACHE_RADIUS_SCALE);

        let hash = 2166136261;
        hash = Math.imul(hash ^ qx, 16777619);
        hash = Math.imul(hash ^ qy, 16777619);
        hash = Math.imul(hash ^ qz, 16777619);
        hash = Math.imul(hash ^ qr, 16777619);
        hash = Math.imul(hash ^ (excludePlayerIndex + 2048), 16777619);
        hash = Math.imul(hash ^ skipRecent, 16777619);
        return hash >>> 0;
    }

    _getCollisionMemoized(entityManager, position, radius, excludePlayerIndex, skipRecent, playerRef) {
        const key = this._buildCollisionMemoKey(position, radius, excludePlayerIndex, skipRecent);
        const cached = this._collisionCache.get(key);
        if (cached !== undefined) {
            return cached === 1;
        }

        const hit = entityManager.checkGlobalCollision(position, radius, excludePlayerIndex, skipRecent, playerRef);
        const hasHit = !!(hit && hit.hit);
        this._collisionCache.set(key, hasHit ? 1 : 0);
        return hasHit;
    }

    _checkTrailHit(position, player, allPlayers, radius = player.hitboxRadius * 1.6, skipRecent = 20) {
        const entityManager = player?.trail?.entityManager;
        if (!entityManager) return false;
        return this._getCollisionMemoized(entityManager, position, radius, player.index, skipRecent, player);
    }

    _scanProbeRay(player, arena, allPlayers, direction, lookAhead, step, out) {
        scanProbeRay(this, player, arena, allPlayers, direction, lookAhead, step, out);
    }

    _scoreProbe(player, arena, allPlayers, probe, lookAhead) {
        scoreProbe(this, player, arena, allPlayers, probe, lookAhead);
    }

    // ================================================================
    // Phase 7: Portal-Exit-Safety â€” prÃ¼fe 4 Richtungen am Exit
    // ================================================================
    _estimateExitSafety(exit, arena, player, allPlayers) {
        return estimateExitSafety(this, exit, arena, player, allPlayers);
    }

    // ================================================================
    // ================================================================
    _senseProjectiles(player, projectiles) {
        senseProjectiles(this, player, projectiles);
    }

    // ================================================================
    // ================================================================
    _senseHeight(player, arena) {
        senseHeight(this, player, arena);
    }

    // ================================================================
    // ================================================================
    _senseBotSpacing(player, allPlayers) {
        senseBotSpacing(this, player, allPlayers);
    }

    // ================================================================
    // ================================================================
    _evaluatePursuit(player) {
        evaluatePursuit(this, player);
    }

    _evaluatePortalIntent(player, arena, allPlayers) {
        evaluatePortalIntent(this, player, arena, allPlayers);
    }

    update(dt, player, arena, allPlayers, projectiles) {
        const activeDifficulty = CONFIG.BOT.ACTIVE_DIFFICULTY || this._profileName;
        if (activeDifficulty !== this._profileName) {
            this._setDifficulty(activeDifficulty);
        }

        this._updateTimers(dt);
        updateStuckState(this, player, arena, allPlayers);

        if (this.state.recoveryActive) {
            if (updateRecovery(this, dt, player, arena, allPlayers)) {
                return this.currentInput;
            }
        }

        if (this.reactionTimer > 0) {
            return this.currentInput;
        }

        const jitter = 1 + (Math.random() * 2 - 1) * this.profile.errorRate * 0.2;
        this.reactionTimer = Math.max(0.02, this.profile.reactionTime * jitter);

        this._resetDecision();
        runPerception(this, player, arena, allPlayers, projectiles);
        if (runDecision(this, dt, player, arena, allPlayers, ITEM_RULES)) {
            return this.currentInput;
        }

        return runAction(this);
    }
}
