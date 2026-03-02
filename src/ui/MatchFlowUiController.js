import { coordinateRoundEnd } from '../state/RoundEndCoordinator.js';
import { disposeMatchSessionSystems, initializeMatchSession } from '../state/MatchSessionFactory.js';
import {
    deriveMatchStartUiState,
    deriveReturnToMenuUiState,
    deriveRoundStartUiState,
} from './MatchUiStateOps.js';

export class MatchFlowUiController {
    constructor(game) {
        this.game = game;
    }

    applyMatchUiState(uiState) {
        const game = this.game;
        const visibility = uiState?.visibility || {};
        const hasOwn = (key) => Object.prototype.hasOwnProperty.call(visibility, key);
        if (game.ui.mainMenu && hasOwn('mainMenuHidden')) {
            game.ui.mainMenu.classList.toggle('hidden', visibility.mainMenuHidden !== false);
        }
        if (game.ui.hud && hasOwn('hudHidden')) {
            game.ui.hud.classList.toggle('hidden', visibility.hudHidden === true);
        }
        if (game.ui.messageOverlay) {
            if (typeof uiState?.messageText === 'string' && game.ui.messageText) {
                game.ui.messageText.textContent = uiState.messageText;
            }
            if (typeof uiState?.messageSub === 'string' && game.ui.messageSub) {
                game.ui.messageSub.textContent = uiState.messageSub;
            }
            if (hasOwn('messageOverlayHidden')) {
                game.ui.messageOverlay.classList.toggle('hidden', visibility.messageOverlayHidden !== false);
            }
        }
        if (game.ui.statusToast && hasOwn('statusToastHidden')) {
            game.ui.statusToast.classList.toggle('hidden', visibility.statusToastHidden !== false);
        }

        if (typeof uiState?.splitScreenEnabled === 'boolean') {
            game.renderer.setSplitScreen(uiState.splitScreenEnabled);
        }
        if (typeof uiState?.p2HudVisible === 'boolean') {
            if (game.ui.p2Hud) {
                game.ui.p2Hud.classList.toggle('hidden', !uiState.p2HudVisible);
            } else {
                game._syncP2HudVisibility();
            }
        }
    }

    applyMatchStartUiState(uiState) {
        this.applyMatchUiState(uiState);
    }

    resetCrosshairElementUi(element) {
        if (!element) return;
        element.style.display = 'none';
        element.style.left = '50%';
        element.style.top = '50%';
        element.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    }

    resetCrosshairUi() {
        const game = this.game;
        this.resetCrosshairElementUi(game.ui.crosshairP1);
        this.resetCrosshairElementUi(game.ui.crosshairP2);
    }

    startMatch() {
        const game = this.game;
        game.keyCapture = null;
        game._applySettingsToRuntime();

        this.applyMatchStartUiState(deriveMatchStartUiState({ numHumans: game.numHumans }));

        const initializedMatch = initializeMatchSession({
            renderer: game.renderer,
            audio: game.audio,
            recorder: game.recorder,
            settings: game.settings,
            runtimeConfig: game.runtimeConfig,
            requestedMapKey: game.mapKey,
            currentSession: game._getCurrentMatchSessionRefs(),
            onPlayerFeedback: (player, message) => {
                game._showPlayerFeedback(player, message);
            },
            onPlayerDied: (player, cause) => {
                if (!player.isBot) {
                    game._showStatusToast(game._getDeathMessage(cause), 2500, 'error');
                }
            },
            onRoundEnd: (winner) => {
                this.onRoundEnd(winner);
            },
        });
        game._applyInitializedMatchSession(initializedMatch);
        game._applyMatchFeedbackPlan(initializedMatch.feedbackPlan);

        this.startRound();
    }

    startRound() {
        const game = this.game;
        game.state = 'PLAYING';
        game._hudTimer = 0;

        if (game.ui.crosshairP1) {
            game.ui.crosshairP1.style.display = 'none';
        }
        if (game.ui.crosshairP2) {
            game.ui.crosshairP2.style.display = 'none';
        }

        game.roundPause = 0;

        for (const player of game.entityManager.players) {
            player.trail.clear();
        }
        game.powerupManager.clear();

        game.recorder.startRound(game.entityManager.players);
        game.entityManager.spawnAll();
        for (const player of game.entityManager.getHumanPlayers()) {
            player.planarAimOffset = 0;
        }

        game.gameLoop.setTimeScale(1.0);
        this.applyMatchUiState(deriveRoundStartUiState());
        game.hudRuntimeSystem.updateScoreHud();
    }

    onRoundEnd(winner) {
        const game = this.game;
        game.state = 'ROUND_END';
        game.roundPause = 3.0;

        const roundEndPlan = coordinateRoundEnd(this.buildRoundEndCoordinatorRequest(winner));
        this.applyRoundEndCoordinatorPlan(roundEndPlan);
    }

    buildRoundEndCoordinatorRequest(winner) {
        const game = this.game;
        return {
            recorder: game.recorder,
            winner,
            players: game.entityManager ? game.entityManager.players : [],
            roundStateController: game.roundStateController,
            humanPlayerCount: game.entityManager ? game.entityManager.getHumanPlayers().length : 0,
            totalBots: game.numBots,
            winsNeeded: game.winsNeeded,
            logger: console,
        };
    }

    applyRoundEndCoordinatorPlan(roundEndPlan) {
        this.applyRoundEndControllerTransitionState(roundEndPlan?.transition);
        this.applyRoundEndCoordinatorEffects(roundEndPlan?.effectsPlan);
        this.applyRoundEndCoordinatorUiState(roundEndPlan?.uiState);
    }

    applyRoundEndCoordinatorEffects(effectsPlan) {
        const game = this.game;
        if (!effectsPlan?.shouldUpdateHud) return;
        game.hudRuntimeSystem.updateScoreHud();
    }

    applyRoundEndCoordinatorUiState(uiState) {
        if (!uiState) return;
        this.applyMatchUiState(uiState);
    }

    applyRoundEndControllerTransitionState(roundEndTransition) {
        const game = this.game;
        if (!roundEndTransition) return;
        game.roundPause = roundEndTransition.roundPause;
        game.state = roundEndTransition.nextState;
    }

    returnToMenu() {
        const game = this.game;
        game.state = 'MENU';
        disposeMatchSessionSystems(game.renderer, game._getCurrentMatchSessionRefs());
        game._clearMatchSessionRefs();
        this.applyMatchUiState(deriveReturnToMenuUiState());
        game._showMainNav();
        this.resetCrosshairUi();
        game.uiManager.syncAll();
    }
}
