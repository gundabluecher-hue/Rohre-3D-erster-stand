// ============================================
// BotRuntimeContextFactory.js - centralized runtime context for bot policies
// ============================================

import { CONFIG } from '../../core/Config.js';
import { isHuntHealthActive } from '../../hunt/HealthSystem.js';
import { GAME_MODE_TYPES, normalizeGameMode } from '../../hunt/HuntMode.js';
import { createObservationContext } from './observation/ObservationSystem.js';

function resolveRuntimeMode(entityManager) {
    const requestedMode = entityManager?.activeGameMode
        || entityManager?.runtimeConfig?.session?.activeGameMode
        || CONFIG?.HUNT?.ACTIVE_MODE
        || GAME_MODE_TYPES.CLASSIC;
    const normalized = normalizeGameMode(requestedMode, GAME_MODE_TYPES.CLASSIC);
    if (normalized === GAME_MODE_TYPES.HUNT) {
        return GAME_MODE_TYPES.HUNT;
    }
    return isHuntHealthActive() ? GAME_MODE_TYPES.HUNT : GAME_MODE_TYPES.CLASSIC;
}

export function createBotRuntimeContext(entityManager, player, dt = 0) {
    const mode = resolveRuntimeMode(entityManager);
    const players = Array.isArray(entityManager?.players) ? entityManager.players : [];
    const projectiles = Array.isArray(entityManager?.projectiles) ? entityManager.projectiles : [];
    const planarMode = !!(entityManager?.runtimeConfig?.gameplay?.planarMode ?? CONFIG?.GAMEPLAY?.PLANAR_MODE);
    const rules = {
        planarMode,
        huntEnabled: mode === GAME_MODE_TYPES.HUNT || isHuntHealthActive(),
        portalsEnabled: !!entityManager?.arena?.portalsEnabled,
    };
    const observationContext = createObservationContext({
        arena: entityManager?.arena,
        players,
        projectiles,
        mode,
        planarMode: rules.planarMode,
    });

    return {
        dt: Number.isFinite(dt) ? dt : 0,
        player: player || null,
        arena: entityManager?.arena || null,
        players,
        projectiles,
        mode,
        rules,
        observationContext,
        observation: null,
    };
}
