// ============================================
// RoundStateTickSystem.js - round/match-end tick orchestration
// ============================================

import { deriveRoundEndCountdownUiState } from '../ui/MatchUiStateOps.js';

export class RoundStateTickSystem {
    constructor(game) {
        this.game = game;
    }

    _executeRoundStateTickAction(action) {
        const game = this.game;
        if (action === 'RETURN_TO_MENU') {
            game.matchFlowUiController.returnToMenu();
            return true;
        }
        if (action === 'START_ROUND') {
            game.matchFlowUiController.startRound();
            return true;
        }
        if (action === 'RESTART_MATCH') {
            game.startMatch();
            return true;
        }
        return false;
    }

    _readRoundEndTickInputs(dt) {
        const game = this.game;
        return {
            dt,
            roundPause: game.roundPause,
            enterPressed: game.input.wasPressed('Enter'),
            escapePressed: game.input.wasPressed('Escape'),
        };
    }

    _readMatchEndTickInputs() {
        const game = this.game;
        return {
            enterPressed: game.input.wasPressed('Enter'),
            escapePressed: game.input.wasPressed('Escape'),
        };
    }

    _deriveRoundEndTickStep(dt) {
        return this.game.roundStateController.deriveRoundEndTick(this._readRoundEndTickInputs(dt));
    }

    _deriveMatchEndTickStep() {
        return this.game.roundStateController.deriveMatchEndTick(this._readMatchEndTickInputs());
    }

    _applyRoundEndTickUi(roundEndTick) {
        if (!roundEndTick.countdownMessageSub) return;
        this.game.matchFlowUiController.applyMatchUiState(
            deriveRoundEndCountdownUiState(this.game.roundPause)
        );
    }

    _applyRoundEndTickMutableState(roundEndTick) {
        this.game.roundPause = roundEndTick.nextRoundPause;
        this._applyRoundEndTickUi(roundEndTick);
    }

    _updateRoundStateCamerasIfNeeded(dt, shouldUpdateCameras) {
        if (!shouldUpdateCameras) return;
        this.game.entityManager.updateCameras(dt);
    }

    _runRoundStateTickStepCore(tickStep, dt, hooks = {}) {
        if (typeof hooks.beforeBase === 'function') {
            const shouldStop = hooks.beforeBase(tickStep);
            if (shouldStop) return true;
        }
        if (tickStep.action === 'RETURN_TO_MENU' && this._executeRoundStateTickAction(tickStep.action)) {
            return true;
        }
        this._updateRoundStateCamerasIfNeeded(dt, tickStep.shouldUpdateCameras);
        if (typeof hooks.afterBase === 'function') {
            const shouldStop = hooks.afterBase(tickStep);
            if (shouldStop) return true;
        }
        return false;
    }

    _applyRoundEndTickStep(roundEndTick, dt) {
        this._applyRoundEndTickMutableState(roundEndTick);
        return this._runRoundStateTickStepCore(roundEndTick, dt, {
            afterBase: (tickStep) => {
                this._executeRoundStateTickAction(tickStep.action);
                return false;
            },
        });
    }

    _applyMatchEndTickStep(matchEndTick, dt) {
        return this._runRoundStateTickStepCore(matchEndTick, dt, {
            beforeBase: (tickStep) => {
                if (tickStep.action === 'RESTART_MATCH') {
                    this._executeRoundStateTickAction(tickStep.action);
                }
                return false;
            },
        });
    }

    _runRoundStateTickUpdate(dt, deriveTickStep, applyTickStep) {
        const tickStep = deriveTickStep.call(this, dt);
        return !!applyTickStep.call(this, tickStep, dt);
    }

    _buildRoundEndStateTickDescriptor() {
        return {
            deriveTickStep: this._deriveRoundEndTickStep,
            applyTickStep: this._applyRoundEndTickStep,
        };
    }

    _buildMatchEndStateTickDescriptor() {
        return {
            deriveTickStep: this._deriveMatchEndTickStep,
            applyTickStep: this._applyMatchEndTickStep,
        };
    }

    _runRoundStateTickDescriptor(dt, descriptor) {
        if (!descriptor) return false;
        return this._runRoundStateTickUpdate(dt, descriptor.deriveTickStep, descriptor.applyTickStep);
    }

    updateRoundEnd(dt) {
        const descriptor = this._buildRoundEndStateTickDescriptor();
        this._runRoundStateTickDescriptor(dt, descriptor);
    }

    updateMatchEnd(dt) {
        const descriptor = this._buildMatchEndStateTickDescriptor();
        this._runRoundStateTickDescriptor(dt, descriptor);
    }
}
