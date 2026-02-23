// ============================================
// RoundEndCoordinator.js - round-end side effects + controller plan orchestration
// ============================================

import { deriveRoundEndOverlayUiState } from './MatchUiStateOps.js';

function getSafeLogger(logger) {
    return logger && typeof logger.log === 'function' ? logger : console;
}

export function finalizeRoundRecording({ recorder, winner, players, logger = console }) {
    const safeLogger = getSafeLogger(logger);
    safeLogger.log('--- ROUND END ---');

    try {
        const roundMetrics = recorder?.finalizeRound?.(winner, players);
        if (roundMetrics) {
            safeLogger.log('[Recorder] Round KPI:', roundMetrics);
        }
        recorder?.dump?.();
        return { ok: true, roundMetrics };
    } catch (error) {
        if (typeof safeLogger.error === 'function') {
            safeLogger.error('Recorder Dump Failed:', error);
        }
        return { ok: false, error };
    }
}

export function applyRoundEndWinnerScore(winner) {
    if (!winner) return { scored: false, score: null };
    winner.score = (Number(winner.score) || 0) + 1;
    return { scored: true, score: winner.score };
}

export function buildRoundEndControllerInputs(inputs = {}) {
    return {
        winner: inputs.winner || null,
        humanPlayerCount: Math.max(0, Number(inputs.humanPlayerCount) || 0),
        totalBots: Math.max(0, Number(inputs.totalBots) || 0),
        winsNeeded: Math.max(1, Number(inputs.winsNeeded) || 1),
    };
}

export function deriveOnRoundEndCoordinatorPlan({ roundStateController, players, inputs }) {
    return roundStateController.deriveOnRoundEndPlan(players, buildRoundEndControllerInputs(inputs));
}

export function deriveRoundEndCoordinatorUiState(plan = {}) {
    return deriveRoundEndOverlayUiState({
        messageText: plan?.transition?.overlayMessageText || '',
        messageSub: plan?.transition?.overlayMessageSub || '',
    });
}

export function deriveRoundEndCoordinatorEffectsPlan() {
    return {
        shouldUpdateHud: true,
        reason: 'ROUND_END',
    };
}

export function coordinateRoundEnd({
    recorder,
    winner,
    players,
    roundStateController,
    humanPlayerCount,
    totalBots,
    winsNeeded,
    logger = console,
}) {
    const recording = finalizeRoundRecording({ recorder, winner, players, logger });
    const score = applyRoundEndWinnerScore(winner);
    const plan = deriveOnRoundEndCoordinatorPlan({
        roundStateController,
        players,
        inputs: { winner, humanPlayerCount, totalBots, winsNeeded },
    });
    const uiState = deriveRoundEndCoordinatorUiState(plan);
    const effectsPlan = deriveRoundEndCoordinatorEffectsPlan();
    return {
        recording,
        score,
        effectsPlan,
        uiState,
        ...plan,
    };
}
