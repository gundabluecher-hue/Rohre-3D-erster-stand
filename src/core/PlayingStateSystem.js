// ============================================
// PlayingStateSystem.js - playing state update orchestration
// ============================================

export class PlayingStateSystem {
    constructor(game) {
        this.game = game;
    }

    update(dt) {
        const game = this.game;

        if (game.input.wasPressed('Escape')) {
            game._returnToMenu();
            return;
        }

        game._updatePlanarAimAssist(dt);
        game.entityManager.update(dt, game.input);
        game.powerupManager.update(dt);
        game.particles.update(dt);
        game.arena.update(dt);
        game.entityManager.updateCameras(dt);
        game.crosshairSystem.updateCrosshairs();
        game.hudRuntimeSystem.updatePlayingHudTick(dt);
        game._applyPlayingTimeScaleFromEffects();
    }
}
