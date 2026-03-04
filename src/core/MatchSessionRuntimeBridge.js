// ============================================
// MatchSessionRuntimeBridge.js - match session ref apply/clear facade
// ============================================
//
// Contract:
// - Inputs: game runtime + initializedMatch payload from MatchSessionFactory
// - Outputs: stable current-session reference object for lifecycle operations
// - Side effects: applies/clears game runtime refs (arena/entity/powerup/particles)

export class MatchSessionRuntimeBridge {
    constructor(game) {
        this.game = game || null;
    }

    applyInitializedMatchSession(initializedMatch) {
        const game = this.game;
        const matchSession = initializedMatch?.session;
        if (!game || !matchSession) return;

        game.particles = matchSession.particles;
        game.arena = matchSession.arena;
        game.powerupManager = matchSession.powerupManager;
        game.entityManager = matchSession.entityManager;
        game.mapKey = matchSession.effectiveMapKey;
        game.numHumans = matchSession.numHumans;
        game.numBots = matchSession.numBots;
        game.winsNeeded = matchSession.winsNeeded;
    }

    getCurrentMatchSessionRefs() {
        const game = this.game;
        return {
            entityManager: game?.entityManager || null,
            powerupManager: game?.powerupManager || null,
            particles: game?.particles || null,
        };
    }

    clearMatchSessionRefs() {
        const game = this.game;
        if (!game) return;
        game.particles = null;
        game.arena = null;
        game.entityManager = null;
        game.powerupManager = null;
    }
}
