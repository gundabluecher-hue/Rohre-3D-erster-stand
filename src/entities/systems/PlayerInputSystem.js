// ============================================
// PlayerInputSystem.js - resolves human and bot player input
// ============================================

import { sanitizeBotAction } from '../ai/actions/BotActionContract.js';
import { createBotRuntimeContext } from '../ai/BotRuntimeContextFactory.js';
import { buildObservation } from '../ai/observation/ObservationSystem.js';

// Reused input object to reduce GC
const SHARED_EMPTY_INPUT = {
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

function getEmptyInput() {
    SHARED_EMPTY_INPUT.pitchUp = false;
    SHARED_EMPTY_INPUT.pitchDown = false;
    SHARED_EMPTY_INPUT.yawLeft = false;
    SHARED_EMPTY_INPUT.yawRight = false;
    SHARED_EMPTY_INPUT.rollLeft = false;
    SHARED_EMPTY_INPUT.rollRight = false;
    SHARED_EMPTY_INPUT.boost = false;
    SHARED_EMPTY_INPUT.cameraSwitch = false;
    SHARED_EMPTY_INPUT.dropItem = false;
    SHARED_EMPTY_INPUT.shootItem = false;
    SHARED_EMPTY_INPUT.shootMG = false;
    SHARED_EMPTY_INPUT.shootItemIndex = -1;
    SHARED_EMPTY_INPUT.nextItem = false;
    SHARED_EMPTY_INPUT.useItem = -1;
    return SHARED_EMPTY_INPUT;
}

export class PlayerInputSystem {
    constructor(entityManager) {
        this.entityManager = entityManager;
        this._botActionWarningCooldownMs = 2000;
        this._botActionWarnings = new Map();
        this._botObservationWarningCooldownMs = 3000;
        this._botObservationWarnings = new Map();
        this._lastBotObservationByIndex = new Map();
    }

    _warnInvalidBotAction(player, reason, error = null) {
        const playerIndex = Number.isInteger(player?.index) ? player.index : -1;
        const now = Date.now();
        const lastWarning = this._botActionWarnings.get(playerIndex) || 0;
        if (now - lastWarning < this._botActionWarningCooldownMs) return;
        this._botActionWarnings.set(playerIndex, now);
        const errorMessage = error ? ` (${error.message || String(error)})` : '';
        console.warn(`[BotActionContract] Sanitized invalid action for bot index ${playerIndex}: ${reason}${errorMessage}`);
    }

    _warnInvalidBotObservation(player, reason, error = null) {
        const playerIndex = Number.isInteger(player?.index) ? player.index : -1;
        const now = Date.now();
        const lastWarning = this._botObservationWarnings.get(playerIndex) || 0;
        if (now - lastWarning < this._botObservationWarningCooldownMs) return;
        this._botObservationWarnings.set(playerIndex, now);
        const errorMessage = error ? ` (${error.message || String(error)})` : '';
        console.warn(`[ObservationSystem] Fallback observation for bot index ${playerIndex}: ${reason}${errorMessage}`);
    }

    _resolveRuntimeContext(player, dt, entityManager) {
        if (typeof entityManager?.createBotRuntimeContext === 'function') {
            return entityManager.createBotRuntimeContext(player, dt);
        }
        return createBotRuntimeContext(entityManager, player, dt);
    }

    _buildBotObservation(player, policy, runtimeContext) {
        const observationContext = runtimeContext?.observationContext || runtimeContext;
        if (typeof policy?.getObservation === 'function') {
            try {
                const customObservation = policy.getObservation(player, runtimeContext);
                if (
                    customObservation
                    && typeof customObservation.length === 'number'
                    && customObservation.length > 0
                ) {
                    return customObservation;
                }
                this._warnInvalidBotObservation(player, 'policy.getObservation returned empty payload');
            } catch (error) {
                this._warnInvalidBotObservation(player, 'policy.getObservation threw', error);
            }
        }
        return buildObservation(player, observationContext);
    }

    _invokeBotPolicyUpdate(policy, dt, player, runtimeContext) {
        const update = policy?.update;
        if (typeof update !== 'function') {
            return getEmptyInput();
        }

        const preferRuntimeContext = policy?.usesRuntimeContext === true || update.length <= 3;
        if (preferRuntimeContext) {
            try {
                return update.call(policy, dt, player, runtimeContext);
            } catch (error) {
                this._warnInvalidBotAction(player, 'runtime-context update threw, fallback to legacy signature', error);
            }
        }

        return update.call(
            policy,
            dt,
            player,
            runtimeContext?.arena,
            runtimeContext?.players,
            runtimeContext?.projectiles
        );
    }

    getLastBotObservation(playerIndex) {
        return this._lastBotObservationByIndex.get(playerIndex) || null;
    }

    resolvePlayerInput(player, dt, inputManager) {
        const entityManager = this.entityManager;
        let input = getEmptyInput();

        if (player.isBot) {
            const botAI = entityManager.botByPlayer.get(player);
            if (botAI) {
                const runtimeContext = this._resolveRuntimeContext(player, dt, entityManager);
                const observation = this._buildBotObservation(player, botAI, runtimeContext);
                runtimeContext.observation = observation;
                this._lastBotObservationByIndex.set(player.index, observation);

                const sanitizeOptions = {
                    inventoryLength: Array.isArray(player.inventory) ? player.inventory.length : 0,
                    onInvalid: (reason) => this._warnInvalidBotAction(player, reason),
                };
                try {
                    const output = this._invokeBotPolicyUpdate(botAI, dt, player, runtimeContext);
                    input = sanitizeBotAction(output, sanitizeOptions, input);
                } catch (error) {
                    this._warnInvalidBotAction(player, 'policy update threw', error);
                    input = getEmptyInput();
                }
            }
            return input;
        }

        const includeSecondaryBindings = entityManager.humanPlayers.length === 1 && player.index === 0;
        const inputState = inputManager.getPlayerInput(player.index, { includeSecondaryBindings });
        if (inputState) {
            input.pitchUp = inputState.pitchUp;
            input.pitchDown = inputState.pitchDown;
            input.yawLeft = inputState.yawLeft;
            input.yawRight = inputState.yawRight;
            input.rollLeft = inputState.rollLeft;
            input.rollRight = inputState.rollRight;
            input.boost = inputState.boost;
            input.cameraSwitch = inputState.cameraSwitch;
            input.dropItem = inputState.dropItem;
            input.shootItem = inputState.shootItem;
            input.shootMG = inputState.shootMG;
            input.nextItem = inputState.nextItem;

            if (input.shootItem && Array.isArray(player.inventory) && player.inventory.length > 0) {
                const selectedIndex = Number.isInteger(player.selectedItemIndex) ? player.selectedItemIndex : 0;
                input.shootItemIndex = Math.max(0, Math.min(selectedIndex, player.inventory.length - 1));
            }
        }

        if (input.cameraSwitch) {
            entityManager.renderer.cycleCamera(player.index);
            player.cameraMode = entityManager.renderer.cameraModes[player.index] || 0;
        }
        return input;
    }
}
