// ============================================
// MatchUiStateOps.js - pure match UI state helpers
// ============================================

export function deriveMatchStartUiState(inputs = {}) {
    const numHumans = Math.max(0, Number(inputs.numHumans) || 0);
    const isTwoPlayer = numHumans === 2;

    return {
        splitScreenEnabled: isTwoPlayer,
        p2HudVisible: isTwoPlayer,
        visibility: {
            mainMenuHidden: true,
            hudHidden: false,
            messageOverlayHidden: true,
            statusToastHidden: true,
        },
    };
}

export function deriveReturnToMenuUiState() {
    return {
        visibility: {
            mainMenuHidden: false,
            hudHidden: true,
            messageOverlayHidden: true,
            statusToastHidden: true,
        },
    };
}

export function deriveRoundStartUiState() {
    return {
        visibility: {
            messageOverlayHidden: true,
            statusToastHidden: true,
        },
    };
}

export function deriveRoundEndOverlayUiState(roundEndOutcome = {}) {
    return {
        messageText: String(roundEndOutcome.messageText || ''),
        messageSub: String(roundEndOutcome.messageSub || ''),
        visibility: {
            messageOverlayHidden: false,
        },
    };
}

export function deriveRoundEndCountdownUiState(roundPause) {
    const countdown = Math.ceil(Number(roundPause) || 0);
    if (countdown <= 0) {
        return null;
    }
    return {
        messageSub: `Naechste Runde in ${countdown}...`,
    };
}
