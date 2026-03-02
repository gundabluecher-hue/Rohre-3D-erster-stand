import * as THREE from 'three';
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
        this._damageDir = new THREE.Vector3();
        this._damageForward = new THREE.Vector3();
        this._damageRight = new THREE.Vector3();
        this._damageWorldUp = new THREE.Vector3(0, 1, 0);
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

    _resolveDamageIndicatorAngle(target, event) {
        if (!target) return 0;

        if (event?.sourcePlayer?.position) {
            this._damageDir.subVectors(event.sourcePlayer.position, target.position);
        } else if (event?.hitNormal) {
            this._damageDir.copy(event.hitNormal).multiplyScalar(-1);
        } else {
            target.getDirection(this._damageDir).multiplyScalar(-1);
        }

        if (this._damageDir.lengthSq() <= 0.000001) {
            return 0;
        }
        this._damageDir.normalize();

        target.getDirection(this._damageForward).normalize();
        this._damageRight.crossVectors(this._damageWorldUp, this._damageForward);
        if (this._damageRight.lengthSq() <= 0.000001) {
            this._damageRight.set(1, 0, 0);
        } else {
            this._damageRight.normalize();
        }

        const forwardDot = THREE.MathUtils.clamp(this._damageForward.dot(this._damageDir), -1, 1);
        const sideDot = THREE.MathUtils.clamp(this._damageRight.dot(this._damageDir), -1, 1);
        return THREE.MathUtils.radToDeg(Math.atan2(sideDot, forwardDot));
    }

    _handleHuntDamageEvent(event) {
        const game = this.game;
        if (!game.huntState) return;

        if (game.screenShake?.triggerForDamage) {
            game.screenShake.triggerForDamage(event);
        }

        const target = event?.target;
        if (!target || target.isBot || !target.alive) return;

        const humans = game.entityManager?.getHumanPlayers ? game.entityManager.getHumanPlayers() : [];
        if (!humans.includes(target)) return;

        const damageResult = event?.damageResult || {};
        const applied = Math.max(0, Number(damageResult.applied) || 0);
        const absorbed = Math.max(0, Number(damageResult.absorbedByShield) || 0);
        const damageValue = Math.max(applied, absorbed);
        if (damageValue <= 0) return;

        const intensity = THREE.MathUtils.clamp(0.2 + damageValue / 60, 0.2, 1.0);
        game.huntState.damageIndicator = {
            angleDeg: this._resolveDamageIndicatorAngle(target, event),
            intensity,
            ttl: THREE.MathUtils.clamp(0.35 + intensity * 0.55, 0.35, 0.95),
        };
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
        if (game.entityManager) {
            game.entityManager.onHuntFeedEvent = (entry) => {
                if (!game.huntState) return;
                if (!Array.isArray(game.huntState.killFeed)) game.huntState.killFeed = [];
                game.huntState.killFeed.unshift(String(entry));
                if (game.huntState.killFeed.length > 5) {
                    game.huntState.killFeed.length = 5;
                }
            };
            game.entityManager.onHuntDamageEvent = (event) => {
                this._handleHuntDamageEvent(event);
            };
        }
        game._applyMatchFeedbackPlan(initializedMatch.feedbackPlan);

        this.startRound();
    }

    startRound() {
        const game = this.game;
        game.state = 'PLAYING';
        game._hudTimer = 0;
        if (game.huntState) {
            game.huntState.killFeed = [];
            game.huntState.damageIndicator = null;
            game.huntState.overheatByPlayer = {};
        }

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
        if (game.huntState) {
            game.huntState.killFeed = [];
            game.huntState.damageIndicator = null;
            game.huntState.overheatByPlayer = {};
        }
        disposeMatchSessionSystems(game.renderer, game._getCurrentMatchSessionRefs());
        game._clearMatchSessionRefs();
        this.applyMatchUiState(deriveReturnToMenuUiState());
        game._showMainNav();
        this.resetCrosshairUi();
        game.uiManager.syncAll();
    }
}
