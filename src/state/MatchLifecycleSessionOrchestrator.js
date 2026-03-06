import { initializeMatchSession, disposeMatchSessionSystems } from './MatchSessionFactory.js';
import { LIFECYCLE_EVENT_TYPES } from '../core/MediaRecorderSystem.js';

export class MatchLifecycleSessionOrchestrator {
    constructor(game) {
        this.game = game || null;
        this._lifecycleContractVersion = 'lifecycle.v1';
        this._sessionSequence = 0;
        this._activeSessionId = null;
    }

    _buildLifecycleContext(extra = null) {
        const game = this.game;
        const context = {
            contractVersion: this._lifecycleContractVersion,
            sessionId: this._activeSessionId,
            mapKey: game?.mapKey || null,
            numHumans: Number(game?.numHumans) || 0,
            numBots: Number(game?.numBots) || 0,
            winsNeeded: Number(game?.winsNeeded) || 0,
            activeGameMode: game?.activeGameMode || null,
        };
        if (extra && typeof extra === 'object') {
            Object.assign(context, extra);
        }
        return context;
    }

    _emitLifecycleEvent(type, extra = null) {
        const game = this.game;
        if (!game?.mediaRecorderSystem?.notifyLifecycleEvent) return;
        game.mediaRecorderSystem.notifyLifecycleEvent(type, this._buildLifecycleContext(extra));
    }

    _startLifecycleSession(extra = null) {
        this._sessionSequence += 1;
        this._activeSessionId = `match-${this._sessionSequence}`;
        this._emitLifecycleEvent(LIFECYCLE_EVENT_TYPES.MATCH_STARTED, extra);
    }

    _endLifecycleSession(reason = 'match_teardown') {
        if (!this._activeSessionId) return;
        this._emitLifecycleEvent(LIFECYCLE_EVENT_TYPES.MATCH_ENDED, { reason });
        this._activeSessionId = null;
    }

    notifyMenuOpened(extra = null) {
        this._emitLifecycleEvent(LIFECYCLE_EVENT_TYPES.MENU_OPENED, extra);
    }

    createMatchSession({ onPlayerFeedback, onPlayerDied, onRoundEnd } = {}) {
        const game = this.game;
        if (!game) {
            throw new Error('MatchLifecycleSessionOrchestrator requires game runtime');
        }
        if (this._activeSessionId) {
            this._endLifecycleSession('new_match_session');
        }

        const initializedMatch = initializeMatchSession({
            renderer: game.renderer,
            audio: game.audio,
            recorder: game.recorder,
            settings: game.settings,
            runtimeConfig: game.runtimeConfig,
            requestedMapKey: game.mapKey,
            currentSession: game.matchSessionRuntimeBridge.getCurrentMatchSessionRefs(),
            onPlayerFeedback,
            onPlayerDied,
            onRoundEnd,
        });
        game.matchSessionRuntimeBridge.applyInitializedMatchSession(initializedMatch);
        this._startLifecycleSession({
            mapKey: initializedMatch?.session?.effectiveMapKey || game.mapKey || null,
            numHumans: initializedMatch?.session?.numHumans || game.numHumans || 0,
            numBots: initializedMatch?.session?.numBots || game.numBots || 0,
            winsNeeded: initializedMatch?.session?.winsNeeded || game.winsNeeded || 0,
        });
        return initializedMatch;
    }

    bindHuntEventHandlers({ onHuntFeedEvent, onHuntDamageEvent } = {}) {
        const game = this.game;
        if (!game?.entityManager) return;
        game.entityManager.onHuntFeedEvent = typeof onHuntFeedEvent === 'function' ? onHuntFeedEvent : null;
        game.entityManager.onHuntDamageEvent = typeof onHuntDamageEvent === 'function' ? onHuntDamageEvent : null;
    }

    resetRoundRuntime() {
        const game = this.game;
        if (!game?.entityManager || !game?.powerupManager) return;

        for (const player of game.entityManager.players) {
            player.trail.clear();
        }
        game.powerupManager.clear();

        game.recorder.startRound(game.entityManager.players);
        game.entityManager.spawnAll();
        for (const player of game.entityManager.getHumanPlayers()) {
            player.planarAimOffset = 0;
        }
    }

    teardownMatchSession() {
        const game = this.game;
        if (!game) return;
        this._endLifecycleSession('return_to_menu');
        disposeMatchSessionSystems(game.renderer, game.matchSessionRuntimeBridge.getCurrentMatchSessionRefs());
        game.matchSessionRuntimeBridge.clearMatchSessionRefs();
        this.notifyMenuOpened();
    }
}
