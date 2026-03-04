// ============================================
// PlanarAimAssistSystem.js - planar aim + playing timescale helpers
// ============================================
//
// Contract:
// - Inputs: game runtime (settings/input/runtimeConfig/entityManager/gameLoop)
// - Outputs: planar aim axis and normalized player.planarAimOffset values
// - Side effects: mutates human player planarAimOffset and gameLoop timescale
// - Hotpath guardrail: no per-frame object creation in update methods

import { CONFIG } from './Config.js';

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export class PlanarAimAssistSystem {
    constructor(game) {
        this.game = game || null;
    }

    getPlanarAimAxis(playerIndex) {
        const game = this.game;
        const controls = game?.settings?.controls;
        if (!controls) return 0;

        const p1 = controls.PLAYER_1;
        const p2 = controls.PLAYER_2;
        let up = false;
        let down = false;

        if (game.numHumans === 1 && playerIndex === 0) {
            up = game.input.isDown(p1.UP) || game.input.isDown(p2.UP);
            down = game.input.isDown(p1.DOWN) || game.input.isDown(p2.DOWN);
        } else {
            const map = playerIndex === 0 ? p1 : p2;
            up = game.input.isDown(map.UP);
            down = game.input.isDown(map.DOWN);
        }

        return (down ? 1 : 0) - (up ? 1 : 0);
    }

    updatePlanarAimAssist(dt) {
        const game = this.game;
        if (!game?.entityManager) return;

        const gameplayConfig = game.runtimeConfig?.gameplay;
        const inputSpeed = gameplayConfig?.planarAimInputSpeed || CONFIG.GAMEPLAY.PLANAR_AIM_INPUT_SPEED || 1.5;
        const returnSpeed = gameplayConfig?.planarAimReturnSpeed || CONFIG.GAMEPLAY.PLANAR_AIM_RETURN_SPEED || 0.6;
        const isPlanar = gameplayConfig?.planarMode ?? !!CONFIG.GAMEPLAY.PLANAR_MODE;
        const humans = game.entityManager.getHumanPlayers();

        for (let i = 0; i < humans.length; i++) {
            const player = humans[i];
            const axis = isPlanar ? this.getPlanarAimAxis(player.index) : 0;
            let offset = player.planarAimOffset || 0;

            if (axis !== 0) {
                offset += axis * inputSpeed * dt;
            } else {
                const recover = 1 - Math.exp(-returnSpeed * dt);
                offset += (0 - offset) * recover;
            }

            player.planarAimOffset = clamp(offset, -1, 1);
        }
    }

    applyPlayingTimeScaleFromEffects() {
        const game = this.game;
        if (!game?.entityManager || !game?.gameLoop) return;

        game.gameLoop.setTimeScale(1.0);
        const players = game.entityManager.players;
        for (let p = 0; p < players.length; p++) {
            const activeEffects = players[p].activeEffects;
            for (let i = 0; i < activeEffects.length; i++) {
                if (activeEffects[i].type === 'SLOW_TIME') {
                    game.gameLoop.setTimeScale(CONFIG.POWERUP.TYPES.SLOW_TIME.timeScale);
                }
            }
        }
    }
}
