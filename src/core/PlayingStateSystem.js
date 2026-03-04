// ============================================
// PlayingStateSystem.js - playing state update orchestration
// ============================================

export class PlayingStateSystem {
    constructor(game) {
        this.game = game;
        this._lastOverheatSnapshotVersion = -1;
    }

    _syncHuntOverheatSnapshot() {
        const game = this.game;
        if (!game.huntState || !game.entityManager?.getHuntOverheatSnapshot) return;

        const snapshot = game.entityManager.getHuntOverheatSnapshot();
        if (!snapshot || typeof snapshot !== 'object') {
            if (game.huntState.overheatByPlayer !== snapshot) {
                game.huntState.overheatByPlayer = snapshot || {};
            }
            this._lastOverheatSnapshotVersion = -1;
            return;
        }

        const version = Number(snapshot.__version);
        if (Number.isFinite(version)) {
            if (version === this._lastOverheatSnapshotVersion) {
                return;
            }
            this._lastOverheatSnapshotVersion = version;
        } else if (game.huntState.overheatByPlayer === snapshot) {
            return;
        }

        game.huntState.overheatByPlayer = snapshot;
    }

    update(dt) {
        const game = this.game;

        if (game.input.wasPressed('Escape')) {
            game.matchFlowUiController.returnToMenu();
            return;
        }

        game._updatePlanarAimAssist(dt);
        game.entityManager.update(dt, game.input);
        this._syncHuntOverheatSnapshot();
        game.powerupManager.update(dt);
        game.particles.update(dt);
        game.arena.update(dt);
        game.entityManager.updateCameras(dt);
        game.crosshairSystem.updateCrosshairs();
        game.hudRuntimeSystem.updatePlayingHudTick(dt);
        game._applyPlayingTimeScaleFromEffects();
    }
}
