export const GAME_MODE_TYPES = Object.freeze({
    CLASSIC: 'CLASSIC',
    HUNT: 'HUNT',
});

export function normalizeGameMode(mode, fallback = GAME_MODE_TYPES.CLASSIC) {
    const raw = String(mode || '').trim().toUpperCase();
    if (raw === GAME_MODE_TYPES.HUNT) return GAME_MODE_TYPES.HUNT;
    if (raw === GAME_MODE_TYPES.CLASSIC) return GAME_MODE_TYPES.CLASSIC;
    return fallback;
}

export function resolveActiveGameMode(requestedMode, isHuntEnabled = true) {
    const normalized = normalizeGameMode(requestedMode);
    if (!isHuntEnabled && normalized === GAME_MODE_TYPES.HUNT) {
        return GAME_MODE_TYPES.CLASSIC;
    }
    return normalized;
}

export function isHuntMode(mode, isHuntEnabled = true) {
    return resolveActiveGameMode(mode, isHuntEnabled) === GAME_MODE_TYPES.HUNT;
}
