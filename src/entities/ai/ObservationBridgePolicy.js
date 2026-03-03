// ============================================
// ObservationBridgePolicy.js - bridge policy shell with resilient local fallback
// ============================================

import { createNeutralBotAction, sanitizeBotAction } from './actions/BotActionContract.js';
import { BOT_POLICY_TYPES, normalizeBotPolicyType } from './BotPolicyTypes.js';

function isRuntimeContextPayload(value) {
    return !!(
        value
        && typeof value === 'object'
        && ('arena' in value || 'players' in value || 'projectiles' in value || 'observation' in value)
    );
}

function createRuntimeContextFromLegacyArgs(player, arena, allPlayers, projectiles, dt) {
    return {
        dt: Number.isFinite(dt) ? dt : 0,
        player: player || null,
        arena: arena || null,
        players: Array.isArray(allPlayers) ? allPlayers : [],
        projectiles: Array.isArray(projectiles) ? projectiles : [],
        observation: null,
    };
}

export class ObservationBridgePolicy {
    constructor(options = {}) {
        this.type = normalizeBotPolicyType(options.type || BOT_POLICY_TYPES.CLASSIC_BRIDGE);
        this.usesRuntimeContext = true;
        this._fallbackPolicy = options.fallbackPolicy || null;
        this._resolveAction = typeof options.resolveAction === 'function' ? options.resolveAction : null;
        this._resolveObservation = typeof options.resolveObservation === 'function' ? options.resolveObservation : null;
        this._warningCooldownMs = 2000;
        this._lastWarningAt = 0;
        this._neutralAction = createNeutralBotAction({});
    }

    _warn(message, error = null) {
        const now = Date.now();
        if (now - this._lastWarningAt < this._warningCooldownMs) return;
        this._lastWarningAt = now;
        const errorMessage = error ? ` (${error.message || String(error)})` : '';
        console.warn(`[ObservationBridgePolicy] ${this.type}: ${message}${errorMessage}`);
    }

    _asRuntimeContext(dt, player, runtimeContextOrArena, allPlayers, projectiles) {
        if (isRuntimeContextPayload(runtimeContextOrArena)) {
            const context = runtimeContextOrArena;
            if (!Array.isArray(context.players)) context.players = [];
            if (!Array.isArray(context.projectiles)) context.projectiles = [];
            if (!context.player) context.player = player || null;
            if (!Number.isFinite(context.dt)) context.dt = Number.isFinite(dt) ? dt : 0;
            return context;
        }
        return createRuntimeContextFromLegacyArgs(player, runtimeContextOrArena, allPlayers, projectiles, dt);
    }

    _delegateFallbackUpdate(dt, player, runtimeContext) {
        const fallbackUpdate = this._fallbackPolicy?.update;
        if (typeof fallbackUpdate !== 'function') {
            return this._neutralAction;
        }

        try {
            if (this._fallbackPolicy.usesRuntimeContext === true || fallbackUpdate.length <= 3) {
                return fallbackUpdate.call(this._fallbackPolicy, dt, player, runtimeContext);
            }
            return fallbackUpdate.call(
                this._fallbackPolicy,
                dt,
                player,
                runtimeContext.arena,
                runtimeContext.players,
                runtimeContext.projectiles
            );
        } catch (error) {
            this._warn('fallback policy update failed', error);
            return this._neutralAction;
        }
    }

    _sanitizeAction(action, player) {
        return sanitizeBotAction(action, {
            inventoryLength: Array.isArray(player?.inventory) ? player.inventory.length : 0,
            onInvalid: (reason) => this._warn(`sanitized invalid action (${reason})`),
        }, this._neutralAction);
    }

    getObservation(player, runtimeContext) {
        if (typeof this._resolveObservation === 'function') {
            try {
                return this._resolveObservation(player, runtimeContext);
            } catch (error) {
                this._warn('resolveObservation failed', error);
            }
        }
        if (typeof this._fallbackPolicy?.getObservation === 'function') {
            try {
                return this._fallbackPolicy.getObservation(player, runtimeContext);
            } catch (error) {
                this._warn('fallback getObservation failed', error);
            }
        }
        return runtimeContext?.observation || null;
    }

    update(dt, player, runtimeContextOrArena, allPlayers = null, projectiles = null) {
        const runtimeContext = this._asRuntimeContext(dt, player, runtimeContextOrArena, allPlayers, projectiles);
        if (runtimeContext.observation == null) {
            runtimeContext.observation = this.getObservation(player, runtimeContext);
        }

        if (typeof this._resolveAction === 'function') {
            try {
                const action = this._resolveAction(runtimeContext, player, dt);
                if (action && typeof action === 'object') {
                    return this._sanitizeAction(action, player);
                }
                this._warn('resolveAction returned no action payload, using fallback');
            } catch (error) {
                this._warn('resolveAction failed, using fallback', error);
            }
        }

        const fallbackAction = this._delegateFallbackUpdate(dt, player, runtimeContext);
        return this._sanitizeAction(fallbackAction, player);
    }

    reset() {
        if (typeof this._fallbackPolicy?.reset === 'function') {
            this._fallbackPolicy.reset();
        }
    }

    setDifficulty(profileName) {
        if (typeof this._fallbackPolicy?.setDifficulty === 'function') {
            this._fallbackPolicy.setDifficulty(profileName);
        }
    }

    onBounce(type, normal = null) {
        if (typeof this._fallbackPolicy?.onBounce === 'function') {
            this._fallbackPolicy.onBounce(type, normal);
        }
    }

    setSensePhase(phase) {
        if (typeof this._fallbackPolicy?.setSensePhase === 'function') {
            this._fallbackPolicy.setSensePhase(phase);
        }
    }
}
