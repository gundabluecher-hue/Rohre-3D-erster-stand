// ============================================
// Bot.js - AI opponent logic
// ============================================

import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { runDecision } from './ai/BotDecisionOps.js';
import { runAction } from './ai/BotActionOps.js';
import { estimateEnemyPressure, estimatePointRisk, selectTarget } from './ai/BotTargetingOps.js';
import { enterRecovery, updateRecovery, updateStuckState } from './ai/BotRecoveryOps.js';
import { BotSensors } from './ai/BotSensors.js';
import { BotSensorsFacade } from './ai/BotSensorsFacade.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

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

        this.sensors = new BotSensors();
        this.sensorsFacade = this.sensors.facade instanceof BotSensorsFacade
            ? this.sensors.facade.bindRuntime(this)
            : new BotSensorsFacade(this.sensors).bindRuntime(this);
        this.sense = this.sensors.sense;
        this._probes = this.sensors._probes;
        this._collisionCache = this.sensors._collisionCache;
        this._probeRayCenter = this.sensors._probeRayCenter;
        this._probeRayLeft = this.sensors._probeRayLeft;
        this._probeRayRight = this.sensors._probeRayRight;

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

    _mapBehavior(arena) {
        this.sensorsFacade.bindRuntime(this);
        return this.sensorsFacade.mapBehavior(arena);
    }

    _scoreProbe(player, arena, allPlayers, probe, lookAhead) {
        this.sensorsFacade.bindRuntime(this);
        this.sensorsFacade.scoreProbe(player, arena, allPlayers, probe, lookAhead);
    }

    checkTrailHit(position, player, allPlayers, radius = player.hitboxRadius * 1.6, skipRecent = 20) {
        this.sensorsFacade.bindRuntime(this);
        return this.sensorsFacade.checkTrailHit(position, player, allPlayers, radius, skipRecent);
    }

    _checkTrailHit(position, player, allPlayers, radius = player.hitboxRadius * 1.6, skipRecent = 20) {
        return this.checkTrailHit(position, player, allPlayers, radius, skipRecent);
    }

    setSensePhase(phase) {
        this.sensorsFacade.setSensePhase(phase);
    }

    getSensorSnapshot() {
        this.sensorsFacade.bindRuntime(this);
        return this.sensorsFacade.getSensorSnapshot();
    }

    getSensorArray() {
        this.sensorsFacade.bindRuntime(this);
        return this.sensorsFacade.getSensorArray();
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
        this.sensorsFacade.bindRuntime(this);
        this.sensors.update(this, player, arena, allPlayers, projectiles);
        if (runDecision(this, dt, player, arena, allPlayers, ITEM_RULES)) {
            return this.currentInput;
        }

        return runAction(this);
    }
}
